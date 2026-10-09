const crypto = require('node:crypto');
const { setTimeout: delay } = require('node:timers/promises');

function failure(status, message) { return Object.assign(new Error(message), { status }); }
const unavailable = 'CloudBase 账户试用尚未启用，请在 AI 设置中连接自己的服务。';

// Public auth endpoints only. No administrator key belongs in a desktop app.
function createCloudBaseAccount({ env = process.env, fetcher = fetch, now = Date.now, pause = (ms, signal) => delay(ms, undefined, { signal }) } = {}) {
  const envId = env.WHO_CLOUDBASE_ENV_ID || '';
  if (envId && !/^[a-z][a-z0-9-]{2,63}$/.test(envId)) throw Error('CloudBase 环境 ID 格式不正确。');
  const enabled = !!envId && env.WHO_CLOUD_DISABLED !== '1';
  const libraryEnabled = env.WHO_CLOUDBASE_LIBRARY_ENABLED === '1';
  let trialUrl = env.WHO_CLOUDBASE_TRIAL_URL || '';
  if (trialUrl) {
    let url; try { url = new URL(trialUrl); } catch { throw Error('Invalid CloudBase trial URL'); }
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) throw Error('Invalid CloudBase trial URL');
    // The console gives a service origin; the deployed gateway handles /trial.
    if (url.pathname === '/') url.pathname = '/trial';
    trialUrl = url.href;
  }
  const trialEnabled = enabled && !!trialUrl && env.WHO_CLOUDBASE_TRIAL_ENABLED === '1';
  const trialQueues = new Map();
  const origin = `https://${envId}.api.tcloudbasegateway.com`;
  const flows = new Map(), sessions = new Map(), limits = new Map();
  const deviceId = env.WHO_CLOUDBASE_DEVICE_ID || crypto.randomUUID();
  if (!/^[a-zA-Z0-9_-]{16,80}$/.test(deviceId)) throw Error('CloudBase 设备 ID 格式不正确。');
  function prune() {
    for (const map of [flows, sessions, limits]) for (const [id, value] of map) if (value.expires <= now()) map.delete(id);
  }
  function rate(id, max, duration) {
    const value = limits.get(id) || { count: 0, expires: now() + duration };
    if (value.count >= max) throw failure(429, '请求过于频繁，请稍后重试。');
    value.count++; limits.set(id, value);
  }
  async function request(route, body, { access, locale = 'en', signal } = {}) {
    let response, result;
    try {
      response = await fetcher(origin + route, {
        method: body === undefined ? 'GET' : 'POST', redirect: 'error',
        signal: signal || AbortSignal.timeout(15000),
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json',
          'Accept-Language': locale === 'en' ? 'en-US' : 'zh-CN', 'x-device-id': deviceId,
          ...(access ? { Authorization: `Bearer ${access}` } : {}) },
        ...(body === undefined ? {} : { body: JSON.stringify(body) })
      });
    } catch { throw failure(503, '云端暂时不可用，本地收藏已保留，请稍后重试。'); }
    if (response.status === 204 && response.ok) return {};
    try { result = await response.json(); } catch { throw failure(502, '云端返回格式不正确。'); }
    if (!response.ok || result?.error) {
      if (result?.error === 'captcha_required') throw failure(409, '云服务要求额外的人机验证，当前测试入口暂不支持，请稍后重试。');
      if (response.status === 429) throw failure(429, '请求过于频繁，请稍后重试。');
      if (route === '/auth/v1/verification/verify' && result?.error === 'invalid_verification_code') {
        throw Object.assign(failure(400, '验证码无效或已过期，请重新获取。'), { invalidCode: true });
      }
      if ([401, 403].includes(response.status)) throw failure(401, '登录已失效，请重新登录。');
      if (route === '/auth/v1/verification') throw failure(502, '邮件未能发送，请稍后重试或使用其他登录方式。');
      throw failure(502, 'CloudBase 操作未完成，请检查环境配置后重试。');
    }
    return result;
  }
  function session(req) {
    prune();
    const current = sessions.get(req.headers?.['x-who-session']);
    if (!current) throw failure(401, '请先登录账户。');
    return current;
  }
  async function handle(req, route, data = {}) {
    if (route === 'status') return { enabled, provider: 'cloudbase', emailEnabled: enabled, githubEnabled: false, libraryEnabled, trialEnabled };
    if (!enabled) throw failure(503, '云端账户尚未配置，仍可使用本地收藏。');
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw failure(400, '账户请求格式不正确。');
    prune();
    if (route === 'email-start') {
      const email = typeof data.email === 'string' ? data.email.trim().toLowerCase() : '';
      if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw failure(400, '请输入有效的邮箱地址。');
      rate('all', 8, 60000); rate(`email:${email}`, 1, 60000);
      const locale = data.locale === 'zh-CN' ? 'zh-CN' : 'en';
      const result = await request('/auth/v1/verification', { email, target: 'ANY' }, { locale });
      if (typeof result?.verification_id !== 'string' || !result.verification_id || !Number.isFinite(result.expires_in) || result.expires_in <= 0) throw failure(502, '云端返回格式不正确。');
      const ticket = crypto.randomBytes(32).toString('hex');
      flows.set(ticket, { email, locale, verificationId: result.verification_id, existing: result.is_user === true,
        expires: now() + Math.min(result.expires_in, 600) * 1000, attempts: 0, busy: false });
      return { ticket };
    }
    if (route === 'email-verify' || route === 'email-cancel') {
      const flow = flows.get(data.ticket);
      if (!flow) throw failure(400, '登录请求已过期，请回到应用重新登录。');
      if (route === 'email-cancel') { flows.delete(data.ticket); return { ok: true }; }
      if (flow.busy) throw failure(409, '正在验证，请稍候。');
      if (typeof data.code !== 'string' || !/^\d{6}$/.test(data.code)) throw failure(400, '请输入邮件中的数字验证码。');
      flow.busy = true; flow.attempts++;
      const options = { locale: flow.locale, signal: AbortSignal.timeout(17000) };
      const active = () => {
        if (flows.get(data.ticket) !== flow || flow.expires <= now()) throw failure(400, '登录请求已过期，请回到应用重新登录。');
      };
      try {
        const verified = await request('/auth/v1/verification/verify', { verification_id: flow.verificationId, verification_code: data.code }, options);
        if (typeof verified?.verification_token !== 'string' || !verified.verification_token) throw failure(502, '云端未返回有效会话。');
        active();
        const result = await request(flow.existing ? '/auth/v1/signin' : '/auth/v1/signup', {
          verification_token: verified.verification_token,
          ...(flow.existing ? {} : { email: flow.email, locale: flow.locale === 'en' ? 'en' : 'zh' })
        }, options);
        if (typeof result?.access_token !== 'string' || !result.access_token || typeof result.sub !== 'string' || !result.sub || !Number.isFinite(result.expires_in) || result.expires_in <= 0) throw failure(502, '云端未返回有效会话。');
        active();
        const profile = await request('/auth/v1/user/me', undefined, { ...options, access: result.access_token });
        if (profile?.sub !== result.sub || profile.email?.toLowerCase() !== flow.email || profile.email_verified === false || (profile.status && profile.status !== 'ACTIVE')) throw failure(401, '未能确认邮箱身份。');
        active(); prune();
        if (sessions.size >= 100) throw failure(429, '本机登录会话过多，请稍后再试。');
        const id = crypto.randomBytes(32).toString('hex');
        const user = { id: `cloudbase:${envId}:${result.sub}`, name: flow.email, email: flow.email, trialEligible: trialEnabled, provider: 'cloudbase' };
        sessions.set(id, { access: result.access_token, uid: result.sub, user, locale: flow.locale, expires: now() + Math.min(result.expires_in, 3600) * 1000 });
        flows.delete(data.ticket);
        return { session: id, user };
      } catch (error) {
        // Retry only a definitive wrong code, never replay a possibly consumed token.
        if (error.invalidCode && flow.attempts < 5) flow.busy = false;
        else flows.delete(data.ticket);
        throw error;
      }
    }
    const current = session(req);
    if (route === 'me') return { user: current.user };
    if (route === 'logout') {
      sessions.delete(req.headers['x-who-session']);
      try { await request('/auth/v1/user/signout', {}, current); } catch {}
      return { ok: true };
    }
    if (route === 'trial-quota') return trialEnabled ? trialRequest({ action: 'quota' }, current) : { enabled: false, remaining: 0, held: 0, poolRemaining: 0 };
    if (route === 'library' || route === 'save') {
      if (!libraryEnabled) throw failure(503, 'CloudBase 收藏同步尚未启用，收藏仍保存在本机。');
      const { validateLibrary } = require('./cloud-account');
      if (route === 'library') {
        const rows = await request('/v1/rdb/rest/fimi_libraries?select=user_id,revision,payload', undefined, current);
        if (!Array.isArray(rows) || rows.length > 1 || (rows[0] && rows[0].user_id !== current.uid)) throw failure(502, '云端收藏权限配置不正确。');
        const row = rows[0];
        if (row && (!Number.isSafeInteger(row.revision) || row.revision < 0)) throw failure(502, '云端收藏版本不正确。');
        return { user: current.user, revision: row?.revision || 0, payload: row ? validateLibrary(row.payload) : { knowledge: [], cards: [] } };
      }
      if (data.userId !== current.user.id) throw failure(409, '账户已变化，请重新打开收藏库。');
      if (!Number.isSafeInteger(data.revision) || data.revision < 0) throw failure(400, '收藏版本无效。');
      const payload = validateLibrary(data.payload);
      const result = await request('/v1/rdb/rest/rpc/fimi_save_library', { expected_revision: data.revision, new_payload: payload }, current);
      if (result?.conflict) throw failure(409, '其他设备已更新收藏。请先导出本机备份，再重新载入云端收藏。');
      if (!Number.isSafeInteger(result?.revision) || result.revision !== data.revision + 1) throw failure(502, '云端未确认保存，本地收藏已保留。');
      return { revision: result.revision };
    }
    throw failure(404, '未找到账户操作。');
  }
  async function trialRequest(data, current) {
    // Quota reads are idempotent. A cold or interrupted gateway gets one fresh
    // attempt; model dispatch and settlement are never replayed here.
    if(data.action==='quota'){
      try { return await trialRequestOnce(data,current); }
      catch(error){
        if(error.status!==503)throw error;
        return trialRequestOnce(data,current);
      }
    }
    return trialRequestOnce(data,current);
  }
  async function trialRequestOnce(data, current) {
    let res, result, stage = 'gateway-request';
    const started = now();
    try {
      res = await fetcher(trialUrl, { method: 'POST', redirect: 'error', signal: AbortSignal.timeout(data.action ? 18000 : data.request_profile==='code-review-64k-v1'?400000:data.reading_context||data.followup_context?160000:140000),
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + current.access }, body: JSON.stringify(data) });
      stage = 'gateway-response';
      result = await res.json();
    } catch (error) {
      const timeout = error.name === 'TimeoutError' || error.name === 'AbortError';
      throw require('./ai-diagnostics').attach(failure(503, data.action === 'quota' ? '额度服务暂时不可用。' : 'AI 调用未完成，预留额度待核对，请勿反复重试。'), {
        code: timeout ? 'trial_gateway_timeout' : stage === 'gateway-response' ? 'trial_gateway_response' : 'trial_gateway_connection',
        stage, elapsedMs: now() - started, gatewayStatus:res?.status,
        ...(res ? {responseType:res.headers?.get('content-type')?.includes('json')?'json':res.headers?.get('content-type')?.includes('html')?'html':'other'} : {}),
        transportCode:error?.cause?.code || error?.code,
        ...(data.action === 'quota' ? {} : {settlement:'unknown'})
      });
    }
    if (!res.ok) {
      const known = ['请先登录。','登录已过期，请重新登录。','未能确认邮箱身份。','暂时无法验证登录。','平台试用尚未启用。','额度服务暂时不可用。','平台试用已暂停。','上一笔调用仍在处理或待核对。','请稍后再试。','个人或平台试用额度不足，可改用自己的 AI。','AI 调用未完成，预留额度待核对，请勿反复重试。','内容过长，请缩小代码范围。','输出长度超过试用限制。','请求格式不正确。','请求过大。','试用额度目前仅支持文字，请使用本地图片识别。'];
      const diagnostics = require('./ai-diagnostics').safe({...result?.diagnostics, requestId:result?.requestId});
      const messages = {
        trial_provider_timeout: 'AI 服务响应超时，本次调用及预留额度待核对，请勿连续重试。',
        trial_provider_connection: '与 AI 服务的连接中断，本次调用及预留额度待核对，请勿连续重试。',
        trial_provider_http: 'AI 服务返回错误，本次调用及预留额度待核对，请勿连续重试。',
        trial_provider_response: 'AI 服务返回数据不完整，本次调用及预留额度待核对，请勿连续重试。',
        trial_usage_invalid: 'AI 服务的用量信息无法核验，预留额度待核对，请勿连续重试。',
        trial_settlement_failed: '已收到 AI 响应，但试用额度结算未确认，请勿连续重试。',
        trial_invalid_content: '云端返回格式不正确。'
      };
      messages.trial_followup_scope = '请只询问当前代码的含义、执行过程或问题；与这份代码无关的请求不予回答。';
      known.push('云端尚未启用代码评审的大额度请求，请更新试用服务或使用个人 API。');
      known.push('额度返还尚未确认，请稍后重新查询额度。','AI 请求已取消。');
      known.push('试用模式仅支持当前代码阅读请求，请更新应用。');
      const refundMessage = diagnostics.settlement === 'refunded' ? 'AI 生成失败，本次使用的试用额度已返还。'
        : diagnostics.settlement === 'refund_pending' ? 'AI 生成失败，额度返还尚未确认，请稍后重新查询额度。' : null;
      const error = require('./ai-diagnostics').attach(failure(res.status,
        (diagnostics.code==='trial_followup_scope' ? messages.trial_followup_scope : refundMessage) || messages[diagnostics.code] || (known.includes(result?.error) ? result.error : '额度服务暂时不可用。')), diagnostics);
      error.trialRateLimited = res.status === 429 && result?.code === 'rate';
      throw error;
    }
    return result;
  }
  function trialConfig(req, { refundFailures = false } = {}) {
    const current = session(req);
    if (!trialEnabled) throw failure(403, unavailable);
    let codeReviewReady=false;
    const operation = refundFailures ? require('./trial-operation').createTrialOperation(data=>trialRequest(data,current)) : null;
    const config = { base: 'https://api.deepseek.com', model: 'deepseek-flash', reviewThinking: true,
      ...(operation ? {async prepareTrial(){
        const quota=await operation.prepare();
        if(quota.directReadingProfile!=='direct-reading-v1')throw failure(503,'云端尚未启用当前点读模式，请更新试用服务或使用个人 API。');
        config.directReadingProfile=quota.directReadingProfile;
      }} : {}),
      ...(operation ? {finishTrial:success=>operation.finish(success)} : {}),
      sponsoredCall(data, { signal, requestProfile, followupContext, readingContext } = {}) {
      if(readingContext){
        const input=readingContext.input, selected=input?.selectedSource, token=input?.selectedToken;
        data={...data,messages:undefined,reading_context:{...readingContext,input:{...input,
          ...(selected?{selectedSource:{start:selected.start,end:selected.end}}:{}),
          ...(token?{selectedToken:{line:token.line,startColumn:token.startColumn,endColumn:token.endColumn}}:{})}}};
      }
      if(followupContext){
        const input=followupContext.input, selected=input?.selectedSource;
        // Send source once; the gateway reconstructs both the selected excerpt
        // and the fixed system prompt instead of accepting client instructions.
        data={...data,messages:undefined,followup_context:{...followupContext,input:{...input,
          ...(selected?{selectedSource:{start:selected.start,end:selected.end}}:{})}}};
      }
      for (const [id, queue] of trialQueues) if (!queue.pending && queue.next <= now()) trialQueues.delete(id);
      let queue = trialQueues.get(current.uid);
      if (!queue) { queue = { tail: Promise.resolve(), pending: 0, next: 0 }; trialQueues.set(current.uid, queue); }
      queue.pending++;
      const work = queue.tail.then(async () => {
        for (let attempt = 0; attempt < 2; attempt++) {
          signal?.throwIfAborted();
          if (queue.next > now()) await pause(queue.next - now(), signal);
          signal?.throwIfAborted();
          if (session(req) !== current) throw failure(401, '登录已过期，请重新登录。');
          if(requestProfile==='code-review-64k-v1'){
            if(!codeReviewReady){
              const quota=await trialRequest({action:'quota'},current);
              if(quota.codeReviewProfile!==requestProfile)throw failure(503,'云端尚未启用代码评审的大额度请求，请更新试用服务或使用个人 API。');
              codeReviewReady=true;
            }
            signal?.throwIfAborted();
            data={...data,request_profile:requestProfile};
          }
          queue.next = now() + 5100;
          try { return await (operation ? operation.call(data) : trialRequest(data, current)); }
          catch (error) { if (!error.trialRateLimited || attempt) throw error; }
        }
      });
      queue.tail = work.catch(() => {}).finally(() => { queue.pending--; });
      return work;
    } };
    return config;
  }
  return { handle, callback: async () => { throw failure(400, 'GitHub 登录未完成，请重试。'); }, trialConfig };
}
module.exports = { createCloudBaseAccount };
