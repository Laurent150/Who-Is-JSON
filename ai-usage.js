// Provider counters only. Never store credentials, source, prompts or reasoning.
function count(value){return Number.isSafeInteger(value)&&value>=0?value:null;}
function record(usage,phase){
 return {phase,inputTokens:count(usage?.prompt_tokens),outputTokens:count(usage?.completion_tokens),totalTokens:count(usage?.total_tokens),reasoningTokens:count(usage?.completion_tokens_details?.reasoning_tokens),cachedInputTokens:count(usage?.prompt_cache_hit_tokens)};
}
function summary(calls){
 const sum=key=>calls.length>0&&calls.every(c=>c[key]!==null)?calls.reduce((n,c)=>n+c[key],0):null;
 return {calls:calls.map(c=>({...c})),inputTokens:sum('inputTokens'),outputTokens:sum('outputTokens'),totalTokens:sum('totalTokens'),reasoningTokens:sum('reasoningTokens'),cachedInputTokens:sum('cachedInputTokens')};
}
module.exports={record,summary};
