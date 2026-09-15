import ast, io, tokenize, subprocess, sys, json
from pathlib import Path

def recover(source):
    lines=source.split('\n');starts=[];depth=0;indent=0
    try:
        for t in tokenize.generate_tokens(io.StringIO(source).readline):
            if t.type==tokenize.INDENT: indent+=1
            elif t.type==tokenize.DEDENT: indent-=1
            elif t.type==tokenize.OP:
                if t.string in '([{':depth+=1
                elif t.string in ')]}':depth-=1
            if t.type==tokenize.NAME and t.string in ('def','class','async') and indent==0 and depth==0 and t.start[1]==0:
                if not starts or starts[-1]!=t.start[0]:starts.append(t.start[0])
    except (tokenize.TokenError,IndentationError,SyntaxError): pass
    blocks=[];unexplained=[]
    for i,start in enumerate(starts[:30]):
        end=(starts[i+1]-1) if i+1<len(starts) else len(lines)
        fragment='\n'.join(lines[start-1:end])
        try:
            tree=ast.parse(fragment)
            if len(tree.body)!=1 or not isinstance(tree.body[0],(ast.FunctionDef,ast.AsyncFunctionDef,ast.ClassDef)):raise SyntaxError()
            if start>1 and lines[start-2].lstrip().startswith('@'):raise SyntaxError()
        except SyntaxError:
            unexplained.append(dict(start=start,end=end,reason='这个定义不完整，或含有无法确定的上下文。'));continue
        child=subprocess.run([sys.executable,str(Path(__file__).with_name('analyze.py'))],input=fragment,encoding='utf-8',capture_output=True,timeout=3)
        try:
            parsed=json.loads(child.stdout)
            for b in parsed.get('blocks',[]):
                def shift(value):
                    if isinstance(value,list):
                        for child in value:shift(child)
                    elif isinstance(value,dict):
                        if isinstance(value.get('start'),int) and isinstance(value.get('end'),int):
                            value['start']+=start-1;value['end']+=start-1
                        for child in value.values():shift(child)
                shift(b)
                # Symbol explanations may contain relative source lines: avoid incorrect locations.
                for s in b.get('symbols',[]):
                    if '源码第 ' in s.get('meaning',''):s['meaning']='作者在这个独立片段中定义的名字；请对照原文件中的定义和使用。'
                blocks.append(b)
        except (ValueError,KeyError):pass
    return blocks,unexplained
