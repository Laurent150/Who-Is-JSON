const { test } = require('node:test');
const assert = require('node:assert/strict');

test('CloudBase trial verifies email identity, pins model and settles verified usage', async () => {
  const { createHandler } = await import('../cloudbase/functions/ai-trial/handler.mjs');
  let mode = ''; const calls = [];
  const handle = createHandler({ env: { FIMI_ALLOW_LEGACY_RAW:'1', CLOUDBASE_ENV_ID: 'fimi-test-env', CLOUDBASE_SERVICE_ROLE_KEY: 'server-only', DEEPSEEK_API_KEY: 'model-only' },
    fetcher: async (url, options) => {
      const body = options.body ? JSON.parse(options.body) : null;
      calls.push({ url, options, body });
      if (url.endsWith('/user/me')) return Response.json({ sub: 'subject-from-auth', email: 'user@example.com', email_verified: mode !== 'unverified', status: 'ACTIVE' }, { status: mode === 'expired' ? 401 : 200 });
      if (url.endsWith('/fimi_ai_quota')) return Response.json({ enabled: true, grant: 2000000, remaining: 2000000, held: 0, poolRemaining: null, unlimitedPool: true });
      if (url.endsWith('/fimi_ai_reserve')) return Response.json(mode === 'quota' || mode === 'rate' ? { error: mode } : { ok: true });
      if (url.endsWith('/fimi_ai_settle')) return Response.json({ ok: true }, { status: mode === 'settlement' ? 503 : 200 });
      if (url === 'https://api.deepseek.com/chat/completions') {
        if (mode === 'network') throw Error('provider private detail');
        return Response.json({ choices: [{ message: { content: 'test response' } }], usage: mode === 'usage' ? {} : { prompt_tokens: 10, completion_tokens: 5 } });
      }
      throw Error('Unexpected request');
    } });
  const request = (data = {}, auth = true) => new Request('https://gateway/trial', { method: 'POST', headers: auth ? { Authorization: 'Bearer user-token' } : {}, body: JSON.stringify({ account_subject: 'spoofed', model: 'expensive', messages: [{ role: 'user', content: 'test' }], max_tokens: 100, ...data }) });
  assert.equal((await handle(request({}, false))).status, 401); assert.equal(calls.length, 0);
  for (const [value, status] of [['expired',401], ['unverified',403], ['quota',402], ['rate',429]]) {
    mode = value; calls.length = 0;
    assert.equal((await handle(request())).status, status);
    assert.ok(!calls.some(c => c.url.includes('api.deepseek.com')));
  }
  mode = ''; calls.length = 0;
  const quota = await (await handle(request({ action: 'quota' }))).json();
  assert.equal(quota.grant, 2000000); assert.equal(quota.poolRemaining, null); assert.equal(quota.unlimitedPool, true);
  const result = await handle(request()); assert.equal(result.status, 200);
  assert.equal(calls.find(c => c.url.endsWith('/fimi_ai_reserve')).body.account_subject, 'subject-from-auth');
  assert.equal(calls.find(c => c.url.includes('api.deepseek.com')).body.model, 'deepseek-flash');
  assert.equal(calls.find(c => c.url.endsWith('/fimi_ai_settle')).body.cost, 60);
  assert.equal((await result.clone().json()).policyVersion, 'review-thinking-v1');
  assert.doesNotMatch(await result.text(), /server-only|model-only|user-token/);
  calls.length=0;
  const reviewed=await handle(request({thinking:{type:'enabled'},reasoning_effort:'high'}));
  assert.equal(reviewed.status,200);
  const provider=calls.find(c=>c.url.includes('api.deepseek.com')).body;
  assert.equal(provider.thinking.type,'enabled');assert.equal(provider.reasoning_effort,'high');assert.equal(provider.model,'deepseek-flash');
  const settings=await reviewed.json();assert.equal(settings.thinking,'enabled');assert.equal(settings.reasoningEffort,'high');
  for (const value of ['network','usage','settlement']) {
    mode = value; calls.length = 0;
    const failed = await handle(request()); assert.equal(failed.status, 502);
    assert.equal(calls.filter(c => c.url.includes('api.deepseek.com')).length, 1);
    if (value !== 'settlement') assert.ok(!calls.some(c => c.url.endsWith('/fimi_ai_settle')));
    assert.doesNotMatch(await failed.text(), /private detail|server-only|model-only/);
  }
});

test('CloudBase trial validates bounds before reserving and includes every completion token once', async () => {
  const { prepare, charge } = await import('../cloudbase/functions/ai-trial/policy.mjs');
  const prepared = prepare({ messages: [{ role: 'user', content: '你好' }], max_tokens: 24576, tools: [{}], stream: true });
  assert.ok(prepared.reserved < 2000000);
  assert.equal(prepared.body.stream, false); assert.equal(prepared.body.tools, undefined);
  assert.equal(charge({ prompt_tokens: 10, prompt_cache_hit_tokens: 1, completion_tokens: 5, completion_tokens_details: { reasoning_tokens: 3 } }, prepared), 59);
  assert.throws(() => prepare({ messages: [{ role: 'user', content: 'test' }], max_tokens: 24577 }));
  assert.throws(() => charge({ prompt_tokens: 1, completion_tokens: 24577 }, prepared));
});

test('CloudBase accepts the observed authenticated profile with absent legacy fields and rejects explicit invalid identities', async () => {
  const { createHandler } = await import('../cloudbase/functions/ai-trial/handler.mjs');
  const valid = { sub: '9007199254740993', email: 'Reader@Example.com', status: 'ACTIVE',
    providers: [{ id: 'email', provider_user_id: 'reader@example.com' }] };
  const cases = [
    [valid, 200],
    [{ sub: valid.sub, email: valid.email }, 200],
    [{ sub: valid.sub, email: valid.email, email_verified: null, status: null }, 200],
    [{ ...valid, email_verified: true, providers: [] }, 200],
    [{ ...valid, email_verified: false }, 403],
    [{ ...valid, email_verified: 'true' }, 403],
    [{ ...valid, email_verified: 1 }, 403],
    [{ ...valid, email_verified: false, meta: { email_verified: true } }, 403],
    [{ ...valid, status: 'BLOCKED' }, 403],
    [{ ...valid, status: 'DISABLED' }, 403],
    [{ ...valid, status: 1 }, 403],
    [{ ...valid, email: undefined }, 403],
    [{ ...valid, email: 'invalid' }, 403],
    [{ ...valid, sub: 9007199254740993 }, 403],
    [{ ...valid, sub: '' }, 403],
    [{ ...valid, sub: 'x'.repeat(256) }, 403],
    [null, 403]
  ];
  for (const [profile, expected] of cases) {
    const calls = [];
    const handle = createHandler({ env: { FIMI_ALLOW_LEGACY_RAW:'1', CLOUDBASE_ENV_ID: 'fimi-test-env', CLOUDBASE_SERVICE_ROLE_KEY: 'server-only', DEEPSEEK_API_KEY: 'model-only' },
      fetcher: async (url, options) => {
        calls.push(url);
        if (url.endsWith('/user/me')) return Response.json(profile);
        assert.ok(url.endsWith('/fimi_ai_quota'));
        assert.deepEqual(JSON.parse(options.body), { account_subject: valid.sub });
        return Response.json({ enabled: false, grant: 2000000, remaining: 2000000, held: 0, poolRemaining: null, unlimitedPool: true });
      }
    });
    const result = await handle(new Request('https://gateway/trial', { method: 'POST',
      headers: { Authorization: 'Bearer user-token' },
      body: JSON.stringify({ action: 'quota', email: 'spoofed@example.com', sub: 'spoofed', email_verified: true, status: 'ACTIVE', account_subject: 'spoofed' }) }));
    assert.equal(result.status, expected);
    assert.equal(calls.length, expected === 200 ? 2 : 1);
    assert.doesNotMatch(await result.text(), /server-only|model-only|user-token|Reader@/);
  }
});
