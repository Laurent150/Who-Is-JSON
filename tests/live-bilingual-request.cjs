// Only constructs requests; importing this module cannot call a paid service.
const questions = {
  token: {
    'zh-CN': '解释选中词语；简单定义不需要知识卡。',
    en: 'Explain the selected token. A simple definition does not need a knowledge card.'
  },
  beginner: {
    'zh-CN': '请只用一两句解释 selectedSource 在做什么。像朋友指着这一行回答；没有必要就不要举例，不补充下一步或术语背景。',
    en: 'Explain only what selectedSource does in one or two natural sentences, as if helping a friend read this line. Add an example only if necessary. Do not automatically add next steps or background terminology.'
  },
  standard: {
    'zh-CN': '请只解释 selectedSource：先说这一步做什么，再用很小的假设输入说明数据变化，最后说明下一步。术语就地用日常中文解释，不猜作者动机。',
    en: "Explain only selectedSource: start with what it does, use a tiny hypothetical example to show the data changes, then explain what happens next. Define necessary terms in plain English. Do not guess the author's intent."
  }
};
function buildRequest(sample, code, config, locale, readingMode, profile = 'ui') {
  if (!['ui','zh-stress'].includes(profile)) throw Error('Unknown evaluation profile');
  if (!['zh-CN','en'].includes(locale) || !['beginner','standard'].includes(readingMode)) throw Error('Invalid variant');
  const payload = {code, name:sample.file, config, locale, readingMode};
  if (sample.task === 'overview') return {route:'analyze',payload:{...payload,ai:true}};
  if (sample.task === 'flow') return {route:'flow',payload:{...payload,start:sample.start,languageHint:sample.language}};
  if (sample.task === 'talk') return {route:'talk',payload:{...payload,options:{audience:'beginner',detail:'brief',coverage:'full'}}};
  const language = profile === 'zh-stress' ? 'zh-CN' : locale;
  payload.selection = sample.selection;
  payload.question = questions[sample.task === 'token' ? 'token' : readingMode][language];
  if (sample.task === 'token') Object.assign(payload,{token:sample.token,knowledge:true});
  return {route:'ask',payload};
}
module.exports = {buildRequest,questions};
