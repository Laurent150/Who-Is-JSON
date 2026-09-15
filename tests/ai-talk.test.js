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
