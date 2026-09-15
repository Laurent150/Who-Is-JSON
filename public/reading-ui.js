// All lessons retain the language and the exact source location they explain.
function appendCodeLessons(host,source,language,{start=1,title='例子里的符号与写法 · 点开逐个看',knownParts=[]}={}) {
 const report=WhoReading.lessons(source,language),box=element('details',undefined,'code-lessons');
 const lines=source.split('\n'),offsets=[0];for(let i=0;i<lines.length-1;i++)offsets.push(offsets[i]+lines[i].length+1);
 const covered=new Set();for(const p of knownParts){const row=p.start-start;if(row<0||row>=lines.length||p.end!==p.start)continue;const offset=offsets[row]+p.startColumn;if(source.slice(offset,offset+p.text.length)!==p.text)continue;covered.add(offset);report.parts=report.parts.filter(x=>x.offset!==offset);report.parts.push({...p,start:row+1,end:row+1,offset});}
 report.parts.sort((a,b)=>a.offset-b.offset);const unique=new Map();for(const p of report.parts){const key=p.text+'\0'+p.plain;if(!unique.has(key))unique.set(key,p);}report.parts=[...unique.values()];
 report.unknown=[...new Set(report.unknownTokens.filter(t=>!covered.has(t.start)).map(t=>t.text))];
 box.append(element('summary',title));
 if(!report.parts.length&&!report.unknown.length)return;
 const buttons=element('div',undefined,'reading-links'),panel=element('div',undefined,'reading-lesson');panel.hidden=true;
 let active;const close=element('button','收起，继续读代码');close.onclick=()=>{panel.hidden=true;buttons.querySelectorAll('button').forEach(b=>b.setAttribute('aria-expanded','false'));active?.focus({preventScroll:true});};
 for(const part of report.parts){const button=element('button',part.text+' · 第 '+(start+part.start-1)+' 行');button.type='button';button.setAttribute('aria-expanded','false');button.onclick=()=>{active=button;buttons.querySelectorAll('button').forEach(b=>b.setAttribute('aria-expanded',String(b===button)));panel.replaceChildren(element('strong',part.text+' · 在这里的作用'),element('p',part.plain),close);panel.hidden=false;};buttons.append(button);}
 box.append(buttons,panel);
 if(report.unknown.length)box.append(element('p','本组尚未展开的符号：'+report.unknown.join('、')+'。其他知识卡可能另有说明。','tiny'));
 host.append(box);
}
function appendRelatedSyntax(host,card){
 const lang=card.language;const names=card.naming||'';
 const keys=['for','in','while','await','async'].filter(k=>new RegExp('\\b'+k+'\\b').test(names));
 if(!keys.length)return;
 const links=element('div',undefined,'reading-links');const panel=element('div',undefined,'reading-lesson');panel.hidden=true;
 for(const key of keys){let source=card.example;if(key==='while'&&!/\bwhile\b/.test(source))source=lang==='Python'?'while count < 3:\n    count += 1':lang==='Shell'?'while check; do work; done':'while (count < 3) { count += 1; }';const part=WhoReading.lessons(source,lang).parts.find(p=>p.text===key);if(!part)continue;
  const b=element('button',key+' · 查看这里的用法');b.type='button';b.setAttribute('aria-expanded','false');b.onclick=()=>{links.querySelectorAll('button').forEach(x=>x.setAttribute('aria-expanded',String(x===b)));const close=element('button','收起');close.onclick=()=>{panel.hidden=true;b.setAttribute('aria-expanded','false');b.focus();};panel.replaceChildren(element('strong',key),element('p',part.plain),close);panel.hidden=false;};links.append(b);
 }
 if(links.children.length)host.append(links,panel);
}
function appendFunctionIdentity(host,block){
 const identity=WhoReading.identity(block,current.language);if(!identity.facts.length)return;
 const box=element('details',undefined,'function-identity');box.append(element('summary','上面的源码名称分别表示什么？'));
 for(const fact of identity.facts){const p=element('p');p.append(element('code',fact.name),document.createTextNode('：'+fact.plain));box.append(p);}
 host.append(box);
}
