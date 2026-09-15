// Recover relative indentation from image geometry, never from language keywords.
// A screenshot cannot reveal whether the original whitespace used tabs or spaces.
function median(values) {
    const sorted=values.filter(Number.isFinite).sort((a,b)=>a-b);
    return sorted.length ? sorted[Math.floor(sorted.length/2)] : 0;
}
function reconstruct(data) {
    const lines=(data.blocks||[]).flatMap(b=>(b.paragraphs||[]).flatMap(p=>p.lines||[]))
        .filter(line=>line.text?.trim()&&line.bbox).sort((a,b)=>a.bbox.y0-b.bbox.y0||a.bbox.x0-b.bbox.x0);
    if(!lines.length)throw new Error('没有识别到代码，请裁去无关区域，使用清晰截图重试。');
    // Adjacent ASCII symbol origins give a better cell width than ink bounding-box widths.
    const advances=[],wordCells=[];
    for(const line of lines)for(const word of line.words||[]){
        const symbols=word.symbols||[];
        if(symbols.length>=4&&symbols.every(s=>/^[A-Za-z0-9_]$/.test(s.text)))
            wordCells.push((symbols.at(-1).bbox.x0-symbols[0].bbox.x0)/(symbols.length-1));
        for(let i=1;i<symbols.length;i++){
            const a=symbols[i-1],b=symbols[i],delta=b.bbox?.x0-a.bbox?.x0;
            if(/^[A-Za-z0-9_]$/.test(a.text)&&/^[A-Za-z0-9_]$/.test(b.text)&&delta>0)advances.push(delta);
        }
    }
    const fallback=lines.flatMap(l=>(l.words||[]).filter(w=>/^[A-Za-z0-9_]{4,}$/.test(w.text)).map(w=>(w.bbox.x1-w.bbox.x0)/w.text.length));
    const cell=median(wordCells)||median(advances)||median(fallback),left=Math.min(...lines.map(l=>l.bbox.x0));
    const code=[],uncertainLines=[];
    for(const line of lines){
        const spaces=cell?Math.max(0,Math.min(120,Math.round((line.bbox.x0-left)/cell))):0;
        code.push(' '.repeat(spaces)+line.text.trim());
        if(line.ocrDisagreement||line.confidence<75||(line.words||[]).some(w=>w.confidence<50))uncertainLines.push(code.length);
    }
    return {code:code.join('\n'),uncertainLines,confidence:Math.round(data.confidence||0),indentationEstimated:true};
}
module.exports={reconstruct};
