"""Basic Python reading contracts derived from syntax, not project names."""
import ast
import re
from spans_python import span
from semantics_python import own_nodes


def decorate(node, block, e):
    guide = block.get('guide')
    if not guide:
        return
    plain = guide.setdefault('plain', {})
    doc = ast.get_docstring(node) or ''
    # Preserve the author's text in the professional guide; describe observable steps in Chinese.
    if plain.get('purpose','').startswith('按作者说明：') and len(re.findall('[A-Za-z]',doc.split('\n')[0]))>10 and not re.search('[\u4e00-\u9fff]',doc.split('\n')[0]):
        body=[n for n in node.body if not (isinstance(n,ast.Expr) and isinstance(n.value,ast.Constant) and isinstance(n.value.value,str))]
        def action(n):
            if isinstance(n,(ast.Assign,ast.AnnAssign)):
                ts=n.targets if isinstance(n,ast.Assign) else [n.target]
                return '计算并保存 '+ '、'.join(e.raw(t) for t in ts)
            if isinstance(n,ast.If):return '根据条件选择要做的步骤'
            if isinstance(n,(ast.For,ast.AsyncFor)):return '逐项读取 '+e.raw(n.iter)+' 并处理'
            if isinstance(n,ast.While):return '在条件成立时重复处理'
            if isinstance(n,ast.Try):return '尝试处理，并为指定错误准备另一条路径'
            if isinstance(n,(ast.With,ast.AsyncWith)):return '使用资源，离开时执行收尾'
            if isinstance(n,ast.Return):return '交回 '+(e.value(n.value) if n.value else 'None')
            if isinstance(n,ast.Expr) and isinstance(n.value,ast.Call):return '调用 '+e.raw(n.value.func)
            return '处理第 '+str(n.lineno)+' 行对应的步骤'
        if body:
            steps=[action(body[0])]+([action(body[-1])] if len(body)>1 else [])
            plain['purpose']='从源码可以看到：'+'；'.join(s[:95] for s in steps)+'。中间的判断和数据变化可点开环节查看。'
            plain['title']=steps[0][:32]
    pos = node.args.posonlyargs + node.args.args
    owner = e.owner(node)
    decorators = [e.raw(d) for d in node.decorator_list]
    implicit = pos[0].arg if pos and owner and ('classmethod' in decorators or (pos[0].arg == 'self' and 'staticmethod' not in decorators)) else None
    defaults = dict(zip([a.arg for a in pos][-len(node.args.defaults):],node.args.defaults)) if node.args.defaults else {}
    defaults.update({a.arg:d for a,d in zip(node.args.kwonlyargs,node.args.kw_defaults) if d is not None})
    inputs=[]
    for a in pos + node.args.kwonlyargs:
        if a.arg == implicit:
            continue
        mode='只能按位置提供' if a in node.args.posonlyargs else '必须按名字提供' if a in node.args.kwonlyargs else '可按位置或名字提供'
        inputs.append(a.arg+'：'+mode+('；省略时用 '+e.raw(defaults[a.arg]) if a.arg in defaults else '，不能省略')+'。')
    if node.args.vararg:inputs.append('*'+node.args.vararg.arg+'：把额外按位置提供的值收成一个元组（一组有顺序的值）。')
    if node.args.kwarg:inputs.append('**'+node.args.kwarg.arg+'：把额外按名字提供的值收成一个字典（名字与值的对应表）。')
    if node.args.posonlyargs or node.args.kwonlyargs or 'classmethod' in decorators or node.args.vararg or node.args.kwarg:
        plain['input']='\n'.join(inputs) or '调用时不需要另外填写参数。'
    if 'classmethod' in decorators:
        plain['input'] += '\n第一个参数 '+implicit+' 由 Python 接收当前类；通常叫 cls。' if implicit else '\n类方法调用会额外传入当前类；这里没有声明接收它的位置参数，需要核对调用方式。'
    yields=[n for n in own_nodes(node) if isinstance(n,(ast.Yield,ast.YieldFrom))]
    if yields:
        plain['output']='调用后得到异步生成器；使用 async for 等方式逐项读取结果。' if isinstance(node,ast.AsyncFunctionDef) else '调用后得到一个生成器；开始迭代时才执行里面的步骤。每次遇到 yield 提供一项并暂停，继续取值时再往下执行。'
        plain['purpose']='按需逐项提供结果；先看 yield 提供什么，再看下一次取值时从哪里继续。'
        plain['title']='按需逐项提供结果'
    elif isinstance(node,ast.AsyncFunctionDef):
        plain['output']='直接调用先得到协程（等待运行的任务）；通过 await 等待完成后，才取得 return 交回的结果。'+('没有写 return 时，正常完成的结果为 None。' if not any(isinstance(n,ast.Return) for n in own_nodes(node)) else '')
    for x in block.get('learning',[]):
        if x.get('id')=='py.annotation':x['why']='这是给读者和检查工具的类型提示，不是自动转换，也不保证运行时类型正确。'


def module_block(tree, source, e):
    nodes=[n for n in tree.body if not isinstance(n,(ast.FunctionDef,ast.AsyncFunctionDef,ast.ClassDef)) and not (isinstance(n,ast.Expr) and isinstance(n.value,ast.Constant) and isinstance(n.value.value,str))]
    if not nodes:
        if source.strip() and all(isinstance(n,ast.Expr) and isinstance(n.value,ast.Constant) and isinstance(n.value.value,str) for n in tree.body):
            return dict(kind='module',title='文件中的说明',start=1,end=len(source.splitlines()) or 1,purpose='这份文件只有说明文字或注释，没有其他处理步骤。',learning=[],symbols=[])
        return None
    from flow_python import flow_of
    from learning_python import learning_for
    imports=all(isinstance(n,(ast.Import,ast.ImportFrom)) for n in nodes)
    # Include ordinary statements outside functions, even when functions exist.
    if imports and any(isinstance(n,(ast.FunctionDef,ast.AsyncFunctionDef,ast.ClassDef)) for n in tree.body):
        return None
    tree_part=ast.Module(body=nodes,type_ignores=[])
    return dict(kind='module',title='文件开始时的准备',role='script-entry',start=nodes[0].lineno,end=nodes[-1].end_lineno,
                purpose='这些语句写在函数外。程序执行到这里时，会按源码顺序处理导入、数据和调用；被条件包住的部分要先满足条件。',
                controlFlow=flow_of(nodes,e.value,lambda ns:'请对照这一步的源码。',source,e.statement),
                learning=learning_for(tree_part,source,e),symbols=[])


def framework(tree, source, e):
    groups=[]
    for n in tree.body:
        if isinstance(n,ast.ClassDef):
            groups.append(dict(name=n.name,kind='class',**span(n,source),members=[dict(name=x.name,kind='function',**span(x,source)) for x in n.body if isinstance(x,(ast.FunctionDef,ast.AsyncFunctionDef))]))
    imports=[dict(name=e.raw(n),**span(n,source)) for n in tree.body if isinstance(n,(ast.Import,ast.ImportFrom))]
    links=[]
    for n in ast.walk(tree):
        if isinstance(n,(ast.Module,ast.FunctionDef,ast.AsyncFunctionDef)):
            for call in own_nodes(n):
                if isinstance(call,ast.Call):
                    target=e.local_call(call)
                    if target and len(links)<160:links.append(dict(fromStart=getattr(n,'lineno',0),toStart=target.lineno,line=call.lineno,name=target.name))
    return dict(groups=groups,imports=imports,links=links)
