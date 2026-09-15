// Separate process: the caller enforces a deadline and releases the OCR worker afterwards.
const fs=require('node:fs'),path=require('node:path');
const {createWorker,PSM}=require('tesseract.js');
const {reconstruct}=require('./ocr-layout');
const {compare}=require('./ocr-consensus');
(async()=>{
    const langPath=path.join(__dirname,'ocr-data');
    for(const lang of ['eng','chi_sim'])if(!fs.existsSync(path.join(langPath,lang+'.traineddata')))
        throw new Error('软件内的 OCR 语言包不完整，请补齐 ocr-data 文件夹后重试。');
    let worker;
    try{
        worker=await createWorker('eng',0,{langPath,gzip:false,cacheMethod:'none',logging:false,legacyCore:true},
            {load_system_dawg:'0',load_freq_dawg:'0',load_punc_dawg:'0',load_number_dawg:'0'});
        await worker.setParameters({tessedit_pageseg_mode:PSM.SINGLE_BLOCK,preserve_interword_spaces:'1',user_defined_dpi:'300'});
        const input=fs.readFileSync(process.argv[2]);
        const second=await worker.recognize(input,{}, {text:true,blocks:true});
        await worker.reinitialize('eng+chi_sim',1);
        await worker.setParameters({tessedit_pageseg_mode:PSM.SINGLE_BLOCK,preserve_interword_spaces:'1',user_defined_dpi:'300'});
        const {data}=await worker.recognize(input,{}, {text:true,blocks:true});
        const restored=compare(data,second.data);
        const result=reconstruct(data);
        if(process.env.WHO_OCR_DEBUG)fs.writeFileSync(process.env.WHO_OCR_DEBUG,JSON.stringify({data,alternate:second.data},null,2));
        process.stdout.write(JSON.stringify({...result,method:'本地识别 · 已内置英文与简体中文语言包',
            warnings:['缩进按图片中的位置估算，请对照原图核对。',...(restored?['部分下划线经第二次识别补回，请核对名称。']:[]),...(result.uncertainLines.length?['第 '+result.uncertainLines.join('、')+' 行有识别不确定的文字或符号。']:[])]}));
    }finally{if(worker)await worker.terminate();}
})().catch(error=>{process.stderr.write(error.message);process.exitCode=1;});
