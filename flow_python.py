import ast

def flow_of(body,plain,describe,source="",statement=None):
    from spans_python import span
    count=[0]
    def seq(items,depth=0):
        out=[]
        for n in items:
            if isinstance(n,ast.Expr) and isinstance(n.value,ast.Constant) and isinstance(n.value.value,str):continue
            pos=span(n,source)
            count[0]+=1
            if count[0]>180 or depth>12:
                out.append(dict(pos,kind='unknown',label='还有内部步骤未展开，请对照源码。'));break
            detail=(statement(n) if statement else None) or describe([n])
            x=dict(pos,kind='step',label=detail[:140],detail=detail)
            if isinstance(getattr(n,'value',None),ast.Await):
                x['kind']='await'
                targets=n.targets if isinstance(n,ast.Assign) else [n.target] if isinstance(n,ast.AnnAssign) else []
                x['label']='等待完成，把结果保存为 '+ '、'.join(ast.get_source_segment(source,t) or '结果' for t in targets) if targets else '等待这一步完成，再继续'
            if isinstance(n,ast.If):
                yes=seq(n.body,depth+1);no=seq(n.orelse,depth+1)
                x=dict(span(n.test,source),kind='condition',label='如果 '+plain(n.test)[:100],children=yes,otherwise=no,terminal=bool(yes and no and yes[-1].get('terminal') and no[-1].get('terminal')))
            elif isinstance(n,(ast.For,ast.While,ast.AsyncFor)):
                condition=plain(n.test) if isinstance(n,ast.While) else plain(n.iter)
                x=dict(pos,kind='loop',label=('只要 '+condition[:120]+' 仍成立，就重复' if isinstance(n,ast.While) else '逐项处理 '+condition),condition=condition,children=seq(n.body,depth+1),afterLoop=seq(n.orelse,depth+1))
            elif isinstance(n,(ast.Return,ast.Raise,ast.Break,ast.Continue)):
                x['kind']={ast.Return:'return',ast.Raise:'throw',ast.Break:'break',ast.Continue:'continue'}[type(n)];x['terminal']=True
                if isinstance(n,ast.Break):x['label']='跳出当前循环，不执行循环的 else'
                if isinstance(n,ast.Continue):x['label']='跳到当前循环的下一轮'
                if isinstance(n,ast.Raise):
                    x['label']='报告错误，寻找匹配的错误处理路径'
                    x['detail']='从当前所在的错误处理范围向外寻找匹配的处理器；找到后进入该路径。没有匹配项才会继续向调用处报告。finally 收尾仍可能执行。'
            elif isinstance(n,(ast.FunctionDef,ast.AsyncFunctionDef)):
                x['kind']='definition';x['label']='准备函数 '+n.name+'；函数体在调用时执行，默认值和装饰器可能在定义时求值'
            elif isinstance(n,ast.ClassDef):
                x['kind']='unknown';x['label']='定义类 '+n.name+'；类体的定义时执行过程未展开'
            elif hasattr(ast,'Match') and isinstance(n,ast.Match):
                x.update(kind='pattern',label='按模式检查 '+plain(n.subject),detail='从上往下尝试每种模式；匹配且守卫条件成立时，只执行这一分支。都不符合就继续后面的代码。',children=[])
                for c in n.cases:
                    label='匹配 '+(ast.get_source_segment(source,c.pattern) or '这个模式')+('，并且 '+plain(c.guard) if c.guard else '')
                    x['children'].append(dict(span(c.pattern,source),kind='case',label=label,children=seq(c.body,depth+1)))
            elif hasattr(ast,'TryStar') and isinstance(n,ast.TryStar):
                x.update(kind='unknown',label='异常组处理 · except*',detail='这里按异常类型分别处理异常组；可能执行多个匹配处理器，不能套用普通 except 只选一条路径的规则。当前不展开组内分配，请对照源码。')
            elif isinstance(n,ast.Try):
                x.update(kind='exception',label='先尝试正常处理；发生错误时走对应的处理路径',detail='try 内发生错误时，跳过尚未执行的步骤，选择第一个匹配的 except。没有匹配项就继续向外报告。else 仅在 try 正常结束时执行；finally 在离开时收尾，也可能改变原本的返回或错误。',children=seq(n.body,depth+1),handlers=[],afterSuccess=seq(n.orelse,depth+1),finalizer=seq(n.finalbody,depth+1))
                for h in n.handlers:
                    label='发生 '+(plain(h.type) if h.type else '任意错误')+' 时'
                    x['handlers'].append(dict(span(h,source),kind='handler',label=label,children=seq(h.body,depth+1)))
                x['terminal']=bool(x['finalizer'] and x['finalizer'][-1].get('terminal'))
            elif isinstance(n,(ast.With,ast.AsyncWith)):
                x.update(kind='resource',label='进入资源使用范围，离开时调用收尾操作',detail='先取得资源，再执行内部步骤。离开时调用资源约定的收尾操作；进入或收尾也可能失败，错误是否被处理取决于资源实现。',children=seq(n.body,depth+1))
            if isinstance(getattr(n,'value',None),(ast.Yield,ast.YieldFrom)):
                x.update(kind='yield',label='提供结果并暂停；下次取值时继续',detail=detail)
            out.append(x)
            if x.get('terminal'):break
        return out
    return seq(body)
