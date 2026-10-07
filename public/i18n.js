(function(root,factory){const api=factory(root);if(typeof module==='object'&&module.exports)module.exports=api;else root.WhoI18n=api;})(globalThis,function(root){
 const normalize=value=>String(value||'').toLowerCase().startsWith('en')?'en':'zh-CN';
 let locale='en';
 try{const saved=root.localStorage?.getItem('whoisjson.locale');locale=saved==='en'||saved==='zh-CN'?saved:'en';}catch{}
 function t(key,...values){const text=locale==='en'?(root.WhoEnglish?.[key]??key):key;return String(text).replace(/\{(\d+)\}/g,(match,n)=>n<values.length?String(values[n]):match);}
 // Error details are not source or AI prose. Only display recognized messages;
 // unknown provider/browser text gets a localized fallback in either language.
 function error(value){
  const message=typeof value==='string'?value:value?.message;
  const dictionary=root.WhoEnglish||{};
  const key=typeof message==='string'&&(Object.hasOwn(dictionary,message)?message:Object.keys(dictionary).find(key=>dictionary[key]===message));
  if(key)return t(key);
  if(value?.name==='TimeoutError')return t('等待超时，请重试。');
  if(value?.name==='AbortError')return t('请求已取消。');
  if(value?.name==='TypeError'&&/^(Failed to fetch|NetworkError when attempting to fetch resource\.?|Load failed|fetch failed)$/i.test(message||''))return t('网络连接失败，请检查网络后重试。');
  return t('请求未完成。');
 }
 function set(value){locale=normalize(value);try{root.localStorage?.setItem('whoisjson.locale',locale);}catch{}return locale;}
 return {t,error,set,normalize,get locale(){return locale;}};
});
