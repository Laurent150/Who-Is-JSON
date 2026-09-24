// Public project identifiers only. Authorization is enforced by Supabase RLS.
// Never put an OAuth client secret or a service_role key in this file.
const defaults = Object.freeze({
  WHO_SUPABASE_URL: 'https://shzvxzxcdvferoixsabd.supabase.co',
  WHO_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_1BqD4doJxkkAh6vNbM-XYw_8Q7CiXgb'
});

function releaseCloudEnv(env = process.env) {
  if (env.WHO_CLOUD_DISABLED === '1') return { ...env, WHO_SUPABASE_URL: '', WHO_SUPABASE_PUBLISHABLE_KEY: '' };
  const custom = ['WHO_SUPABASE_URL', 'WHO_SUPABASE_PUBLISHABLE_KEY'].some(k => Object.hasOwn(env, k));
  if (!custom) return { ...env, ...defaults };
  const url = (env.WHO_SUPABASE_URL || '').trim();
  const key = (env.WHO_SUPABASE_PUBLISHABLE_KEY || '').trim();
  if (!!url !== !!key) throw Error('自定义云服务必须同时设置项目 URL 和 publishable key，不能与发布版配置混用。');
  return { ...env, WHO_SUPABASE_URL: url, WHO_SUPABASE_PUBLISHABLE_KEY: key };
}

module.exports = { releaseCloudEnv, defaults };
