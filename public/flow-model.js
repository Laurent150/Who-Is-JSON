// Shared, read-only flow scaffold. AI cannot replace parser ranges or call targets.
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.WhoFlowModel=factory();})(typeof globalThis!=='undefined'?globalThis:this,function(){
const keys={children:'内部步骤',otherwise:'条件不成立',afterLoop:'循环正常结束',handlers:'异常处理',afterSuccess:'正常完成',finalizer:'离开时收尾'};
function scaffold(result,start,locale='zh-CN',selection) {
 const block=result.blocks.find(b=>b.start===start&&(!selection||((selection.end===undefined||b.end===selection.end)&&(selection.role===undefined||b.role===selection.role)&&(!selection.blockId||b.blockId===selection.blockId))));
 if(!block)throw Error('找不到选中的功能，请重新分析。');
 let count=0;
 function walk(nodes){return (nodes||[]).map(n=>{
  if(++count>120)throw Error('这个功能超过 120 个步骤，请选择更小的功能或源码片段。');
  const node={id:'n'+count,kind:n.kind||'step',start:n.start,end:n.end,...(Number.isInteger(n.startColumn)&&Number.isInteger(n.endColumn)?{startColumn:n.startColumn,endColumn:n.endColumn}:{}),terminal:!!n.terminal,branches:[]};
  for(const [key,label]of Object.entries(keys))if(n[key]?.length)node.branches.push({label:key==='children'?(n.kind==='condition'?'条件成立':n.kind==='loop'?'继续循环':'内部步骤'):label,nodes:walk(n[key])});
  if(n.kind==='condition'&&!node.branches.some(b=>b.label==='条件不成立'))node.branches.push({label:'条件不成立',nodes:[]});
  return node;
 });}
 const nodes=walk(block.controlFlow||block.configurationNodes||[]);
 if(!nodes.length)nodes.push({id:'n1',kind:'unknown',start:block.start,end:block.end,branches:[]});
 const all=[];const collect=ns=>ns.forEach(n=>{all.push(n);n.branches.forEach(b=>collect(b.nodes));});collect(nodes);
 for(const call of result.framework?.links||[]){
  if(call.fromStart!==block.start && !(block.kind==='module'&&call.fromStart===0))continue;
  const owner=all.filter(n=>n.start<=call.line&&n.end>=call.line).sort((a,b)=>(a.end-a.start)-(b.end-b.start))[0];
  if(owner)(owner.calls||=[]).push({name:call.name,start:call.toStart,line:call.line});
 }
 if(locale==='en'){const labels={'内部步骤':'Inner steps','条件成立':'Condition is true','条件不成立':'Condition is false','继续循环':'Continue the loop','循环正常结束':'Loop completes normally','异常处理':'Handle an error','正常完成':'Complete without an error','离开时收尾':'Cleanup on exit'};const localize=ns=>ns.forEach(n=>n.branches.forEach(b=>{b.label=labels[b.label]||b.label;localize(b.nodes);}));localize(nodes);}
 return {name:block.title,start:block.start,end:block.end,nodes};
}
return {scaffold};
});
