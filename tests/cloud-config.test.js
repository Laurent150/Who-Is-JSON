const { test } = require('node:test');
const assert = require('node:assert/strict');
const { releaseCloudEnv, defaults } = require('../cloud-config');
const { createCloudAccount } = require('../cloud-account');

test('release login works without .env and keeps the configured local callback port', async () => {
  const env = releaseCloudEnv({ CODELINGO_PORT: '43127' });
  const account = createCloudAccount({ env, fetcher: () => { throw Error('Unexpected network request'); } });
  assert.deepEqual(await account.handle({}, 'status'), { enabled: true });
  const flow = await account.handle({ headers: { host: '127.0.0.1:43127' } }, 'github-start');
  const url = new URL(flow.url);
  assert.equal(url.origin, defaults.WHO_SUPABASE_URL);
  const redirect = new URL(url.searchParams.get('redirect_to'));
  assert.equal(redirect.origin, 'http://127.0.0.1:43127');
  assert.equal(redirect.pathname, '/auth/callback');
  assert.match(redirect.searchParams.get('state'), /^[a-f0-9]{64}$/);
  assert.match(defaults.WHO_SUPABASE_PUBLISHABLE_KEY, /^sb_publishable_/);
  assert.equal(env.HTTP_PROXY, undefined);
});

test('custom projects never inherit the release project key and can disable accounts', async () => {
  for (const env of [{ WHO_SUPABASE_URL: 'https://other.supabase.co' }, { WHO_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_other' }]) {
    assert.throws(() => releaseCloudEnv(env), /同时设置/);
  }
  const custom = { WHO_SUPABASE_URL: 'https://other.supabase.co', WHO_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_other' };
  assert.deepEqual(releaseCloudEnv(custom), custom);
  for (const env of [{ WHO_CLOUD_DISABLED: '1' }, { WHO_SUPABASE_URL: '', WHO_SUPABASE_PUBLISHABLE_KEY: '' }]) {
    assert.deepEqual(await createCloudAccount({ env: releaseCloudEnv(env) }).handle({}, 'status'), { enabled: false });
  }
  assert.throws(() => createCloudAccount({ env: releaseCloudEnv({ ...custom, WHO_SUPABASE_PUBLISHABLE_KEY: 'sb_secret_invalid' }) }), /管理员/);
  assert.deepEqual(releaseCloudEnv({}).WHO_SUPABASE_URL, defaults.WHO_SUPABASE_URL);
});
