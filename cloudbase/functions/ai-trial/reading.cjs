const path = require('node:path');
const fs = require('node:fs');
// Deployment packaging copies these exact shared source files. Repository tests
// load the originals, not another implementation of the model prompts.
const root = fs.existsSync(path.join(__dirname,'runtime/package.json'))
  ? path.join(__dirname,'runtime') : path.join(__dirname,'../../..');
const point = require(path.join(root,'ai-direct-reading.js'));
const moduleReading = require(path.join(root,'ai-module-reading-policy.js'));
const language = require(path.join(root,'ai-language-policy.js'));
const repair = require(path.join(root,'ai-repair-policy.js'));
function prepare(context) {
  let prepared, validate;
  if(context?.kind==='point') {
    prepared=point.fromContext(context);
    validate=raw=>point.decode(raw,prepared);
  } else if(context?.kind==='module') {
    prepared=moduleReading.fromContext(context);
    validate=raw=>moduleReading.decode(raw,prepared.input.scaffold);
  } else if(context?.kind==='language') {
    prepared=language.fromContext(context);
    validate=language.parseLanguage;
  } else if(context?.kind==='repair') {
    prepared=repair.fromContext(context);
    validate=repair.parseRepair;
  } else throw Error('请求格式不正确。');
  const body={messages:prepared.messages,max_tokens:prepared.maxTokens,
    thinking:{type:prepared.thinking==='disabled'?'disabled':'enabled'},
    ...(prepared.reasoningEffort?{reasoning_effort:prepared.reasoningEffort}:{}),
    ...(prepared.json?{response_format:{type:'json_object'}}:{})};
  return {body,validate};
}
module.exports={prepare,PROFILE:point.PROFILE};
