const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
test('English failure notices cannot leak Chinese even with missing or faulty translations',()=>{
 const ctx=vm.createContext({});for(const file of ['locale-en','i18n'])vm.runInContext(fs.readFileSync(require.resolve('../public/'+file),'utf8'),ctx);
 ctx.WhoI18n.set('en');
 ctx.WhoEnglish['模拟漏翻译']='中文错误';
 for(const message of ['额度服务暂时不可用。','AI 生成失败，本次使用的试用额度已返还。','未知中文服务端错误','模拟漏翻译']){
  for(const trialRefund of [undefined,'refunded','refund_pending']){
   const text=ctx.WhoI18n.error({message,trialRefund});assert.doesNotMatch(text,/[\u3400-\u9fff]/);
   if(trialRefund==='refunded')assert.match(text,/returned/);
   if(trialRefund==='refund_pending')assert.match(text,/not yet confirmed/);
  }
 }
 ctx.WhoI18n.set('zh-CN');assert.match(ctx.WhoI18n.error({message:'未知错误',trialRefund:'refunded'}),/已返还/);
});
