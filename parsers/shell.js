const {spawnSync}=require('node:child_process'),path=require('node:path');
function shell(code){const r=spawnSync(process.execPath,[path.join(__dirname,'shell-worker.cjs')],{input:code,encoding:'utf8',timeout:15000,windowsHide:true,maxBuffer:8e6});if(r.status!==0)throw Error('Bash 解析没有完成：'+(r.error?.message||r.stderr).slice(0,180));return JSON.parse(r.stdout);}
module.exports={shell};
