const {modelCall}=require('./ai-client');
const {analyze}=require('./analyzer');
const names={Python:'source.py',JavaScript:'source.js',TypeScript:'source.ts',Java:'source.java',Shell:'source.sh',Dockerfile:'Dockerfile',Gitignore:'.gitignore',JSON:'source.json',YAML:'source.yaml',HTML:'source.html',CSS:'source.css',SQL:'source.sql'};
const unsupported=['C','C++','Go','Rust','C#','PHP','Ruby','MATLAB','unknown'];
function needsLanguageHelp(result){
 return result.language==='未确定'||['invalid','unsupported'].includes(result.status)||!!result.syntaxErrors||(!result.blocks.length&&['Python','JavaScript','TypeScript','Java'].includes(result.language));
}
const {parseLanguage}=require('./ai-language-policy');
function analyzeAs(code,name,python,language){
 if(!Object.hasOwn(names,language))throw Error('不支持该语言的结构解析。');
 // Preserve subtype/config filenames when they already match the identified language.
 const matching=require('./public/file-types').language(name)===language;
 return analyze(code,matching?name:names[language],python);
}
async function identify(code,name,python,result,config,request={},call=modelCall){
 if(!needsLanguageHelp(result))return result;
 const attach=(status,language,message)=>({...result,languageIdentification:{status,language,originalLanguage:result.language,message}});
 try{
  const input={filename:String(name||'').slice(0,200),source:code,localLanguage:result.language,localStatus:result.status};
  const text=await call(config,require('./ai-language-policy').messages(input,request.locale),{...request,json:true,maxTokens:250,readingContext:{kind:'language',input,locale:request.locale}});
  const guess=parseLanguage(text);
  if(guess.confidence!=='high'||guess.language==='unknown')return attach('uncertain',guess.language,'AI 未能确定语言，保留本地结果。');
  if(!Object.hasOwn(names,guess.language))return attach('unsupported',guess.language,'AI 判断为 '+guess.language+'，当前没有对应的本地结构解析器；仍可点读源码。');
  const candidate=analyzeAs(code,name,python,guess.language);
  if(!['ready','partial'].includes(candidate.status)||candidate.syntaxErrors||!candidate.blocks.length)return attach('unverified',guess.language,'AI 判断为 '+guess.language+'，但本地解析未确认有效结构，保留原结果。');
  return {...candidate,languageIdentification:{status:'verified',language:guess.language,originalLanguage:result.language,message:'AI 辅助识别为 '+guess.language+'；结构和源码位置已由本地解析。'}};
 }catch(error){
  if(request.signal?.aborted)throw error;
  return attach('failed',result.language,'AI 辅助识别未完成：'+error.message+' 保留本地结果。');
 }
}
module.exports={needsLanguageHelp,parseLanguage,analyzeAs,identify};
