import ast

def learning_for(root, source="", context=None):
    from spans_python import span
    items=[]
    def add(key,n,context,why):
        items.append(dict(id=key,context=context,why=why,**span(n,source)))
    for n in ast.walk(root):
        if isinstance(n,(ast.FunctionDef,ast.AsyncFunctionDef)):
            add('py.function',n,'这里定义一组可以调用的步骤。','需要处理另一份输入时，可以再次使用它。')
        elif isinstance(n,(ast.Assign,ast.AnnAssign,ast.AugAssign)):
            if isinstance(n,ast.AnnAssign) and n.value is None:
                add('py.annotation',n,'这里只写类型提示，没有给左侧位置赋值。','类型说明与实际保存数据是不同的步骤。')
                continue
            targets=n.targets if isinstance(n,ast.Assign) else [n.target]
            unpack=any(isinstance(t,(ast.Tuple,ast.List)) for t in targets)
            add('py.unpack' if unpack else 'py.assign',n,'按顺序把值分别交给几个名字。' if unpack else '把计算结果交给左边的名字。','后面的步骤可以用这些名字继续处理数据。')
        elif isinstance(n,ast.If):
            add('py.condition',n.test,'检查这里的条件，决定进入哪组缩进的步骤。','不同输入可以采用不同处理。')
        elif isinstance(n,(ast.For,ast.While,ast.AsyncFor)):
            add('py.loop',n,'按照循环的规则重复处理。','让同一组步骤作用于多项内容，或重复到条件满足。')
        elif isinstance(n,ast.Return):
            add('py.return',n,'这里交回结果并结束本次函数处理。','调用它的地方可以接着使用这个结果。')
    # Conservatively include module declarations; do not mislabel shadowed built-ins.
    raw=context.raw if context else lambda n:ast.get_source_segment(source,n) or ''
    if context and hasattr(context,'learning_bindings'):
        bound,imports=context.learning_bindings
    else:
        scope=context.tree if context else ast.parse(source) if source else root
        scope_nodes=list(ast.walk(scope))
        bound={n.id for n in scope_nodes if isinstance(n,ast.Name) and isinstance(n.ctx,ast.Store)} | {n.arg for n in scope_nodes if isinstance(n,ast.arg)}
        bound.update(a.asname or a.name.split('.')[0] for n in scope_nodes if isinstance(n,(ast.Import,ast.ImportFrom)) for a in n.names)
        bound.update(n.name for n in scope_nodes if isinstance(n,(ast.FunctionDef,ast.AsyncFunctionDef,ast.ClassDef)))
        imports={a.asname or a.name.split('.')[0]:a.name if isinstance(n,ast.Import) else (n.module or '')+'.'+a.name for n in scope_nodes if isinstance(n,(ast.Import,ast.ImportFrom)) for a in n.names}
        if context:context.learning_bindings=bound,imports
    doclines={n.body[0].lineno for n in ast.walk(root) if isinstance(n,(ast.Module,ast.ClassDef,ast.FunctionDef,ast.AsyncFunctionDef)) and ast.get_docstring(n) and n.body}
    annotation_nodes=set()
    for n in ast.walk(root):
        annotation = n.annotation if isinstance(n,(ast.arg,ast.AnnAssign)) else n.returns if isinstance(n,(ast.FunctionDef,ast.AsyncFunctionDef)) else None
        if annotation:annotation_nodes.update(ast.walk(annotation))
    for n in ast.walk(root):
        if isinstance(n,ast.arg) and n.annotation:
            add('py.annotation',n.annotation,'这里提示参数预期接收哪种内容。','帮助调用者和检查工具理解接口；不会自动强制转换值。')
        if isinstance(n,(ast.FunctionDef,ast.AsyncFunctionDef)) and n.returns:
            add('py.annotation',n.returns,'这里提示预期返回内容的类型。','这是类型提示，不是实际返回动作。')
    for n in ast.walk(root):
        key=None
        if isinstance(n,ast.Compare): key='compare'
        elif isinstance(n,(ast.Import,ast.ImportFrom)): key='import'
        elif isinstance(n,ast.ListComp): key='comprehension'
        elif isinstance(n,ast.Constant) and isinstance(n.value,str): key='docstring' if n.lineno in doclines else 'string'
        elif isinstance(n,ast.List): key='list'
        elif isinstance(n,ast.Dict): key='dict'
        elif isinstance(n,ast.ClassDef): key='class'
        elif isinstance(n,ast.Try): key='exception'
        elif isinstance(n,(ast.With,ast.AsyncWith)): key='with'
        elif isinstance(n,ast.Await): key='await'
        elif isinstance(n,ast.AsyncFunctionDef): key='await'
        elif isinstance(n,ast.Subscript) and n not in annotation_nodes: key='slice' if isinstance(n.slice,ast.Slice) else 'index'
        elif isinstance(n,ast.Tuple) and isinstance(n.ctx,ast.Load) and n not in annotation_nodes: key='tuple'
        elif isinstance(n,ast.Attribute) and n not in annotation_nodes: key='attribute'
        elif isinstance(n,ast.BoolOp) or isinstance(n,ast.UnaryOp) and isinstance(n.op,ast.Not): key='logic'
        elif isinstance(n,ast.BinOp): key='path' if context and isinstance(n.op,ast.Div) and context.semantics.path_value(n.left) else 'arithmetic'
        elif isinstance(n,ast.JoinedStr): key='format'
        elif isinstance(n,(ast.Yield,ast.YieldFrom,ast.GeneratorExp)):key='generator'
        elif isinstance(n,ast.Set):key='set'
        elif isinstance(n,(ast.SetComp,ast.DictComp)):key='collection-comprehension'
        elif isinstance(n,ast.IfExp):key='conditional-value'
        elif isinstance(n,ast.Lambda):key='lambda'
        elif hasattr(ast,'Match') and isinstance(n,ast.Match):key='match'
        elif isinstance(n,ast.Assert):key='assert'
        elif isinstance(n,ast.Call) and isinstance(n.func,ast.Name) and n.func.id=='isinstance' and n.func.id not in bound: key='typecheck'
        if isinstance(n,ast.Call):
            add('py.call',n,'这里调用 '+raw(n.func)+'，括号里写这次提供的数据。','调用写法可以直接解释；接收方的具体工作还要查看它的定义。')
            for k in n.keywords:
                if k.arg:add('py.keyword',k if hasattr(k,'lineno') else k.value,'把 '+raw(k.value)+' 的值交给参数 '+k.arg+'。','左边是接收方的参数名，右边是当前提供的值；两边名字相同也不是多余的。')
            if isinstance(n.func,ast.Name) and n.func.id not in bound:
                key={'len':'length','min':'extrema','max':'extrema','str':'convert','int':'convert','float':'convert','sum':'sum','range':'range'}.get(n.func.id,key)
            call=raw(n.func)
            first,_,rest=call.partition('.')
            resolved=imports.get(first,'')+('.'+rest if rest else '')
            if resolved in ('asyncio.create_task','asyncio.wait'):key='tasks'
        if key:add('py.'+key,n,'这处源码使用了卡片所示的写法。','先理解写法，再结合输入与上下文确认它在这里的作用。')
        label=None
        if isinstance(n,ast.Call) and not key:
            label='调用 '+(raw(n.func) or '外部功能')
            if isinstance(n.func,ast.Name) and n.func.id=='next' and 'next' not in bound:
                label='调用 next：迭代器取值，以及可能的生成器恢复过程'
        elif hasattr(ast,'TryStar') and isinstance(n,ast.TryStar):label='异常组中各项的分配与处理'
        elif isinstance(n,(ast.With,ast.AsyncWith)):label='资源工具的内部进入和收尾行为'
        if label:items.append(dict(id='gap.py.'+type(n).__name__,gap=True,label=label,context='调用写法已有讲解；接收方内部做什么，还需查看对应定义。' if isinstance(n,ast.Call) else '已识别，但还没有核对这一部分的完整行为。',**span(n,source)))
    if context:
        for n in ast.walk(root):
            if isinstance(n,(ast.FunctionDef,ast.AsyncFunctionDef)) and context.owner(n) and n.args.args and n.args.args[0].arg=='self' and not n.decorator_list:
                add('py.self',n.args.args[0],'self 指向这次处理的对象；self. 后面的名字用于访问它的数据或功能。','通过对象调用这个方法时，Python 会把该对象传到第一个参数位置。')
    return items
