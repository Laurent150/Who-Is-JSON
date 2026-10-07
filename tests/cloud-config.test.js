const { test } = require('node:test');
const assert = require('node:assert/strict');
const { releaseCloudEnv, defaults } = require('../cloud-config');
const { createCloudAccount } = require('../cloud-account');

test('unconfigured releases use the verified CloudBase email and trial deployment', async () => {
  const env = releaseCloudEnv({ CODELINGO_PORT: '43127' });
  const account = createCloudAccount({ env, fetcher: () => { throw Error('Unexpected network request'); } });
  assert.deepEqual(await account.handle({}, 'status'), { enabled: true, provider: 'cloudbase', emailEnabled: true, githubEnabled: false, libraryEnabled: true, trialEnabled: true });
  assert.equal(env.WHO_CLOUDBASE_ENV_ID, 'fimi-main-d4g4vod5sad8f3fc5');
  assert.equal(new URL(env.WHO_CLOUDBASE_TRIAL_URL).pathname, '/trial');
  assert.equal(env.CODELINGO_PORT, '43127');
  assert.equal(env.WHO_SUPABASE_URL, undefined);
  assert.equal(env.WHO_SUPABASE_PUBLISHABLE_KEY, undefined);
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
  assert.equal(releaseCloudEnv({}).WHO_CLOUDBASE_ENV_ID, defaults.WHO_CLOUDBASE_ENV_ID);
});

test('custom CloudBase settings never inherit public trial or library configuration', async () => {
  for (const input of [
    { WHO_ACCOUNT_PROVIDER: 'cloudbase', WHO_CLOUDBASE_ENV_ID: 'custom-env' },
    { WHO_ACCOUNT_PROVIDER: 'cloudbase' },
    { WHO_ACCOUNT_PROVIDER: 'supabase' },
    { WHO_CLOUDBASE_ENV_ID: 'custom-env' }
  ]) {
    const env = releaseCloudEnv(input), status = await createCloudAccount({ env }).handle({}, 'status');
    assert.equal(env.WHO_CLOUDBASE_TRIAL_URL, undefined);
    assert.equal(env.WHO_CLOUDBASE_TRIAL_ENABLED, undefined);
    assert.equal(env.WHO_CLOUDBASE_LIBRARY_ENABLED, undefined);
    assert.equal(status.trialEnabled === true, false);
  }
  const configured = { ...defaults, WHO_CLOUDBASE_ENV_ID: 'custom-env', WHO_CLOUDBASE_TRIAL_URL: 'https://trial.example/trial', WHO_CLOUDBASE_TRIAL_ENABLED: '0', WHO_CLOUDBASE_LIBRARY_ENABLED: '0' };
  const env = releaseCloudEnv(configured);
  assert.equal(env.WHO_CLOUDBASE_TRIAL_URL, configured.WHO_CLOUDBASE_TRIAL_URL);
  const status = await createCloudAccount({ env }).handle({}, 'status');
  assert.equal(status.trialEnabled, false);assert.equal(status.libraryEnabled, false);
  assert.equal((await createCloudAccount({env:releaseCloudEnv({...defaults,WHO_CLOUD_DISABLED:'1'})}).handle({},'status')).enabled,false);
});

test('custom Supabase remains supported and keeps the configured callback port', async () => {
  const env = releaseCloudEnv({WHO_SUPABASE_URL:'https://other.supabase.co',WHO_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_other',CODELINGO_PORT:'43127'});
  const account = createCloudAccount({env,fetcher:()=>{throw Error('Unexpected network request');}});
  const flow = await account.handle({headers:{host:'127.0.0.1:43127'}},'github-start');
  const url = new URL(flow.url),redirect = new URL(url.searchParams.get('redirect_to'));
  assert.equal(url.origin,'https://other.supabase.co');assert.equal(redirect.origin,'http://127.0.0.1:43127');
  assert.equal(redirect.pathname,'/auth/callback');assert.match(redirect.searchParams.get('state'),/^[a-f0-9]{64}$/);
  assert.equal(env.WHO_CLOUDBASE_ENV_ID,undefined);
});
