const {execFile}=require('node:child_process');
const path=require('node:path');
const unavailable=status=>({status,facts:[],limited:false});
function validate(result, source) {
    if(!result||!['parsed','invalid-syntax','parser-limit','source-limit'].includes(result.status)||!Array.isArray(result.facts)||result.facts.length>1200)throw Error('Invalid syntax response');
    const ids=new Set(result.facts.map(f=>f.id));
    if(ids.size!==result.facts.length)throw Error('Duplicate syntax identity');
    const kinds=new Set(['function','parameter','branch','logic','comparison','return','await','yield','loop','try','throw','break','continue','call']);
    function refs(value) {
        if(!value||typeof value!=='object')return;
        if(Object.hasOwn(value,'quote')) {
            if(!Number.isInteger(value.start)||!Number.isInteger(value.end)||value.start<0||value.end<value.start||value.end>source.length)throw Error('Invalid syntax range');
            if(value.quote!==null&&value.quote!==source.slice(value.start,value.end))throw Error('Invalid syntax quote');
        }
        for(const child of Object.values(value))refs(child);
    }
    for(const fact of result.facts) {
        if(!kinds.has(fact.kind)||!fact.span||!Array.isArray(fact.ancestry)||!fact.details||fact.owner!==null&&!ids.has(fact.owner)||fact.ancestry.some(a=>!ids.has(a.id)))throw Error('Invalid syntax fact');
        refs(fact);
    }
    return result;
}
async function extract(source,language,filename='',options={}) {
    options.signal?.throwIfAborted();
    if(Buffer.byteLength(source,'utf8')>100000)return unavailable('source-limit');
    if(!['Python','JavaScript','TypeScript'].includes(language))return unavailable('unsupported');
    try {
        if(language!=='Python')return validate(require('./review-javascript').extract(source,language,filename),source);
        const result=await new Promise((resolve,reject)=>{
            const child=execFile(options.python||process.env.CODELINGO_PYTHON||'python',['-I','-X','utf8',path.join(__dirname,'review-python.py')],{windowsHide:true,encoding:'utf8',timeout:5000,maxBuffer:4e6,signal:options.signal},(error,out)=>{
                if(error)return reject(error);
                try{resolve(JSON.parse(out));}catch(e){reject(e);}
            });
            child.stdin.on('error',()=>{});
            child.stdin.end(source,'utf8');
        });
        return validate(result,source);
    } catch(error) {
        if(options.signal?.aborted)throw error;
        return unavailable('parser-unavailable');
    }
}
module.exports={extract,validate};
