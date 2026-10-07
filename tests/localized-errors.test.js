const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function setup(){
 const ctx=vm.createContext({});
 for(const file of ['locale-en','i18n'])vm.runInContext(fs.readFileSync(require.resolve('../public/'+file),'utf8'),ctx);
 return ctx.WhoI18n;
}
test('known errors localize in both directions, including errors created before switching language',()=>{
 const i18n=setup(),zh='未能确认邮箱身份。',en=i18n.t(zh),beforeSwitch=Error(en);
 assert.equal(i18n.error(Error(zh)),en);
 i18n.set('zh-CN');assert.equal(i18n.error(beforeSwitch),zh);assert.equal(i18n.error(zh),zh);
 i18n.set('en');assert.equal(i18n.error(Error(zh)),en);
});
test('unknown upstream and native errors never leak raw text and always use the selected language',()=>{
 const i18n=setup();
 for(const locale of ['en','zh-CN']){
  i18n.set(locale);
  for(const value of [Error('服务故障：内部详情'),Error('Unknown provider error: internal details'),new SyntaxError('Unexpected token <'),null,undefined,{},'constructor','toString']){
   assert.equal(i18n.error(value),i18n.t('请求未完成。'));
  }
  assert.equal(i18n.error({name:'TimeoutError',message:'native detail'}),i18n.t('等待超时，请重试。'));
  assert.equal(i18n.error({name:'AbortError',message:'native detail'}),i18n.t('请求已取消。'));
  assert.equal(i18n.error(new TypeError('Failed to fetch')),i18n.t('网络连接失败，请检查网络后重试。'));
 }
 // Ordinary localization deliberately does not rewrite user source or generated prose.
 assert.equal(i18n.t('const 中文 = "原文";'),'const 中文 = "原文";');
});

test('language identification notices localize every status without rendering upstream prose',()=>{
 const i18n=setup(),ctx=vm.createContext({uiText:i18n.t});
 const app=fs.readFileSync(require.resolve('../public/app'),'utf8');
 vm.runInContext(app.slice(app.indexOf('function languageHelpNotice('),app.indexOf('async function run(')),ctx);
 assert.equal(ctx.languageHelpNotice(null),'');
 for(const locale of ['en','zh-CN']){
  i18n.set(locale);
  for(const status of ['verified','uncertain','unsupported','unverified','failed','unknown']){
   const text=ctx.languageHelpNotice({status,language:'Python',message:'后台中文或 upstream error details'});
   assert.ok(text.length);assert.doesNotMatch(text,/后台|upstream/);
   if(locale==='en')assert.doesNotMatch(text,/[\u3400-\u9fff]/);else assert.match(text,/[\u3400-\u9fff]/);
  }
 }
});
