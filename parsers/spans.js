// One-based lines, zero-based UTF-16 columns; end column is exclusive.
function span(n,source){const a=source.getLineAndCharacterOfPosition(n.getStart(source)),z=source.getLineAndCharacterOfPosition(n.end);return {start:a.line+1,end:z.line+1,startColumn:a.character,endColumn:z.character};}
function contains(a,b){return (a.start<b.start||a.start===b.start&&(a.startColumn??0)<=(b.startColumn??0))&&(a.end>b.end||a.end===b.end&&(a.endColumn??Infinity)>=(b.endColumn??Infinity));}
module.exports={span,contains};
