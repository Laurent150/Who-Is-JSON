const crypto = require('node:crypto');

const emptyLibrary = () => ({ knowledge: [], cards: [] });
function failure(status, message) { const e = new Error(message); e.status = status; return e; }
function validateLibrary(value) {
  if (!value || !Array.isArray(value.knowledge) || !Array.isArray(value.cards) ||
      value.knowledge.length > 500 || value.cards.length > 60 ||
      Buffer.byteLength(JSON.stringify(value)) > 2_000_000) throw failure(400, '收藏超过容量或格式不正确。');
  for (const x of value.knowledge) {
    if (!x || typeof x.id !== 'string' || !x.card ||
        !['id','title','plain','naming','example','result','pitfall'].every(k => typeof x.card[k] === 'string') ||
        !Array.isArray(x.sources) || !x.sources.every(s => s && ['file','code','context'].every(k => typeof s[k] === 'string') &&
          Number.isInteger(s.start) && Number.isInteger(s.end) && s.start >= 1 && s.end >= s.start)) throw failure(400, '知识收藏格式不正确。');
  }
  for (const x of value.cards) if (!x || !['string','number'].includes(typeof x.id) || typeof x.title !== 'string' || typeof x.code !== 'string') throw failure(400, '功能收藏格式不正确。');
  return { knowledge: value.knowledge, cards: value.cards };
}

function createCloudAccount({ env = process.env, fetcher = fetch, now = Date.now } = {}) {
  const base = (env.WHO_SUPABASE_URL || '').replace(/\/$/, '');
  const key = env.WHO_SUPABASE_PUBLISHABLE_KEY || '';
  const enabled = !!(base && key);
  if (base) {
    const url = new URL(base);
    if (url.protocol !== 'https:' || !/^[a-z0-9-]+\.supabase\.co$/.test(url.hostname) || url.pathname !== '/' || url.search || url.hash || url.username || url.password || url.port) throw Error('云服务必须是有效的 HTTPS Supabase 项目地址。');
  }
  let legacyRole;
  try { legacyRole = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString()).role; } catch {}
  if (key.startsWith('sb_secret_') || legacyRole === 'service_role') throw Error('账户服务只能使用 publishable / anon key，不能使用管理员密钥。');
  const sessions = new Map(), limits = new Map(), flows = new Map();
  async function upstream(route, data, access, method = 'POST') {
    let response;
    try { response = await fetcher(base + route, { method, signal: AbortSignal.timeout(route === '/functions/v1/ai-trial' ? 125000 : 15000), headers: {
      apikey: key, ...(access ? { Authorization: 'Bearer ' + access } : {}), 'Content-Type': 'application/json'
    }, ...(method === 'GET' ? {} : { body: JSON.stringify(data) }) }); }
    catch { throw failure(503, '云端暂时不可用，本地收藏已保留，请稍后重试。'); }
    if (!response.ok) {
      if (route === '/functions/v1/ai-trial') {
        let data; try { data = await response.json(); } catch {}
        throw failure(response.status, typeof data?.error === 'string' ? data.error.slice(0, 200) : '平台试用暂时不可用。');
      }
      if (response.status === 401 || response.status === 403) throw failure(401, '登录已失效，请重新登录。');
      if (response.status === 429) throw failure(429, '请求过于频繁，请稍后重试。');
      throw failure(502, '云端操作未完成，请检查 GitHub 登录或云服务配置。');
    }
    if (response.status === 204) return null;
    try { return await response.json(); } catch { throw failure(502, '云端返回格式不正确。'); }
  }
  function rate(name, count, period) {
    const t = now();
    for (const [k,v] of limits) if (v.until <= t) limits.delete(k);
    const entry = limits.get(name) || { n: 0, until: t + period };
    if (entry.n >= count) throw failure(429, '请求过于频繁，请稍后重试。');
    entry.n++; limits.set(name, entry);
  }
  function pruneFlows() {
    for (const [id,flow] of flows) if (flow.expires <= now()) flows.delete(id);
  }
  async function callback(params) {
    pruneFlows();
    const state = params.get('state');
    const flow = [...flows.values()].find(x => x.state === state && x.status === 'pending');
    if (!flow) throw failure(400, '登录请求已过期，请回到应用重新登录。');
    flow.status = 'exchanging'; // Consume before awaiting: callback replay cannot exchange twice.
    try {
      const code = params.get('code');
      if (params.has('error') || params.has('error_code') || !code || code.length > 2048) throw failure(400, 'GitHub 登录未完成，请重试。');
      const result = await upstream('/auth/v1/token?grant_type=pkce', { auth_code: code, code_verifier: flow.verifier });
      if (!result?.access_token || !Number.isFinite(result.expires_in) || result.expires_in <= 0) throw failure(502, '云端未返回有效会话。');
      const user = await upstream('/auth/v1/user', null, result.access_token, 'GET');
      if (typeof user?.id !== 'string' || !user.identities?.some(x => x.provider === 'github')) throw failure(401, '未能确认 GitHub 身份。');
      const identity = user.identities.find(x => x.provider === 'github');
      const name = identity.identity_data?.user_name || identity.identity_data?.preferred_username || user.email || 'GitHub 用户';
      flow.result = { access: result.access_token, user: { id: user.id, name: String(name), email: user.email || '' }, expires: now() + Math.min(result.expires_in, 3600) * 1000 };
      flow.status = 'complete';
    } catch (error) { flow.status = 'failed'; flow.error = error.message; }
    finally { delete flow.verifier; }
    return { ok: flow.status === 'complete' };
  }
  function session(req) {
    for (const [id,s] of sessions) if (s.expires <= now()) sessions.delete(id);
    const s = sessions.get(req.headers['x-who-session']);
    if (!s) throw failure(401, '请先登录账户。');
    return s;
  }
  async function handle(req, route, data = {}) {
    if (route === 'status') return { enabled };
    if (!enabled) throw failure(503, '云端账户尚未配置，仍可使用本地收藏。');
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw failure(400, '账户请求格式不正确。');
    pruneFlows();
    if (route === 'github-start') {
      rate('login-all', 20, 600000);
      const port = String(env.CODELINGO_PORT || 43127);
      const host = req.headers.host;
      if (![`localhost:${port}`, `127.0.0.1:${port}`].includes(host)) throw failure(400, '登录来源无效。');
      const ticket = crypto.randomBytes(32).toString('hex'), state = crypto.randomBytes(32).toString('hex');
      const verifier = crypto.randomBytes(48).toString('base64url');
      const redirect = new URL('http://' + host + '/auth/callback');
      redirect.searchParams.set('state', state);
      const url = new URL(base + '/auth/v1/authorize');
      url.searchParams.set('provider', 'github');
      url.searchParams.set('redirect_to', redirect.href);
      url.searchParams.set('code_challenge', crypto.createHash('sha256').update(verifier).digest('base64url'));
      url.searchParams.set('code_challenge_method', 's256');
      flows.set(ticket, { state, verifier, status: 'pending', expires: now() + 600000 });
      return { ticket, url: url.href };
    }
    if (route === 'github-poll' || route === 'github-cancel') {
      const flow = flows.get(data.ticket);
      if (!flow) throw failure(401, '登录请求已过期，请重新登录。');
      if (route === 'github-cancel') { flows.delete(data.ticket); return { ok: true }; }
      if (flow.status === 'failed') { flows.delete(data.ticket); throw failure(401, flow.error); }
      if (flow.status !== 'complete') return { pending: true };
      flows.delete(data.ticket);
      for (const [id,s] of sessions) if (s.expires <= now()) sessions.delete(id);
      if (sessions.size >= 100) throw failure(429, '本机登录会话过多，请稍后再试。');
      if (flow.result.expires <= now()) throw failure(401, '登录已过期，请重新登录。');
      const id = crypto.randomBytes(32).toString('hex');
      sessions.set(id, flow.result);
      return { session: id, user: flow.result.user };
    }
    const s = session(req);
    if (route === 'trial-quota') return upstream('/functions/v1/ai-trial', { action: 'quota' }, s.access);
    if (route === 'logout') {
      sessions.delete(req.headers['x-who-session']);
      // Local session is invalid immediately even if remote sign-out is unavailable.
      try { await upstream('/auth/v1/logout?scope=local', {}, s.access); } catch {}
      return { ok: true };
    }
    if (route === 'library') {
      const rows = await upstream('/rest/v1/who_libraries?select=revision,payload', null, s.access, 'GET');
      if (!Array.isArray(rows) || rows.length > 1) throw failure(502, '云端收藏权限配置不正确。');
      const row = rows[0];
      if (row && (!Number.isSafeInteger(row.revision) || row.revision < 0)) throw failure(502, '云端收藏版本不正确。');
      return { user: s.user, revision: row?.revision || 0, payload: row ? validateLibrary(row.payload) : emptyLibrary() };
    }
    if (route === 'save') {
      if (data.userId !== s.user.id) throw failure(409, '账户已变化，请重新打开收藏库。');
      if (!Number.isSafeInteger(data.revision) || data.revision < 0) throw failure(400, '收藏版本无效。');
      const payload = validateLibrary(data.payload);
      const result = await upstream('/rest/v1/rpc/who_save_library', { expected_revision: data.revision, new_payload: payload }, s.access);
      if (result?.conflict) throw failure(409, '其他设备已更新收藏。请先导出本机备份，再重新载入云端收藏。');
      if (!Number.isSafeInteger(result?.revision) || result.revision !== data.revision + 1) throw failure(502, '云端未确认保存，本地收藏已保留。');
      return { revision: result.revision };
    }
    throw failure(404, '未找到账户操作。');
  }
  function trialConfig(req) {
    const s = session(req);
    return { base: 'https://api.deepseek.com', model: 'deepseek-flash',
      sponsoredCall: data => upstream('/functions/v1/ai-trial', data, s.access) };
  }
  return { handle, callback, trialConfig };
}
module.exports = { createCloudAccount, validateLibrary };
