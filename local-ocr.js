const {execFile}=require('node:child_process');
const path=require('node:path');
let busy=false;
async function recognize(imagePath){
    if(busy)throw new Error('正在识别另一张图片，请稍后重试。');
    busy=true;
    try{
        return await new Promise((resolve,reject)=>execFile(process.execPath,[path.join(__dirname,'ocr-worker.js'),imagePath],
            {windowsHide:true,timeout:120000,maxBuffer:8e6,encoding:'utf8'},(error,out,stderr)=>{
                if(error)return reject(new Error(error.killed?'图片识别超时，请裁去无关区域后重试。':'本地识别未完成：'+String(stderr||error.message).slice(0,350)));
                try{resolve(JSON.parse(out));}catch{reject(new Error('没有收到完整的识别结果，请重试。'));}
            }));
    }finally{busy=false;}
}
module.exports={recognize};
