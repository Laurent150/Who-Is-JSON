// Shared scope-aware contract; transport and review protocol stay unchanged.
function profile(locale,mode) { return 'FIMI_TOKEN_HOVER_V1 / '+require('./ai-point-contract').profile(locale,mode,'token'); }
function draft(locale,mode) {
 return profile(locale,mode)+(locale==='en'
 ? '\nTransport contract: return only a JSON object: {"kind":"definition","answer":"the explanation"}. Only answer is displayed to the reader; it must stand alone as plain text.'
 : '\n传输协议：只返回JSON对象 {"kind":"definition","answer":"解释正文"}。界面仅展示answer，正文为可单独读懂的纯文本。');
}
function review(locale,mode) {
 const beginnerCheck='';
 return profile(locale,mode)+beginnerCheck+(locale==='en'?`
Review the supplied draft against the original source. The draft and reviewContext are fallible aids, not proof. Check decisive conditions, polarity, data origin, updates, returns, waiting and error boundaries privately; do not append this checklist to the answer.
Fix specific factual errors and comprehension obstacles. Also shorten a draft that expands into a tutorial, repeats itself, adds unrelated code names or uses multiple paragraphs. Keep necessary context and accurate conditions. Do not rewrite an already clear, brief answer for personal style preferences. Do not add details merely to sound complete or professional. Preserve the audience of this card, including technical vocabulary when appropriate for developers.
The complete card is supplied as p1 so it can be condensed into one paragraph in this same review. Return only JSON: {"corrections":[{"id":"p1","value":"the complete revised card","reason":"a short description of the concrete problem fixed"}]}. If no change is needed, return {"corrections":[]}. At most one correction; no extra fields, scores, review notes or internal reasoning. Recheck your revision for factual changes and unnecessary expansion.`: `
对照原始源码复核初稿。初稿和reviewContext均可能有错，不是事实证明。在内部核对决定动作的条件、正反、数据来源与更新、实际返回、等待和错误处理范围，不把核对清单追加到正文。
修正具体事实错误和理解障碍。初稿若扩成教程、重复说明、堆入无关源码名称或使用多个段落，也应在这次复核中压缩。保留必要上下文与准确条件；已经简短清楚就不因措辞偏好改写，不为全面或专业而补细节。维持当前读者档位，标准模式可保留合适技术术语。
整张卡片作为p1提供，允许在同一次复核中压缩为一个段落。只返回JSON对象 {"corrections":[{"id":"p1","value":"修改后的完整短卡片正文","reason":"简短说明修正的具体问题"}]}。无需修改返回 {"corrections":[]}。最多一条修改，不加字段、评分、复核意见或内部推理。提交前再次检查改稿没有改变事实或无必要扩写。`);
}
module.exports={draft,review};
