// Opt-in local evaluation only. Never persist or return a connection/key.
const fs=require('node:fs'),path=require('node:path');
function prepare(config,env=process.env){
 if(env.WHO_TALK_EVAL_TRACE!=='1'||env.WHO_CLOUD_DISABLED!=='1'||!env.WHO_TALK_EVAL_OUTPUT)return null;
 const file=path.resolve(env.WHO_TALK_EVAL_OUTPUT,'model-comparison.json');
 if(!fs.existsSync(file))return null;
 const setting=JSON.parse(fs.readFileSync(file,'utf8'));
 if(setting.enabled!==true){
  const metadata={requestedModel:config?.model,reportedModels:[]};
  const options={onProviderModel:model=>metadata.reportedModels.push(model)};
  if(setting.asyncFocusRules===true){options.asyncFocusRules=true;metadata.asyncFocusRules=true;}
  if(setting.introComposition==='purpose-first'){
   options.introComposition=setting.introComposition;metadata.introComposition=setting.introComposition;
  }
  if(setting.captureFlashText===true&&config?.model==='deepseek-flash'){
   const id='flash-'+Date.now()+'-'+require('node:crypto').randomUUID();
   metadata.observationId=id;
   const phases=[];
   options.onModelText=(text,phase)=>{phases.push({phase,text});fs.writeFileSync(path.join(path.dirname(file),id+'.json'),JSON.stringify({metadata,phases},null,2)+'\n');};
  }
  return {config,metadata,options};
 }
 if(setting.model!=='deepseek-v4-pro'||!Number.isInteger(setting.limit)||setting.limit<1||setting.limit>6||!Number.isInteger(setting.used)||setting.used<0)throw Error('Invalid evaluation model budget');
 if(config?.base!=='https://api.deepseek.com'||config.model!=='deepseek-flash'||config.sponsoredCall)throw Error('Comparison requires the existing personal DeepSeek connection');
 if(setting.used>=setting.limit)throw Error('Approved Pro comparison limit reached');
 // Single local test worker. Reserve an attempt before any network call, including failures.
 setting.used++;fs.writeFileSync(file,JSON.stringify(setting,null,2)+'\n');
 const metadata={requestedModel:setting.model,reportedModels:[],comparisonAttempt:setting.used,comparisonLimit:setting.limit};
 const save=()=>fs.writeFileSync(path.join(path.dirname(file),'model-observation-'+setting.used+'.json'),JSON.stringify(metadata,null,2)+'\n');
 save();
 return {config:{...config,model:setting.model},metadata,options:{evaluationModelComparison:true,onProviderModel:model=>{metadata.reportedModels.push(model);save();},onModelText:(text,phase)=>{
  if(['contracts','contract-repair','composition','draft','review','repair'].includes(phase))fs.writeFileSync(path.join(path.dirname(file),'model-output-'+setting.used+'-'+phase+'.json'),JSON.stringify({phase,text},null,2)+'\n');
 }}};
}
module.exports={prepare};
