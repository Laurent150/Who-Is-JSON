const {analyze,detect}=require('./analyzer');
function review(code,python){
    const hint=detect(code)==='未确定'&&/^\s*(?:async\s+)?def\b/m.test(code)?'screenshot.py':'screenshot.txt';
    const result=analyze(code,hint,python);
    const checked=['ready','invalid','partial'].includes(result.status);
    return {language:result.language,status:result.status,warning:!checked?'暂未完成语法核对，请对照图片检查。':result.status!=='ready'?`提取的代码尚不能完整按 ${result.language} 语法读取，请先核对名称、符号和缩进。`:null};
}
module.exports={review};
