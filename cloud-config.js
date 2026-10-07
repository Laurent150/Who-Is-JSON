// Public deployment identifiers only. Authentication and quota enforcement
// remain on CloudBase. Never include an administrator or model API key here.
const defaults = Object.freeze({
  WHO_ACCOUNT_PROVIDER: 'cloudbase',
  WHO_CLOUDBASE_ENV_ID: 'fimi-main-d4g4vod5sad8f3fc5',
  WHO_CLOUDBASE_TRIAL_URL: 'https://fimi-ai-trial-322607-9-1499357271.sh.run.tcloudbase.com/trial',
  WHO_CLOUDBASE_TRIAL_ENABLED: '1',
  WHO_CLOUDBASE_LIBRARY_ENABLED: '1'
});

function releaseCloudEnv(env = process.env) {
  if (env.WHO_ACCOUNT_PROVIDER === 'cloudbase') return { ...env, WHO_SUPABASE_URL: '', WHO_SUPABASE_PUBLISHABLE_KEY: '' };
  if (env.WHO_CLOUD_DISABLED === '1') return { ...env, WHO_SUPABASE_URL: '', WHO_SUPABASE_PUBLISHABLE_KEY: '' };
  const custom = ['WHO_SUPABASE_URL', 'WHO_SUPABASE_PUBLISHABLE_KEY'].some(k => Object.hasOwn(env, k));
  // Explicit deployment settings must never inherit another environment's
  // trial gateway. Only a genuinely unconfigured installation uses defaults.
  const configured = Object.hasOwn(env, 'WHO_ACCOUNT_PROVIDER') || Object.keys(env).some(k => k.startsWith('WHO_CLOUDBASE_'));
  if (!custom && !configured) return { ...env, ...defaults };
  const url = (env.WHO_SUPABASE_URL || '').trim();
  const key = (env.WHO_SUPABASE_PUBLISHABLE_KEY || '').trim();
  if (!!url !== !!key) throw Error('自定义云服务必须同时设置项目 URL 和 publishable key，不能与发布版配置混用。');
  return { ...env, WHO_SUPABASE_URL: url, WHO_SUPABASE_PUBLISHABLE_KEY: key };
}

module.exports = { releaseCloudEnv, defaults };
