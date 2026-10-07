// Small, dependency-free OOXML exporter. Runs locally in the browser; no model call.
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.WhoWalkthroughDocx=api;})(globalThis,function(){
 const ns='http://schemas.openxmlformats.org/wordprocessingml/2006/main';
 const declaration='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
 const xml=value=>String(value??'').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g,'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
 function run(text,code=false){return '<w:r>'+(code?'<w:rPr><w:rStyle w:val="InlineCode"/></w:rPr>':'')+String(text).split(/(\t|\r?\n)/).map(part=>part==='\t'?'<w:tab/>':/\n/.test(part)?'<w:br/>':'<w:t xml:space="preserve">'+xml(part)+'</w:t>').join('')+'</w:r>';}
 function paragraph(text,style='Normal'){
  const content=style==='Code'?run(text):String(text??'').split(/(`[^`\n]+`)/).map(part=>part.startsWith('`')&&part.endsWith('`')?run(part.slice(1,-1),true):run(part)).join('');
  return '<w:p><w:pPr><w:pStyle w:val="'+style+'"/></w:pPr>'+content+'</w:p>';
 }
 function body(text){
  let code=false;return String(text??'').replace(/\r\n?/g,'\n').split('\n').map(line=>{
   if(/^\s*```/.test(line)){code=!code;return '';}
   return paragraph(line,code?'Code':'Normal');
  }).join('');
 }
 const styles=declaration+`<w:styles xmlns:w="${ns}">
 <w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:eastAsia="Microsoft YaHei"/><w:color w:val="35482E"/><w:sz w:val="23"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="140" w:line="300" w:lineRule="auto"/><w:widowControl/></w:pPr></w:pPrDefault></w:docDefaults>
 <w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>
 <w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:pPr><w:keepNext/><w:spacing w:before="120" w:after="280"/></w:pPr><w:rPr><w:b/><w:color w:val="29472F"/><w:sz w:val="40"/></w:rPr></w:style>
 <w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:pPr><w:keepNext/><w:keepLines/><w:spacing w:before="320" w:after="140"/><w:outlineLvl w:val="0"/></w:pPr><w:rPr><w:b/><w:color w:val="29472F"/><w:sz w:val="30"/></w:rPr></w:style>
 <w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:basedOn w:val="Heading1"/><w:pPr><w:outlineLvl w:val="1"/></w:pPr><w:rPr><w:sz w:val="25"/></w:rPr></w:style>
 <w:style w:type="paragraph" w:styleId="Code"><w:name w:val="Code"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:after="0" w:line="260"/><w:shd w:fill="F2F5ED"/><w:ind w:left="140" w:right="140"/></w:pPr><w:rPr><w:rFonts w:ascii="Consolas" w:hAnsi="Consolas"/><w:sz w:val="21"/></w:rPr></w:style>
 <w:style w:type="character" w:styleId="InlineCode"><w:name w:val="Inline code"/><w:rPr><w:rFonts w:ascii="Consolas" w:hAnsi="Consolas"/><w:color w:val="29472F"/><w:shd w:fill="F2F5ED"/></w:rPr></w:style>
 <w:style w:type="paragraph" w:styleId="Caption"><w:name w:val="caption"/><w:basedOn w:val="Normal"/><w:rPr><w:color w:val="708064"/><w:sz w:val="20"/></w:rPr></w:style>
 </w:styles>`;
 // ZIP store entries (no compression), UTF-8, CRC32, standard central directory.
 function zip(files){
  const encode=new TextEncoder(),parts=[],entries=[];let offset=0;
  const crc=data=>{let n=0xffffffff;for(const b of data){n^=b;for(let i=0;i<8;i++)n=(n>>>1)^((n&1)?0xedb88320:0);}return (n^0xffffffff)>>>0;};
  const header=(size,signature)=>{const bytes=new Uint8Array(size),view=new DataView(bytes.buffer);view.setUint32(0,signature,true);return {bytes,view};};
  for(const [path,text] of Object.entries(files)){
   const name=encode.encode(path),data=encode.encode(text),sum=crc(data),h=header(30,0x04034b50),v=h.view;
   v.setUint16(4,20,true);v.setUint16(6,0x800,true);v.setUint16(12,33,true);v.setUint32(14,sum,true);v.setUint32(18,data.length,true);v.setUint32(22,data.length,true);v.setUint16(26,name.length,true);
   parts.push(h.bytes,name,data);entries.push({name,size:data.length,sum,offset});offset+=30+name.length+data.length;
  }
  const central=offset;
  for(const e of entries){const h=header(46,0x02014b50),v=h.view;v.setUint16(4,20,true);v.setUint16(6,20,true);v.setUint16(8,0x800,true);v.setUint16(14,33,true);v.setUint32(16,e.sum,true);v.setUint32(20,e.size,true);v.setUint32(24,e.size,true);v.setUint16(28,e.name.length,true);v.setUint32(42,e.offset,true);parts.push(h.bytes,e.name);offset+=46+e.name.length;}
  const end=header(22,0x06054b50);end.view.setUint16(8,entries.length,true);end.view.setUint16(10,entries.length,true);end.view.setUint32(12,offset-central,true);end.view.setUint32(16,central,true);parts.push(end.bytes);
  const result=new Uint8Array(offset+22);let cursor=0;for(const part of parts){result.set(part,cursor);cursor+=part.length;}return result;
 }
 function create(p,locale='en'){
  if(!Array.isArray(p?.sections)||!p.sections.length)throw new Error('请先生成讲解稿。');
  const en=locale==='en';let content=paragraph('FIMI','Caption')+paragraph(p.title|| (en?'Code walkthrough':'代码讲解稿'),'Title');
  for(const section of p.sections){
   content+=paragraph(section.title,'Heading1')+body(section.text);
   if(section.start)content+=paragraph(en?`Source: lines ${section.start}–${section.end}`:`源码：第 ${section.start}—${section.end} 行`,'Caption');
  }
  if(p.questions?.length){content+=paragraph(en?'Follow-up questions':'可能被追问','Heading1');for(const q of p.questions)content+=paragraph(q.question,'Heading2')+body(q.answer);}
  const document=declaration+`<w:document xmlns:w="${ns}"><w:body>${content}<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1080" w:right="1080" w:bottom="1080" w:left="1080"/></w:sectPr></w:body></w:document>`;
  return zip({
   '[Content_Types].xml':declaration+'<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>',
   '_rels/.rels':declaration+'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
   'word/document.xml':document,'word/styles.xml':styles,
   'word/_rels/document.xml.rels':declaration+'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>'
  });
 }
 return {create,mime:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'};
});
