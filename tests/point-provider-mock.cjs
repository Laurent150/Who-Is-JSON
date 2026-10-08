// Explicit test-only preload. Production never imports this file.
const original=globalThis.fetch;
const origin=process.env.WHO_POINT_MOCK_BASE;
if(!origin||new URL(origin).hostname!=='127.0.0.1')throw Error('Local mock origin required');
globalThis.fetch=(url,options)=>{
 const target=new URL(url);
 if(target.origin==='https://api.deepseek.com')return original(new URL(target.pathname,origin),options);
 return original(url,options);
};
