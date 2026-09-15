(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.WhoStructure=api;})(this,function(){
 function modules(result){const all=result.blocks||[];if(result.language==='Shell')return all.filter(b=>['module','function'].includes(b.kind)).map(b=>({block:b,index:all.indexOf(b)}));const named=all.filter(b=>b.kind==='function'&&(b.reusable||result.language==='Python'));
  if(result.language==='Java')named.sort((a,b)=>Number(!!a.constructorMethod)-Number(!!b.constructorMethod));
  if(named.length)return (result.language==='Python'?all.filter(b=>b.kind==='module'||b.kind==='function'):named).map(b=>({block:b,index:all.indexOf(b)}));
  const roots=all.filter(b=>!all.some(p=>p!==b&&p.start<=b.start&&p.end>=b.end&&(p.start<b.start||p.end>b.end)));
  return roots.map(b=>({block:b,index:all.indexOf(b)}));
 }
 function flowNodes(nodes){return (nodes||[]).flatMap(n=>[n,...['children','otherwise','afterLoop','handlers','afterSuccess','finalizer'].flatMap(k=>flowNodes(n[k]))]);}
 return {modules,flowNodes};
});
