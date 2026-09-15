// Use a second optical pass only to recover underscores. It cannot rewrite letters,
// numbers, operators or punctuation, and ambiguous repeated matches are left alone.
function restoreUnderscores(primary,alternate){
    let text=primary;
    for(const name of new Set(alternate.match(/[A-Za-z_][A-Za-z0-9_]*_[A-Za-z0-9_]*|_[A-Za-z][A-Za-z0-9_]*/g)||[])){
        if(!/[A-Za-z]/.test(name))continue;
        const pattern=name.split('_').join('[ _]*');
        const matches=[...text.matchAll(new RegExp('(?<![A-Za-z0-9_])'+pattern+'(?![A-Za-z0-9_])','g'))];
        if(matches.length!==1)continue;
        const m=matches[0];
        if(m[0].replace(/[ _]/g,'')!==name.replace(/_/g,''))continue;
        text=text.slice(0,m.index)+name+text.slice(m.index+m[0].length);
    }
    return text;
}
function compare(primary,alternate){
    const lines=data=>(data.blocks||[]).flatMap(b=>(b.paragraphs||[]).flatMap(p=>p.lines||[]));
    const other=lines(alternate);let restored=0;
    for(const line of lines(primary)){
        const middle=(line.bbox.y0+line.bbox.y1)/2;
        const match=other.find(l=>Math.abs((l.bbox.y0+l.bbox.y1)/2-middle)<(line.bbox.y1-line.bbox.y0)/2);
        if(!match)continue;
        const updated=restoreUnderscores(line.text,match.text);
        if(updated!==line.text){line.text=updated;restored++;}
        line.ocrDisagreement=line.text.replace(/\s/g,'')!==match.text.replace(/\s/g,'');
    }
    return restored;
}
module.exports={restoreUnderscores,compare};
