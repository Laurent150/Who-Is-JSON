const {modelCall}=require('./ai-client');

const {parseRepair}=require('./ai-repair-policy');

async function repair(code,name,config,request={}) {
 if(typeof code!=='string'||!code.trim()||Buffer.byteLength(code)>100000)throw Error('请选择不超过 100 KB 的源码。');
 const input={filename:String(name||'').slice(0,200),source:code};
 const text=await modelCall(config,require('./ai-repair-policy').messages(input,request.locale),{...request,json:true,maxTokens:16000,readingContext:{kind:'repair',input,locale:request.locale}});
 return parseRepair(text);
}
module.exports={repair,parseRepair};
