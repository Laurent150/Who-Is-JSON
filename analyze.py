import ast, json, sys
from beginner import Teacher
source=sys.stdin.read()
teacher=None
explanation=None
def plain(n):
    if teacher:
        translated=teacher.words(n)
        if translated:return translated
    if explanation:return explanation.value(n)
    if isinstance(n,ast.Name): return n.id
    if isinstance(n,ast.Constant): return repr(n.value)
    if isinstance(n,ast.BinOp):
        if isinstance(n.op,ast.Mod) and not (isinstance(n.left,ast.Constant) and isinstance(n.left.value,(int,float))):
            return '对 %s 和 %s 使用 %%；数值可取余，文字可填入内容，具体取决于左侧的类型'%(plain(n.left),plain(n.right))
        op={ast.Add:'加上',ast.Sub:'减去',ast.Mult:'乘以',ast.Div:'除以',ast.Mod:'取余',ast.FloorDiv:'整除'}.get(type(n.op),'进行运算')
        return '（%s %s %s）'%(plain(n.left),op,plain(n.right))
    if isinstance(n,ast.Compare) and len(n.ops)==1:
        op={ast.Gt:'大于',ast.Lt:'小于',ast.GtE:'大于或等于',ast.LtE:'小于或等于',ast.Eq:'等于',ast.NotEq:'不等于',ast.In:'在其中'}.get(type(n.ops[0]),'比较')
        return '%s %s %s'%(plain(n.left),op,plain(n.comparators[0]))
    if isinstance(n,ast.Call):
        name=ast.get_source_segment(source,n.func) or '函数'
        if name=='round' and n.args: return '对 %s 进行四舍五入%s'%(plain(n.args[0]),('，保留 %s 位小数'%plain(n.args[1])) if len(n.args)>1 else '')
        return '调用 %s，传入 %s'%(name,'、'.join(plain(a) for a in n.args) or '无位置参数')
    return ast.get_source_segment(source,n) or '此表达式'
def describe_steps(nodes, depth=0):
    if depth>3: return '内部还有更多步骤，需展开源码。'
    parts=[]
    for node in nodes[:8]:
        if isinstance(node,ast.Expr) and isinstance(node.value,ast.Constant) and isinstance(node.value.value,str): continue
        if isinstance(node,ast.Assign): parts.append('把 %s 设为 %s。'%('、'.join(plain(t) for t in node.targets),plain(node.value)))
        elif isinstance(node,ast.AugAssign): parts.append('把 %s 更新为：%s。'%(plain(node.target),plain(ast.copy_location(ast.BinOp(left=node.target,op=node.op,right=node.value),node))))
        elif isinstance(node,ast.Return): parts.append('把 %s 交回给使用这个功能的地方，并结束这次处理。'%(plain(node.value) if node.value else 'None'))
        elif isinstance(node,ast.If): parts.append('如果 %s，就：%s%s'%(plain(node.test),describe_steps(node.body,depth+1),'否则：'+describe_steps(node.orelse,depth+1) if node.orelse else '不满足就跳过这些步骤。'))
        elif isinstance(node,ast.For): parts.append('依次从 %s 取出一项，命名为 %s，每次做这些事：%s%s'%(plain(node.iter),plain(node.target),describe_steps(node.body,depth+1),'循环正常结束且未被 break 跳出时：'+describe_steps(node.orelse,depth+1) if node.orelse else ''))
        elif isinstance(node,ast.Expr): parts.append(plain(node.value)+'。')
        else: parts.append('这里还包含其他处理，请展开第 %s 行的源码核对。'%node.lineno)
    if len(nodes)>8: parts.append('还有后续步骤未在简稿中展开。')
    return '\n'.join(parts)
try:
    tree=ast.parse(source)
    teacher=Teacher(source,tree)
    from python_explain import PythonExplanation
    explanation=PythonExplanation(source,tree,teacher)
    blocks=[]
    kinds={ast.FunctionDef:('function','函数'),ast.AsyncFunctionDef:('function','异步函数'),ast.ClassDef:('class','类'),ast.For:('loop','逐项重复'),ast.While:('loop','条件循环'),ast.If:('condition','条件判断'),ast.Try:('error','异常处理')}
    for n in ast.walk(tree):
        if type(n) not in kinds: continue
        kind,label=kinds[type(n)]
        name=getattr(n,'name',label)
        inputs=', '.join(a.arg for a in n.args.args) if hasattr(n,'args') else ''
        block=dict(kind=kind,title=name,start=n.lineno,end=getattr(n,'end_lineno',n.lineno),inputs=inputs)
        if isinstance(n,ast.For):
            block['purpose']='依次从 %s 取出一个值，叫作 %s，然后执行循环体。除非提前跳出或发生异常，否则会处理完这些值。'%(plain(n.iter),plain(n.target))
            block['inputs']=plain(n.iter)
        if isinstance(n,ast.While): block['purpose']='只要「%s」仍然成立，就继续执行循环体；需要留意何时使条件变为不成立。'%plain(n.test)
        if isinstance(n,ast.If): block['purpose']='检查「%s」是否成立；成立时执行这一分支%s。'%(plain(n.test),'，否则进入另一分支' if n.orelse else '，否则跳过这一分支')
        if isinstance(n,(ast.FunctionDef,ast.AsyncFunctionDef)):
            block['flow']=describe_steps(n.body)
            from flow_python import flow_of
            block['controlFlow']=flow_of(n.body,plain,describe_steps,source,explanation.statement)
            args=n.args.args
            defaults={a.arg:plain(d) for a,d in zip(args[len(args)-len(n.args.defaults):],n.args.defaults)} if n.args.defaults else {}
            block['inputs']='；'.join(a.arg+('（未填写时使用 '+defaults[a.arg]+'）' if a.arg in defaults else '（需要传入）') for a in args) or '无位置参数；还需留意是否使用外部变量。'
            returns=[]
            def scan_return(node):
                for child in ast.iter_child_nodes(node):
                    if isinstance(child,(ast.FunctionDef,ast.AsyncFunctionDef,ast.ClassDef,ast.Lambda)): continue
                    if isinstance(child,ast.Return): returns.append('返回 '+plain(child.value) if child.value else '返回 None')
                    else: scan_return(child)
            scan_return(n)
            block['output']='；'.join(returns) if returns else '没有显式 return：正常执行到结尾会返回 None；仍可能产生其他影响。'
            calls=[ast.get_source_segment(source,c) for c in ast.walk(tree) if isinstance(c,ast.Call) and isinstance(c.func,ast.Name) and c.func.id==name]
            if calls: block['usage']='原代码中已有调用：'+ '；'.join(calls[:3])+'。先准备好参数对应的数据，再在定义之后调用。'
        decorated=teacher.decorate(n,block)
        from learning_python import learning_for
        decorated['learning']=learning_for(n,source,explanation)
        if isinstance(n,(ast.FunctionDef,ast.AsyncFunctionDef)):
            explanation.decorate(n,decorated)
            from python_foundations import decorate
            decorate(n,decorated,explanation)
            from meaning_python import annotate
            annotate(n,decorated)
            if decorated.get('meaning'):decorated.pop('guide',None)
        blocks.append(decorated)
    from python_foundations import module_block,framework
    module=module_block(tree,source,explanation)
    if module:blocks.append(module)
    from line_reading_python import reading_units
    print(json.dumps({'reading':reading_units(tree,explanation),'blocks':sorted(blocks,key=lambda b:(b['start'],-b['end'])),'framework':framework(tree,source,explanation),'guide':explanation.document(),'parser':'Python AST','warnings':[]},ensure_ascii=False))
except SyntaxError as e:
    from recover_python import recover
    recovered,unexplained=recover(source)
    print(json.dumps({'blocks':recovered,'parser':'Python AST · 局部恢复','syntaxErrors':True,'partialRecovery':bool(recovered),'unexplained':unexplained,'warnings':['第 %s 行附近无法解析：%s。仅解释独立解析通过的顶层定义，未验证跨片段依赖；不自动猜测缩进。'%(e.lineno,e.msg)]},ensure_ascii=False))
