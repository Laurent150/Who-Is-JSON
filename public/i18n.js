(function(root,factory){const api=factory(root);if(typeof module==='object'&&module.exports)module.exports=api;else root.WhoI18n=api;})(globalThis,function(root){
 const normalize=value=>String(value||'').toLowerCase().startsWith('en')?'en':'zh-CN';
 let locale=String(root.navigator?.language||'zh').toLowerCase().startsWith('zh')?'zh-CN':'en';
 try{const saved=root.localStorage?.getItem('whoisjson.locale');locale=saved==='en'||saved==='zh-CN'?saved:(String(root.navigator?.language||'zh').toLowerCase().startsWith('zh')?'zh-CN':'en');}catch{}
 function t(key,...values){const text=locale==='en'?(root.WhoEnglish?.[key]??key):key;return String(text).replace(/\{(\d+)\}/g,(match,n)=>n<values.length?String(values[n]):match);}
 function set(value){locale=normalize(value);try{root.localStorage?.setItem('whoisjson.locale',locale);}catch{}return locale;}
 return {t,set,normalize,get locale(){return locale;}};
});
