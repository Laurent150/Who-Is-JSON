import { randomUUID } from 'node:crypto';
import { prepare, charge, MODEL, POLICY_VERSION, CODE_REVIEW_PROFILE } from './policy.mjs';
export const DIAGNOSTICS_VERSION = 'trial-failure-v1';

const reply = (status, data) => new Response(JSON.stringify(data), {
  status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
});
export function createHandler({ env = process.env, fetcher = fetch, logger, now = Date.now } = {}) {
  const id = env.CLOUDBASE_ENV_ID || '';
  if (!/^[a-z][a-z0-9-]{2,63}$/.test(id)) throw Error('Invalid CloudBase environment');
  const base = `https://${id}.api.tcloudbasegateway.com`;
  const serviceKey = env.CLOUDBASE_SERVICE_ROLE_KEY;
  const modelKey = env.DEEPSEEK_API_KEY;
  // Enable only after the deployed HTTP route supports the longer response time.
  const codeReviewEnabled = env.FIMI_CODE_REVIEW_LONG_REQUESTS === '1';
  async function rpc(name, data) {
    const res = await fetcher(base + '/v1/rdb/rest/rpc/' + name, {
      method: 'POST', redirect: 'error', signal: AbortSignal.timeout(10000),
      headers: { Authorization: 'Bearer ' + serviceKey, 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw Error('额度服务暂时不可用。');
    const value = await res.json();
    if (!value || typeof value !== 'object' || value.error && !['disabled','duplicate','busy','rate','quota'].includes(value.error)) throw Error('额度服务暂时不可用。');
    return value;
  }
  return async request => {
    if (request.method !== 'POST') return reply(405, { error: 'POST required' });
    if (!serviceKey || !modelKey) return reply(503, { error: '平台试用尚未启用。' });
    const auth = request.headers.get('authorization') || '';
    if (!/^Bearer \S+$/.test(auth) || auth.length > 10000) return reply(401, { error: '请先登录。' });
    let subject;
    try {
      const res = await fetcher(base + '/auth/v1/user/me', {
        headers: { Authorization: auth }, redirect: 'error', signal: AbortSignal.timeout(10000)
      });
      if ([401,403].includes(res.status)) return reply(401, { error: '登录已过期，请重新登录。' });
      if (!res.ok) throw Error();
      const profile = await res.json();
      // This environment's successful /user/me response omits status,
      // email_verified and providers; its backing status fields can be NULL.
      // Eligibility is the authenticated CloudBase account with an email,
      // not a claim that missing fields prove separate email verification.
      // Only this trusted response supplies identity, never the request body.
      const email = typeof profile?.email === 'string' ? profile.email.trim().toLowerCase() : '';
      const verificationAccepted = profile?.email_verified == null || profile.email_verified === true;
      const statusAccepted = profile?.status == null || profile.status === 'ACTIVE';
      if (typeof profile?.sub !== 'string' || !profile.sub || profile.sub.length > 255
          || !verificationAccepted || !/^[^\s@]+@[^\s@]+$/.test(email)
          || !statusAccepted) return reply(403, { error: '未能确认邮箱身份。' });
      subject = profile.sub;
    } catch { return reply(503, { error: '暂时无法验证登录。' }); }
    let data;
    try {
      const reader = request.body?.getReader(); if (!reader) throw Error();
      const chunks = []; let size = 0;
      while (true) {
        const { done, value } = await reader.read(); if (done) break;
        size += value.length;
        if (size > 120000) { await reader.cancel(); return reply(413, { error: '请求过大。' }); }
        chunks.push(value);
      }
      data = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      if (!data || typeof data !== 'object' || Array.isArray(data)) throw Error();
    } catch { return reply(400, { error: '请求格式不正确。' }); }
    if (data.action === 'quota') {
      try { return reply(200, { ...await rpc('fimi_ai_quota', { account_subject: subject }), model: MODEL, policyVersion: POLICY_VERSION, codeReviewProfile:codeReviewEnabled?CODE_REVIEW_PROFILE:null, currency: 'CNY', unit: 1000000, tariff: 'flash-peak-2026-10-02' }); }
      catch { return reply(503, { error: '额度服务暂时不可用。' }); }
    }
    let prepared;
    try { prepared = prepare(data,{codeReviewEnabled}); } catch (error) { return reply(400, { error: error.message }); }
    const requestId = randomUUID();
    let reserved;
    try { reserved = await rpc('fimi_ai_reserve', { account_subject: subject, request_id: requestId, amount: prepared.reserved }); }
    catch { return reply(503, { error: '额度服务暂时不可用。' }); }
    if (reserved.ok !== true) {
      const messages = { disabled: '平台试用已暂停。', busy: '上一笔调用仍在处理或待核对。', rate: '请稍后再试。', quota: '个人或平台试用额度不足，可改用自己的 AI。' };
      return reply(['rate','busy'].includes(reserved.error) ? 429 : 402, {
        code: reserved.error, error: messages[reserved.error] || '额度服务暂时不可用。'
      });
    }
    // Once dispatched, neither browser cancellation nor uncertain provider errors
    // justify refunding a potentially billed call. Do not automatically retry it.
    let stage = 'provider-request', providerStatus, cost, settlement = 'pending';
    const started = now();
    function failed(code, error = 'AI 调用未完成，预留额度待核对，请勿反复重试。') {
      const diagnostics = { code, stage, elapsedMs: Math.max(0, now() - started), settlement,
        ...(Number.isInteger(providerStatus) ? {providerStatus} : {}) };
      // Never log authorization, identity, source, model prose or reasoning.
      try { logger?.({ event:'fimi_trial_failure', requestId, ...diagnostics,
        ...(Number.isSafeInteger(cost) ? {computedCost:cost} : {}) }); } catch {}
      return reply(502, {error, requestId, diagnostics});
    }
    try {
      const res = await fetcher('https://api.deepseek.com/chat/completions', {
        method: 'POST', redirect: 'error', signal: AbortSignal.timeout(prepared.providerTimeoutMs),
        headers: { Authorization: 'Bearer ' + modelKey, 'Content-Type': 'application/json' },
        body: JSON.stringify(prepared.body)
      });
      providerStatus = res.status;
      stage = 'provider-response';
      if (!res.ok) { try { await res.body?.cancel(); } catch {} return failed('trial_provider_http'); }
      const result = await res.json();
      stage = 'usage-validation';
      cost = charge(result.usage, prepared);
      stage = 'settlement';
      settlement = 'unknown';
      const settled = await rpc('fimi_ai_settle', { request_id: requestId, cost });
      if (settled.ok !== true) throw Error();
      settlement = 'confirmed';
      stage = 'content-validation';
      if (typeof result.choices?.[0]?.message?.content !== 'string') return failed('trial_invalid_content', '云端返回格式不正确。');
      return reply(200, { choices: result.choices, usage: result.usage, model: MODEL, requestId,
        policyVersion: POLICY_VERSION, thinking: prepared.body.thinking.type,
        reasoningEffort: prepared.body.reasoning_effort || null });
    } catch (error) {
      const timeout = error.name === 'TimeoutError' || error.name === 'AbortError';
      const code = stage === 'provider-request' ? (timeout ? 'trial_provider_timeout' : 'trial_provider_connection')
        : stage === 'provider-response' ? (timeout ? 'trial_provider_timeout' : 'trial_provider_response')
        : stage === 'usage-validation' ? 'trial_usage_invalid'
        : stage === 'settlement' ? 'trial_settlement_failed' : 'trial_invalid_content';
      return failed(code);
    }
  };
}
