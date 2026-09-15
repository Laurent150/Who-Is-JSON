function lineAt(code,pos){return code.slice(0,Math.max(0,pos)).split('\n').length;}
function block(code,start,end,kind,title,purpose,extra={}){const a=lineAt(code,start),b=lineAt(code,Math.max(start,end-1));return {kind,title,start:a,end:b,purpose,inputs:'',output:'',usage:'',concept:'',dependencies:'',symbols:[],...extra,code:code.split('\n').slice(a-1,b).join('\n')};}
function result(language,parser,summary,purpose,blocks,warnings=[],status='ready'){return {language,parser,summary,purpose,blocks,mode:'local',status,warnings};}
function symbol(name,origin,meaning,rename,example=''){return {name,origin,meaning,rename,example};}
module.exports={lineAt,block,result,symbol};
