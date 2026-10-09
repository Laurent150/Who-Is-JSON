import { randomUUID } from 'node:crypto';
import { prepare, charge, MODEL, POLICY_VERSION, CODE_REVIEW_PROFILE } from './policy.mjs';
import followupPolicy from './followup.cjs';
import readingPolicy from './reading.cjs';
export const DIRECT_READING_PROFILE = readingPolicy.PROFILE;
export const DIAGNOSTICS_VERSION = 'trial-failure-v1';
export const BILLING_VERSION = 'failure-refund-v1';
const uuid = value => typeof value === 'string' && /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(value);

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
    let res;
    try {
    res = await fetcher(base + '/v1/rdb/rest/rpc/' + name, {
      method: 'POST', redirect: 'error', signal: AbortSignal.timeout(10000),
      headers: { Authorization: 'Bearer ' + serviceKey, 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw Error('额度服务暂时不可用。');
    const value = await res.json();
    if (!value || typeof value !== 'object' || value.error && !['disabled','duplicate','busy','rate','quota','closed'].includes(value.error)) throw Error('额度服务暂时不可用。');
    return value;
    } catch(error) {
      const failure=Error('额度服务暂时不可用。');
      failure.diagnostics={code:'trial_quota_failed',stage:'quota-ledger',
        ...(res?{gatewayStatus:res.status}:{}),
        responseType:res?.headers?.get('content-type')?.includes('json')?'json':res?.headers?.get('content-type')?.includes('html')?'html':'other'};
      throw failure;
    }
  }
  return async request => {
    if (request.method !== 'POST') return reply(405, { error: 'POST required' });
    if (!serviceKey || !modelKey) return reply(503, { error: '平台试用尚未启用。' });
    const auth = request.headers.get('authorization') || '';
    if (!/^Bearer \S+$/.test(auth) || auth.length > 10000) return reply(401, { error: '请先登录。' });
    let subject;
    try {
      const res = await fetcher(base + '/auth/v1/user/me', {
        headers: { Authorization: auth }, redirect: 'error', signal: AbortSignal.timeout(5000)
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
      try {
        const quota = await rpc('fimi_ai_quota', { account_subject: subject });
        return reply(200, { ...quota, model: MODEL, policyVersion: POLICY_VERSION,
          billingVersion:quota.billingVersion===BILLING_VERSION?BILLING_VERSION:null,
          directReadingProfile:quota.billingVersion===BILLING_VERSION?DIRECT_READING_PROFILE:null,
          codeReviewProfile:codeReviewEnabled?CODE_REVIEW_PROFILE:null, currency: 'CNY', unit: 1000000, tariff: 'flash-peak-2026-10-02' });
      }
      catch(error) {
        try { logger?.({event:'fimi_trial_quota_failure',...error.diagnostics}); } catch {}
        return reply(503, {error:'额度服务暂时不可用。',diagnostics:error.diagnostics});
      }
    }
    if (data.action === 'complete') {
      if (!uuid(data.operationId) || typeof data.success !== 'boolean') return reply(400, {error:'请求格式不正确。'});
      try {
        const result = data.success
          ? await rpc('fimi_ai_complete', {account_subject:subject, operation_id:data.operationId, succeeded:true})
          : await rpc('fimi_ai_operation_status', {account_subject:subject, operation_id:data.operationId});
        return reply(200,result);
      }
      catch { return reply(503, {error:'额度返还尚未确认，请稍后重新查询额度。'}); }
    }
    if (data.billing_operation != null && !uuid(data.billing_operation)) return reply(400, {error:'请求格式不正确。'});
    let prepared, followup, reading;
    try {
      if(data.reading_context && data.followup_context)throw Error('请求格式不正确。');
      if(!data.reading_context && !data.followup_context && env.FIMI_ALLOW_LEGACY_RAW!=='1')throw Error('试用模式仅支持当前代码阅读请求，请更新应用。');
      // Refund-aware operations must finish inside the trusted gateway. Do not
      // expose an intermediate answer that could later be fraudulently refunded.
      if(data.billing_operation && !data.reading_context && !data.followup_context)throw Error('试用模式仅支持当前代码阅读请求，请更新应用。');
      if(data.reading_context){
        reading=readingPolicy.prepare(data.reading_context);
        data={billing_operation:data.billing_operation,...reading.body};
      }
      if(data.followup_context){
        const context=data.followup_context, input={...context.input}, selected=input.selectedSource;
        if(selected && typeof input.source==='string')input.selectedSource={...selected,code:input.source.split('\n').slice(selected.start-1,selected.end).join('\n')};
        followup=followupPolicy.prepareFollowup(input,context);
        data={billing_operation:data.billing_operation,messages:followup.messages,max_tokens:1100,thinking:{type:'disabled'},response_format:{type:'json_object'}};
      }
      prepared = prepare(data,{codeReviewEnabled});
      // Provider time budget matches the ordinary shared reading/follow-up path.
      if(reading)prepared.providerTimeoutMs=120000;
      if(followup)prepared.providerTimeoutMs=60000;
    } catch (error) { return reply(400, { error: error.message }); }
    const requestId = randomUUID();
    let reserved;
    try { reserved = await rpc(data.billing_operation ? 'fimi_ai_reserve_operation' : 'fimi_ai_reserve', {
      account_subject: subject, request_id: requestId, amount: prepared.reserved,
      ...(data.billing_operation ? {operation_id:data.billing_operation} : {})
    }); }
    catch { return reply(503, { error: '额度服务暂时不可用。' }); }
    if (reserved.ok !== true) {
      const messages = { disabled: '平台试用已暂停。', busy: '上一笔调用仍在处理或待核对。', rate: '请稍后再试。', quota: '个人或平台试用额度不足，可改用自己的 AI。', closed:'AI 请求已取消。' };
      return reply(['rate','busy'].includes(reserved.error) ? 429 : 402, {
        code: reserved.error, error: messages[reserved.error] || '额度服务暂时不可用。'
      });
    }
    // Provider costs and customer trial credit are separate. Failed operations
    // are refunded even when the platform may still incur a provider charge.
    let stage = 'provider-request', providerStatus, cost, settlement = 'pending';
    const started = now();
    async function failed(code) {
      try {
        if(data.billing_operation)await rpc('fimi_ai_mark_failed',{account_subject:subject,operation_id:data.billing_operation});
        const refunded = data.billing_operation
          ? await rpc('fimi_ai_complete',{account_subject:subject,operation_id:data.billing_operation,succeeded:false})
          : await rpc('fimi_ai_refund_request',{request_id:requestId});
        settlement = refunded.ok === true && refunded.state === 'refunded' ? 'refunded' : 'refund_pending';
      } catch { settlement = 'refund_pending'; }
      const error = code === 'trial_followup_scope' ? '请只询问当前代码的含义、执行过程或问题；与这份代码无关的请求不予回答。'
        : settlement === 'refunded' ? 'AI 生成失败，本次使用的试用额度已返还。' : 'AI 生成失败，额度返还尚未确认，请稍后重新查询额度。';
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
      stage = 'content-validation';
      if (typeof result.choices?.[0]?.message?.content !== 'string' || !result.choices[0].message.content.trim()
          || result.choices[0].finish_reason === 'length' || result.choices[0].finish_reason === 'content_filter') return failed('trial_invalid_content');
      if(followup){
        try { followupPolicy.validateFollowup(result.choices[0].message.content,followup.input,followup); }
        catch(error){ return failed(error.code==='AI_FOLLOWUP_SCOPE'?'trial_followup_scope':'trial_invalid_content'); }
      }
      if(reading){
        try { reading.validate(result.choices[0].message.content); }
        catch { return failed('trial_invalid_content'); }
      }
      stage = 'usage-validation';
      cost = charge(result.usage, prepared);
      stage = 'settlement';
      settlement = 'unknown';
      const settled = await rpc('fimi_ai_settle', { request_id: requestId, cost });
      if (settled.ok !== true) throw Error();
      if (settled.refunded) return failed('trial_invalid_content');
      if(data.billing_operation){
        const completed=await rpc('fimi_ai_complete',{account_subject:subject,operation_id:data.billing_operation,succeeded:true});
        if(completed.ok!==true||completed.state!=='succeeded')throw Error('Operation did not complete');
      }
      settlement = 'confirmed';
      return reply(200, { choices: result.choices, usage: result.usage, model: MODEL, requestId,
        ...(data.billing_operation?{operationState:'succeeded'}:{}),
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
