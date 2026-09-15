const {spawnSync}=require('node:child_process'),path=require('node:path');
function java(code){const p=spawnSync(process.execPath,[path.join(__dirname,'java-worker.mjs')],{input:code,encoding:'utf8',timeout:12000,maxBuffer:8e6,windowsHide:true});if(p.status!==0)throw Error('Java 解析器未能完成：'+(p.error?.message||p.stderr).slice(0,180));return JSON.parse(p.stdout);}
module.exports={java};
