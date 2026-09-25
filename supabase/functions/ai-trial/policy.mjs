export const MODEL = 'deepseek-flash';
// Conservative peak rates in micro-CNY per token, checked 2026-09-25.
// https://api-docs.deepseek.com/zh-cn/quick_start/pricing/
export function prepare(input) {
  if (!input || !Array.isArray(input.messages) || input.messages.length < 1 || input.messages.length > 20) throw Error('请求格式不正确。');
  const messages = input.messages.map(m => {
    if (!m || !['system','user','assistant'].includes(m.role) || typeof m.content !== 'string') throw Error('试用额度目前仅支持文字，请使用本地图片识别。');
    return {role:m.role,content:m.content};
  });
  const bytes = new TextEncoder().encode(JSON.stringify(messages)).length;
  if (bytes > 100000) throw Error('内容过长，请缩小代码范围。');
  if (!Number.isSafeInteger(input.max_tokens) || input.max_tokens < 1 || input.max_tokens > 8192) throw Error('输出长度超过试用限制。');
  const inputBound = bytes + messages.length * 1024 + 1024;
  const reserved = inputBound * 2 + input.max_tokens * 8;
  const body = {model:MODEL,messages,stream:false,max_tokens:input.max_tokens,thinking:{type:'disabled'}};
  if (input.response_format?.type === 'json_object') body.response_format = {type:'json_object'};
  return {body,reserved,inputBound};
}
export function charge(usage, prepared) {
  const p=usage?.prompt_tokens, c=usage?.completion_tokens;
  const hit=usage?.prompt_cache_hit_tokens ?? 0;
  if (![p,c,hit].every(x=>Number.isSafeInteger(x)&&x>=0) || hit>p || p>prepared.inputBound || c>prepared.body.max_tokens) throw Error('用量数据异常，预留额度待核对。');
  // Peak-rate equivalent credits: deliberately never underestimate provider cost.
  return Math.ceil((p-hit)*2 + hit*0.04 + c*8);
}
