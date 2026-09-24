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
  const sessions = new Map(), limits = new Map();
  async function upstream(route, data, access, method = 'POST') {
    let response;
    try { response = await fetcher(base + route, { method, signal: AbortSignal.timeout(15000), headers: {
      apikey: key, ...(access ? { Authorization: 'Bearer ' + access } : {}), 'Content-Type': 'application/json'
    }, ...(method === 'GET' ? {} : { body: JSON.stringify(data) }) }); }
    catch { throw failure(503, '云端暂时不可用，本地收藏已保留，请稍后重试。'); }
    if (!response.ok) {
      if (response.status === 401 || response.status === 403) throw failure(401, '登录已失效或验证码不正确，请重新登录。');
      if (response.status === 429) throw failure(429, '请求过于频繁，请稍后重试。');
      throw failure(502, '云端操作未完成，请检查验证码或云服务配置。');
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
  function email(value) {
    if (typeof value !== 'string' || value.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())) throw failure(400, '请输入有效邮箱。');
    return value.trim().toLowerCase();
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
    if (route === 'send-code') {
      const address = email(data.email);
      rate('send-all', 10, 3600000); rate('send:' + address, 1, 60000);
      await upstream('/auth/v1/otp', { email: address, create_user: true });
      return { ok: true };
    }
    if (route === 'verify') {
      const address = email(data.email);
      if (typeof data.code !== 'string' || !/^\d{6,10}$/.test(data.code)) throw failure(400, '请输入邮件中的数字验证码。');
      rate('verify-all', 30, 600000);
      const result = await upstream('/auth/v1/verify', { email: address, token: data.code, type: 'email' });
      if (!result?.access_token || !Number.isFinite(result.expires_in) || result.expires_in <= 0) throw failure(502, '云端未返回有效会话。');
      // Confirm identity with the provider, never trust an id supplied by the client.
      const user = await upstream('/auth/v1/user', null, result.access_token, 'GET');
      if (!user?.id || !user.email_confirmed_at || user.email?.toLowerCase() !== address) throw failure(401, '邮箱尚未验证。');
      for (const [id,s] of sessions) if (s.expires <= now()) sessions.delete(id);
      if (sessions.size >= 100) throw failure(429, '本机登录会话过多，请稍后再试。');
      const id = crypto.randomBytes(32).toString('hex');
      sessions.set(id, { access: result.access_token, user: { id: user.id, email: user.email }, expires: now() + Math.min(result.expires_in, 3600) * 1000 });
      return { session: id, user: { id: user.id, email: user.email } };
    }
    const s = session(req);
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
  return { handle };
}
module.exports = { createCloudAccount, validateLibrary };
