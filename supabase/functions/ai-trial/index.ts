import { prepare, charge, MODEL } from './policy.mjs';

const base=Deno.env.get('SUPABASE_URL')!;
const service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const secret=Deno.env.get('DEEPSEEK_API_KEY');
const reply=(status:number,data:unknown)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
async function rpc(name:string,data:unknown) {
 const r=await fetch(base+'/rest/v1/rpc/'+name,{method:'POST',headers:{apikey:service,Authorization:'Bearer '+service,'Content-Type':'application/json'},body:JSON.stringify(data),signal:AbortSignal.timeout(10000)});
 if(!r.ok)throw Error('额度服务暂时不可用。');
 return r.json();
}
Deno.serve(async req=>{
 if(req.method!=='POST')return reply(405,{error:'POST required'});
 if(!secret)return reply(503,{error:'平台试用尚未启用。'});
 // Explicit Auth server verification also supports asymmetric project JWTs.
 const authorization=req.headers.get('authorization')||'';
 if(!authorization.startsWith('Bearer ')||authorization.length>10000)return reply(401,{error:'请先登录。'});
 let github:string;
 try {
  const r=await fetch(base+'/auth/v1/user',{headers:{apikey:service,Authorization:authorization},signal:AbortSignal.timeout(10000)});
  if(!r.ok)return reply(401,{error:'登录已过期，请重新登录。'});
  const user=await r.json();
  const identity=user.identities?.find((x:any)=>x.provider==='github');
  github=String(identity?.identity_data?.sub||identity?.provider_id||'');
  if(!/^[0-9]{1,24}$/.test(github))return reply(403,{error:'需要 GitHub 账户。'});
 }catch{return reply(503,{error:'暂时无法验证登录。'});}
 let data:any;
 try {
  const reader=req.body?.getReader();if(!reader)throw Error();
  const chunks:Uint8Array[]=[];let size=0;
  while(true){const part=await reader.read();if(part.done)break;size+=part.value.length;if(size>120000){await reader.cancel();return reply(413,{error:'请求过大。'});}chunks.push(part.value);}
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
  data=JSON.parse(new TextDecoder().decode(bytes));
 }catch{return reply(400,{error:'请求格式不正确。'});}
 try {
  if(data.action==='quota')return reply(200,{...await rpc('who_ai_quota',{github_account:github}),model:MODEL});
  const prepared=prepare(data),id=crypto.randomUUID();
  const reserved=await rpc('who_ai_reserve',{github_account:github,request_id:id,amount:prepared.reserved});
  if(!reserved.ok)return reply(reserved.error==='busy'||reserved.error==='rate'?429:402,{error:reserved.error==='disabled'?'平台试用已暂停。':reserved.error==='busy'?'上一笔调用仍在处理或待核对。':reserved.error==='rate'?'请稍后再试。':'个人或平台试用额度不足，可改用自己的 AI。'});
  // Once sent, never auto-refund an ambiguous failure and never retry the model.
  let result:any;
  try {
   const r=await fetch('https://api.deepseek.com/chat/completions',{method:'POST',redirect:'error',headers:{Authorization:'Bearer '+secret,'Content-Type':'application/json'},body:JSON.stringify(prepared.body),signal:AbortSignal.timeout(110000)});
   if(!r.ok){await r.body?.cancel();throw Error();}
   result=await r.json();
   const cost=charge(result.usage,prepared);
   await rpc('who_ai_settle',{request_id:id,cost});
  }catch{return reply(502,{error:'AI 调用未完成，预留额度待核对，请勿反复重试。',requestId:id});}
  return reply(200,{choices:result.choices,usage:result.usage,model:MODEL});
 }catch(e){return reply(400,{error:e instanceof Error?e.message:'请求未完成。'});}
});
