const {mockFinalAudit}=require('./final-audit-mock.cjs');
// Legacy direct pipeline regression; the release default is tested separately.
process.env.WHO_TALK_PIPELINE='direct';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {settings,parseTalk}=require('../ai-talk');
test('AI talk preserves authored prose and exports without invented source links',()=>{
 const authored={title:'购物车怎样计算金额',sections:[{title:'从一笔购物说起',text:'假设买了两件商品，我们先把价格相加，再计算折扣。'}],questions:[{question:'为什么没有显示金额？',answer:'返回结果与显示结果不同。'}]};
 const result=parseTalk(JSON.stringify(authored),'cart.py',settings());
 assert.equal(result.origin,'ai');assert.equal(result.sections[0].text,authored.sections[0].text);assert.equal(result.sections[0].index,null);
 assert.match(require('../public/presentation').markdown(result),/假设买了两件/);
});
test('AI talk rejects invalid preferences and incomplete model output',()=>{
 assert.throws(()=>settings({duration:'999'}),/设置无效/);
 for(const text of ['oops','null','{"title":"x","sections":[],"questions":[]}','{"title":"x","sections":[{"title":"x"}],"questions":[]}'])assert.throws(()=>parseTalk(text,'x',settings()),/完整/);
});

test('localized nontechnical guidance reaches draft and review without changing other audiences or source',async()=>{
 const {generateTalk}=require('../ai-talk');
 const source='function total(价格) {\r\n  return 价格.reduce((sum, value) => sum + value, 0);\r\n}';
 const audienceLabels={en:{beginner:'Audience — introductory understanding',peer:'Audience — programming colleague',review:'Audience — code reviewer'},'zh-CN':{beginner:'受众—入门理解',peer:'受众—有基础的同事',review:'受众—代码评审参与者'}};
 const detailLabels={en:{brief:'Brief',standard:'Standard',detailed:'Detailed'},'zh-CN':{brief:'简要',standard:'标准',detailed:'详细'}};
 for(const locale of ['zh-CN','en'])for(const readingMode of ['beginner','standard'])for(const audience of ['nontechnical','beginner','peer','review'])for(const detail of ['brief','standard','detailed'])for(const coverage of ['full','highlights']){
  const seen=[];
  const config={base:'https://example.org',model:'test',sponsoredCall:async body=>{const audit=mockFinalAudit(body);if(audit)return audit;
   seen.push(body);
   return {choices:[{finish_reason:'stop',message:{content:seen.length===1?JSON.stringify({title:'Total',sections:[{title:'Result',text:'Return the sum of the supplied prices.'}],questions:[]}):'{"corrections":[]}'}}]};
  }};
  const result=await generateTalk(source,'total.js',{audience,detail,coverage},config,{locale,readingMode});
  assert.equal(seen.length,2);
  for(const body of seen){
   const policy=body.messages.filter(m=>m.role==='system').map(m=>m.content).join('\n');
   if(locale==='zh-CN'&&['nontechnical','beginner'].includes(audience)){
    assert.match(policy,/面向没有编程背景的成年读者/);
    assert.match(policy,/默认不用生活类比/);
    assert.match(policy,/明确触发条件、数据变化和失败结果/);
    assert.match(policy,/先说实际含义，再给术语名称/);
    assert.match(policy,/不把理解正文所需的解释推迟到术语表/);
   }else if(locale==='en'&&['nontechnical','beginner'].includes(audience)){
    assert.match(policy,/write for adults without a programming background/);
    assert.match(policy,/avoid everyday analogies by default/);
    assert.match(policy,/Preserve triggering conditions, data changes and failure outcomes/);
    assert.match(policy,/actual meaning before naming the technical term/);
    assert.match(policy,/defer an essential explanation to a glossary/);
   }else assert.doesNotMatch(policy,/中文非技术讲解稿|English nontechnical walkthrough/);
   if(locale==='en')assert.doesNotMatch(policy,/[\u4e00-\u9fff]/);
   else assert.doesNotMatch(policy,/English nontechnical walkthrough/);
   for(const [value,label]of Object.entries(audienceLabels[locale]))assert.equal(policy.includes(label),value===(audience==='nontechnical'?'beginner':audience));
   for(const [value,label]of Object.entries(detailLabels[locale]))assert.equal(policy.includes((locale==='en'?'Detail — ':'详略—')+label+ (locale==='en'?':':'：')),value===detail);
   assert.equal(policy.includes(locale==='en'?'Coverage — Full:':'范围—完整：'),coverage==='full');
   assert.equal(policy.includes(locale==='en'?'Coverage — Highlights:':'范围—重点：'),coverage==='highlights');
   assert.match(policy,locale==='en'?readingMode==='beginner'?/BEGINNER MODE/:/STANDARD MODE/:readingMode==='beginner'?/当前为零基础友好模式/:/当前为标准模式/);
   assert.doesNotMatch(policy,/以下风格优先于原提示中的详略|For a selected line or token/);
   const payload=JSON.parse(body.messages.find(m=>m.role==='user').content);
   assert.equal(payload.source,source);
   assert.equal(payload.coverage,coverage);
   assert.equal(payload.detail,detailLabels[locale][detail]);
  }
  assert.equal(result.sections[0].text,'Return the sum of the supplied prices.');
 }
});
