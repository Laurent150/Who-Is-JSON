const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createCloudAccount } = require('../cloud-account');
const { releaseCloudEnv } = require('../cloud-config');
const env = { WHO_ACCOUNT_PROVIDER: 'cloudbase', WHO_CLOUDBASE_ENV_ID: 'fimi-test-env' };
function setup({ existing = false, library = false, uid = 'user-1', trial = false, trialUrl = 'https://trial.example/trial' } = {}) {
  let mode = '', time = 0, release;
  const calls = [], req = { headers: {} };
  const account = createCloudAccount({ env: releaseCloudEnv({ ...env, WHO_CLOUDBASE_LIBRARY_ENABLED: library ? '1' : '0', ...(trial ? {WHO_CLOUDBASE_TRIAL_ENABLED:'1',WHO_CLOUDBASE_TRIAL_URL:trialUrl} : {}) }), now: () => time, pause: async (ms, signal) => { signal?.throwIfAborted(); time += ms; },
    fetcher: async (url, options) => {
      const route = new URL(url).pathname, body = options.body ? JSON.parse(options.body) : undefined;
      calls.push({ url, route, body, options });
      if (url === 'https://trial.example/trial') {
        if (mode === 'trial-offline') throw Error('private network detail');
        if (mode === 'trial-error') return Response.json({ error: 'private upstream detail' }, { status: 502 });
        if (body.action === 'quota') return Response.json({enabled:true,remaining:2000000,held:0,grant:2000000,poolRemaining:null,unlimitedPool:true,currency:'CNY',unit:1000000});
        return Response.json({choices:[{message:{content:'ok'}}]});
      }
      if (mode === 'offline') throw Error('private network detail');
      if (mode === 'captcha') return Response.json({ error: 'captcha_required' }, { status: 400 });
      if (route === '/auth/v1/verification') return Response.json({ verification_id: 'provider-id', expires_in: 600, is_user: existing });
      if (route === '/auth/v1/verification/verify') {
        if (mode === 'bad') return Response.json({ error: 'invalid_verification_code' }, { status: 400 });
        if (mode === 'pending') await new Promise(resolve => { release = resolve; });
        return Response.json({ verification_token: 'verification-secret' });
      }
      if (route === '/auth/v1/signin' || route === '/auth/v1/signup') return Response.json({ access_token: 'provider-secret', refresh_token: 'refresh-secret', expires_in: 7200, sub: uid });
      if (route === '/auth/v1/user/me') return Response.json({ sub: mode === 'wrong-id' ? 'user-2' : uid, email: mode === 'wrong-email' ? 'other@example.com' : 'reader@example.com', status: mode === 'disabled' ? 'DISABLED' : 'ACTIVE', email_verified: mode !== 'unverified' });
      if (route === '/v1/rdb/rest/fimi_libraries') return Response.json(['own', 'numeric', 'leak'].includes(mode)
        ? [{ user_id: mode === 'leak' ? 'other' : mode === 'numeric' ? Number(uid) : uid, revision: 1, payload: { cards: [], knowledge: [] } }] : []);
      if (route === '/v1/rdb/rest/rpc/fimi_save_library') return Response.json(mode === 'conflict' ? { conflict: true } : { revision: body.expected_revision + 1 });
      if (route === '/auth/v1/user/signout') return Response.json({});
      throw Error('Unexpected route ' + route);
    } });
  return { account, req, calls, mode: value => { mode = value; }, time: value => { time = value; }, release: () => release(),
    start: locale => account.handle(req, 'email-start', { email: ' Reader@Example.com ', locale }),
    async login(locale) { const flow = await this.start(locale); const result = await account.handle(req, 'email-verify', { ticket: flow.ticket, code: '123456', email: 'attacker@example.com' }); req.headers['x-who-session'] = result.session; return result; } };
}
test('CloudBase is explicit, respects disabled accounts and never mixes Supabase credentials', async () => {
  const config = releaseCloudEnv({ ...env, WHO_SUPABASE_URL: 'https://old.supabase.co', WHO_SUPABASE_PUBLISHABLE_KEY: 'old' });
  assert.equal(config.WHO_SUPABASE_URL, ''); assert.equal(config.WHO_SUPABASE_PUBLISHABLE_KEY, '');
  const account = createCloudAccount({ env: { ...config, WHO_CLOUD_DISABLED: '1' } });
  assert.equal((await account.handle({}, 'status')).enabled, false);
  await assert.rejects(account.handle({}, 'email-start', { email: 'reader@example.com' }), { status: 503 });
  for (const value of ['https://bad.example', '../secret', 'abc?redirect=evil', 'a'.repeat(65)]) assert.throws(() => createCloudAccount({ env: { ...env, WHO_CLOUDBASE_ENV_ID: value } }));
});
test('new and existing email identities use the documented distinct flows, with private tokens', async () => {
  for (const existing of [false, true]) {
    const s = setup({ existing }); const result = await s.login('en');
    assert.deepEqual(s.calls.map(c => c.route), ['/auth/v1/verification', '/auth/v1/verification/verify', existing ? '/auth/v1/signin' : '/auth/v1/signup', '/auth/v1/user/me']);
    assert.deepEqual(s.calls[0].body, { email: 'reader@example.com', target: 'ANY' });
    assert.equal(s.calls[1].body.verification_id, 'provider-id');
    assert.equal(s.calls[2].body.verification_token, 'verification-secret');
    assert.ok(s.calls.every(c => c.options.headers['Accept-Language'] === 'en-US' && c.options.redirect === 'error'));
    assert.equal(new Set(s.calls.map(c => c.options.headers['x-device-id'])).size, 1);
    assert.doesNotMatch(JSON.stringify(result), /provider-secret|refresh-secret|verification-secret|provider-id/);
    assert.equal(result.user.id, 'cloudbase:fimi-test-env:user-1');
    assert.equal((await s.account.handle(s.req, 'me')).user.email, 'reader@example.com');
    await s.account.handle(s.req, 'logout'); await assert.rejects(s.account.handle(s.req, 'me'), { status: 401 });
  }
});
test('CloudBase language is frozen for each email flow and expires locally', async () => {
  const s = setup(); await s.login('zh-CN');
  assert.ok(s.calls.every(c => c.options.headers['Accept-Language'] === 'zh-CN'));
  assert.equal(s.calls[2].body.locale, 'zh');
  s.time(3600001); await assert.rejects(s.account.handle(s.req, 'me'), { status: 401 });
});
test('CloudBase rejects mismatched, disabled and explicitly unverified profiles', async () => {
  for (const mode of ['wrong-id', 'wrong-email', 'disabled', 'unverified']) {
    const s = setup(); s.mode(mode); await assert.rejects(s.login(), { status: 401 });
    await assert.rejects(s.account.handle(s.req, 'me'), { status: 401 });
  }
});
test('CloudBase limits sends and bad codes, and never replays an uncertain verification', async () => {
  const s = setup(), flow = await s.start();
  await assert.rejects(s.start(), { status: 429 }); s.mode('bad');
  for (let i = 0; i < 5; i++) await assert.rejects(s.account.handle(s.req, 'email-verify', { ticket: flow.ticket, code: '123456' }), { status: 400 });
  const count = s.calls.length;
  await assert.rejects(s.account.handle(s.req, 'email-verify', { ticket: flow.ticket, code: '123456' }), { status: 400 }); assert.equal(s.calls.length, count);
  s.time(60001); s.mode(''); const next = await s.start(); s.mode('offline');
  await assert.rejects(s.account.handle(s.req, 'email-verify', { ticket: next.ticket, code: '123456' }), e => e.status === 503 && !e.message.includes('private'));
  s.mode(''); const before = s.calls.length;
  await assert.rejects(s.account.handle(s.req, 'email-verify', { ticket: next.ticket, code: '123456' }), { status: 400 }); assert.equal(s.calls.length, before);
});
test('CloudBase cancelled and concurrent attempts cannot create a user or mint a session', async () => {
  const s = setup(), flow = await s.start(); s.mode('pending');
  const work = s.account.handle(s.req, 'email-verify', { ticket: flow.ticket, code: '123456' });
  await assert.rejects(s.account.handle(s.req, 'email-verify', { ticket: flow.ticket, code: '123456' }), { status: 409 });
  await s.account.handle(s.req, 'email-cancel', { ticket: flow.ticket }); s.release();
  await assert.rejects(work, { status: 400 });
  assert.equal(s.calls.length, 2);
});
test('CloudBase reports CAPTCHA without bypassing it or claiming an email was sent', async () => {
  const s = setup(); s.mode('captcha'); await assert.rejects(s.start(), e => e.status === 409 && e.message.includes('人机验证'));
  assert.equal(s.calls.length, 1);
});
test('CloudBase auth-only mode cannot fake cloud saves or grant AI credits', async () => {
  const s = setup(); await s.login();
  assert.equal((await s.account.handle(s.req, 'status')).libraryEnabled, false);
  await assert.rejects(s.account.handle(s.req, 'save', {}), { status: 503 });
  await assert.rejects(s.account.handle(s.req, 'library'), { status: 503 });
  assert.equal((await s.account.handle(s.req, 'trial-quota')).enabled, false);
  assert.throws(() => s.account.trialConfig(s.req), { status: 403 });
});
test('CloudBase library rejects cross-account records, wrong owner and revision conflicts', async () => {
  const s = setup({ library: true }); const login = await s.login();
  assert.deepEqual((await s.account.handle(s.req, 'library')).payload, { cards: [], knowledge: [] });
  s.mode('leak'); await assert.rejects(s.account.handle(s.req, 'library'), { status: 502 }); s.mode('');
  const body = { userId: login.user.id, revision: 0, payload: { cards: [], knowledge: [] } };
  await assert.rejects(s.account.handle(s.req, 'save', { ...body, userId: 'other' }), { status: 409 });
  assert.deepEqual(await s.account.handle(s.req, 'save', body), { revision: 1 });
  s.mode('conflict'); await assert.rejects(s.account.handle(s.req, 'save', body), { status: 409 });
  assert.equal(s.calls.at(-1).options.headers.Authorization, 'Bearer provider-secret');
  assert.equal(s.calls.at(-1).body.userId, undefined);
});

test('CloudBase library preserves opaque JWT subjects without numeric coercion or truncation', async () => {
  for (const uid of ['9007199254740993', 'subject-' + 'x'.repeat(247)]) {
    const s = setup({ library: true, uid });
    const login = await s.login();
    assert.equal(login.user.id, `cloudbase:fimi-test-env:${uid}`);
    s.mode('own');
    const library = await s.account.handle(s.req, 'library');
    assert.equal(library.revision, 1);
    assert.equal(library.user.id, login.user.id);
    s.mode('numeric');
    await assert.rejects(s.account.handle(s.req, 'library'), { status: 502 });
    s.mode('leak');
    await assert.rejects(s.account.handle(s.req, 'library'), { status: 502 });
  }
});

test('CloudBase sponsored calls use only user tokens, serialize and never retry unknown failures', async () => {
  const s=setup({trial:true}); await s.login();
  assert.equal((await s.account.handle(s.req,'status')).trialEnabled,true);
  assert.equal((await s.account.handle(s.req,'trial-quota')).grant,2000000);
  const config=s.account.trialConfig(s.req);
  await Promise.all([config.sponsoredCall({messages:[]}),config.sponsoredCall({messages:[]})]);
  const calls=s.calls.filter(c=>c.route==='/trial');
  assert.equal(calls.length,3);
  assert.ok(calls.every(c=>c.options.headers.Authorization==='Bearer provider-secret'));
  assert.equal(config.key,undefined);
  s.mode('trial-error');
  await assert.rejects(config.sponsoredCall({}),e=>e.status===502&&!e.message.includes('private'));
  assert.equal(s.calls.filter(c=>c.route==='/trial').length,4);
  const cancelled=new AbortController();cancelled.abort();
  await assert.rejects(config.sponsoredCall({},{signal:cancelled.signal}));
  assert.equal(s.calls.filter(c=>c.route==='/trial').length,4);
});

test('CloudBase console origins resolve to the gateway route and quota outages do not imply a paid reservation', async () => {
  for (const trialUrl of ['https://trial.example', 'https://trial.example/', 'https://trial.example/trial']) {
    const s=setup({trial:true,trialUrl});await s.login();
    assert.equal((await s.account.handle(s.req,'trial-quota')).grant,2000000);
    assert.equal(s.calls.at(-1).url,'https://trial.example/trial');
    s.mode('trial-offline');
    await assert.rejects(s.account.handle(s.req,'trial-quota'),{status:503,message:'额度服务暂时不可用。'});
    await assert.rejects(s.account.trialConfig(s.req).sponsoredCall({}),{status:503,message:'AI 调用未完成，预留额度待核对，请勿反复重试。'});
  }
});
