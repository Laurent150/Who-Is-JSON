"""Beginner presentation of AST evidence; never executes submitted source.

Kept separate from semantic recognition: plain text does not add business claims.
Parts use original source coordinates, including UTF-16 browser columns.
"""
import ast
import io
import tokenize
import re
from bisect import bisect_left, bisect_right
from spans_python import span
from semantics_python import own_nodes


class Pedagogy:
    def __init__(self, explanation):
        self.e = explanation
        self.source = explanation.source
        self.lines = self.source.split('\n')
        self.tokens = list(tokenize.generate_tokens(io.StringIO(self.source).readline))
        self.token_lines = [t.start[0] for t in self.tokens]
        self.token_cache = {}

    def part(self, token, meaning):
        def col(pos):
            return len(self.lines[pos[0]-1][:pos[1]].encode('utf-16-le')) // 2
        return dict(text=token.string, plain=meaning, start=token.start[0], end=token.end[0],
                    startColumn=col(token.start), endColumn=col(token.end))

    def tokens_for(self, node):
        if node in self.token_cache:return self.token_cache[node]
        r = span(node, self.source)
        def fits(t):
            p = self.part(t, '')
            return ((p['start'], p['startColumn']) >= (r['start'], r['startColumn']) and
                    (p['end'], p['endColumn']) <= (r['end'], r['endColumn']))
        tokens=self.tokens[bisect_left(self.token_lines,r['start']):bisect_right(self.token_lines,r['end'])]
        self.token_cache[node]=[t for t in tokens if t.type in (tokenize.NAME, tokenize.OP, tokenize.NUMBER, tokenize.STRING) and fits(t)]
        return self.token_cache[node]

    def parts(self, node):
        result = []
        def add(t, meaning):
            if not any(x['start']==t.start[0] and x['startColumn']==self.part(t,'')['startColumn'] for x in result):
                result.append(self.part(t,meaning))
        nodes = list(own_nodes(node)) if isinstance(node,(ast.FunctionDef,ast.AsyncFunctionDef)) else list(ast.walk(node))
        for n in nodes:
            ts = self.tokens_for(n) if isinstance(n,(ast.Call,ast.FunctionDef,ast.AsyncFunctionDef,ast.Assign,ast.AnnAssign,ast.Attribute)) else []
            if isinstance(n,(ast.FunctionDef,ast.AsyncFunctionDef)):
                # Header only; colons inside annotations/default values do not end it.
                body_span=span(n.body[0],self.source)
                excluded=[span(x,self.source) for x in n.args.defaults+n.args.kw_defaults if x is not None]
                excluded += [span(a.annotation,self.source) for a in n.args.posonlyargs+n.args.args+n.args.kwonlyargs if a.annotation]
                if n.returns:excluded.append(span(n.returns,self.source))
                for t in ts:
                    p=self.part(t,'')
                    if (p['start'],p['startColumn']) >= (body_span['start'],body_span['startColumn']): break
                    if any((p['start'],p['startColumn'])>=(r['start'],r['startColumn']) and (p['end'],p['endColumn'])<=(r['end'],r['endColumn']) for r in excluded):continue
                    m = {'def':'定义一组可以再次使用的步骤；写下定义时，还没有运行里面的步骤。',
                         'async':'定义可以用 await 等待结果的功能；等待时，其他已安排的任务有机会继续。单独调用后，还需要 await 或安排任务来运行。',
                         '__init__':'对象创建后的初始化方法，给当前对象准备数据。前后各两个下划线，这个特殊名字不能随意改写。',
                         'self':'当前正在处理的对象。普通实例方法通过对象调用时，会自动收到它；self 是习惯用名，不是关键字。',
                         '(':'这里开始列出函数接收哪些参数。这是定义的参数表，还没有调用函数。',
                         ')':'这里结束参数表。', ',':'分开相邻的参数。',
                         ':':'在参数名后引出类型提示；在整个函数头末尾引出函数体，下面用缩进表示所属步骤。',
                         '=':'在参数定义中设置默认值：调用时省略这个参数，就使用右边的值。',
                         '->':'后面是返回类型提示；这不是交回结果的 return 语句。'}.get(t.string)
                    if t.string=='/':m='这个分隔符前面的参数只能按位置提供，不能写成参数名=值。'
                    if t.string=='*':m='把额外按位置提供的值收进 '+n.args.vararg.arg+'；后面的参数需要按名字提供。' if n.args.vararg else '从这里开始，后面的参数必须按名字提供。'
                    if t.string=='**':m='把额外按名字提供的参数收成一个字典；字典记录参数名和对应的值。'
                    if m:add(t,m)
                for a in n.args.posonlyargs+n.args.args+n.args.kwonlyargs:
                    if a.annotation:
                        for t in self.tokens_for(a.annotation):
                            m={'str':'类型提示：预期是文字；不会自动把收到的值转成文字。','int':'类型提示：预期是整数；不会自动转换输入。',
                               '|':'在这个类型提示中表示两种类型都可以；例如 Event | None 接受事件对象或 None。',
                               'None':'这里表示也可以没有提供具体对象。'}.get(t.string)
                            if m:add(t,m)
                if n.returns:
                    for t in self.tokens_for(n.returns):
                        if t.string in ('tuple','[',']',',') and isinstance(n.returns,ast.Subscript) and isinstance(n.returns.value,ast.Name) and n.returns.value.id=='tuple':
                            add(t,{'tuple':'这里提示结果是一组有顺序的值，叫元组；不是在这里创建结果。','[':'开始列出元组各项的预期类型；这里不是按位置取值。',']':'结束这组类型提示。',',':'分隔各项的类型提示；例如 tuple[str, int] 提示第一项是文字、第二项是整数。'}[t.string])
                        if t.string=='None':
                            add(t,'返回类型提示：这个方法不交回具体业务结果。对于 __init__，这不表示创建对象的表达式会得到 None。' if isinstance(n.returns,ast.Constant) and n.returns.value is None else '这个返回类型提示中允许出现 None；是否实际返回 None，要看函数中的 return 和执行路径。')
            if isinstance(n,ast.Call):
                is_super = (self.e.semantics.call(n) or {}).get('id') == 'py.super'
                func_end=span(n.func,self.source)
                for t in ts:
                    if is_super and t.string=='super':add(t,'Python 内置工具：帮助找到继承关系中后续实现的方法。它不会新建一个父类对象。')
                    if is_super and t.string=='__init__':add(t,'查找已有的初始化方法；这里要复用它，继续给同一个对象准备数据。')
                    if t.string=='(':
                        p=self.part(t,'')
                        if (p['start'],p['startColumn']) >= (func_end['end'],func_end['endColumn']):
                            add(t,'调用前面的功能，把括号内的数据交给它。空括号表示没有在这里手写参数。')
                            break
                if is_super:
                    # The first pair belongs to the inner super() call.
                    i=next((i for i,t in enumerate(ts) if t.string=='super'),-1)
                    if i>=0 and i+1<len(ts):add(ts[i+1],'调用 super，得到帮助查找继承方法的对象。在这种实例方法中，Python 从当前类和 self 获取所需信息，所以括号里不用填写。')
                for k in n.keywords:
                    for t in self.tokens_for(k.value):
                        if isinstance(k.value,ast.Name):add(t,'这里读取当前变量 '+k.value.id+' 的值，作为参数传出去。')
                    if k.arg:
                        kt=[t for t in ts if t.string==k.arg and t.start[0]==k.value.lineno]
                        if kt:add(kt[0],'接收方的参数名 '+k.arg+'。等号右边提供要交给它的值；这是按名字传参数。')
                        value_start=span(k.value,self.source)
                        before=[t for t in ts if t.string=='=' and (self.part(t,'')['end'],self.part(t,'')['endColumn'])<=(value_start['start'],value_start['startColumn'])]
                        if before:add(before[-1],'这里按名字传参数：左边是接收方的参数名，右边是本次提供的值；不会在这里给同名本地变量重新赋值。')
                    else:
                        value_start=span(k.value,self.source)
                        before=[t for t in ts if t.string=='**' and (self.part(t,'')['end'],self.part(t,'')['endColumn'])<=(value_start['start'],value_start['startColumn'])]
                        if before:add(before[-1],'把右边对应表里的名字和值展开，作为这次调用的具名参数。重复名字或无效参数名可能报错。')
                for arg in n.args:
                    if isinstance(arg,ast.Starred):
                        star=next((t for t in self.tokens_for(arg) if t.string=='*'),None)
                        if star:add(star,'把后面可逐项读取的内容展开，依次作为这次调用的位置参数。')
                for t in ts:
                    if t.string==',':add(t,'分开这次调用中提供的参数。')
                    if t.string==')':add(t,'结束与前面左括号配对的调用参数列表。')
            if isinstance(n,ast.Attribute):
                for t in ts:
                    if t.string=='.':add(t,'从左边的对象或模块上，找到右边指定的属性或方法。这里不是小数点。')
                    if t.string=='self':add(t,'当前正在处理的这个对象；点号后面是它保存的数据或提供的方法。')
            if isinstance(n,(ast.Assign,ast.AnnAssign)):
                for t in ts:
                    if t.string=='=':
                        add(t,'先取得右边的值，再把它保存到左边的位置；这是赋值，不是比较相等。');break
            if isinstance(n,ast.Return):
                for t in self.tokens_for(n):
                    if t.string=='return':add(t,'把后面的结果交回调用处，并结束这次函数处理。')
                    if t.string==',' and isinstance(n.value,ast.Tuple):add(t,'这里用逗号把各项装成一个元组，再一次交回；不是交回多次。')
        return sorted(result,key=lambda p:(p['start'],p['startColumn']))

    def decorate(self, node, block):
        g=block['guide']
        doc=ast.get_docstring(node)
        g['basis']='用途引用该函数的作者说明；步骤来自源码结构，作者说明可能与实现不一致。' if doc else '用途与步骤来自当前函数的源码结构；此函数没有提供作者说明。'
        g['validation']='只读取源码，没有运行这段程序；运行是否成功尚未验证。'
        g['parts']=self.parts(node)
        positional=node.args.posonlyargs+node.args.args
        defaults=dict(zip([a.arg for a in positional][-len(node.args.defaults):],node.args.defaults)) if node.args.defaults else {}
        defaults.update({a.arg:d for a,d in zip(node.args.kwonlyargs,node.args.kw_defaults) if d is not None})
        instance=self.e.owner(node) and positional and positional[0].arg=='self' and not any(isinstance(d,ast.Name) and d.id=='staticmethod' for d in node.decorator_list)
        inputs=[]
        for a in positional+node.args.kwonlyargs:
            if instance and a is positional[0]:continue
            text=a.arg+'：'+('可以省略，省略时用 '+self.e.raw(defaults[a.arg])+'。' if a.arg in defaults else '调用时需要提供。')
            if a.arg in defaults and isinstance(defaults[a.arg],ast.Constant) and defaults[a.arg].value is None:
                text=a.arg+'：可以省略，省略时用 None，表示这里没有提供具体对象。'
            if a.annotation:
                kind={'str':'文字','int':'整数','float':'数值','bool':'True 或 False'}.get(self.e.raw(a.annotation))
                if kind:text+=' 预期提供'+kind+'。'
            inputs.append(text)
        if node.args.vararg:inputs.append('*'+node.args.vararg.arg+'：把额外按顺序提供的参数收集起来。')
        if node.args.kwarg:inputs.append('**'+node.args.kwarg.arg+'：把额外按名字提供的参数收集起来。')
        plain=dict(input='\n'.join(inputs) or '不需要另外提供参数。')
        if g.get('milestones'):
            plain['why']='这组步骤中可以看到：'+' → '.join(x['title'] for x in g['milestones'])+'。点选处理环节，可以继续看每一步。'
        own=list(own_nodes(node))
        fields=[]
        for x in own:
            if isinstance(x,(ast.Assign,ast.AnnAssign)) and x.value is not None:
                for t in x.targets if isinstance(x,ast.Assign) else [x.target]:
                    if instance and isinstance(t,ast.Attribute) and isinstance(t.value,ast.Name) and t.value.id=='self':
                        fields.append((t.attr,self.e.raw(x.value)))
        supers=[x for x in own if isinstance(x,ast.Call) and (self.e.semantics.call(x) or {}).get('id')=='py.super']
        super_ranges=[span(x.func.value,self.source) for x in supers]
        block['learning']=[x for x in block.get('learning',[]) if not (x.get('gap') and any(all(x.get(k)==r[k] for k in r) for r in super_ranges))]
        returns=[x for x in own if isinstance(x,ast.Return)]
        if instance and node.name=='__init__':
            plain['title']='做好开始前的准备'
            plain['purpose']=('先使用已有的准备步骤，再保存这里设置的数据，供这个新对象后续工作使用。' if supers else '保存这里设置的数据，供这个新对象后续工作使用。')
            if fields and len(fields)<=3 and not supers:
                plain['purpose']='把 '+'、'.join(value for name,value in fields)+' 保存到当前对象上；后面的步骤可以通过 '+'、'.join('self.'+name for name,value in fields)+' 读取。'
            plain['output']='这个初始化方法本身不交回业务结果。正常创建对象时，调用者得到的是新对象，不能把这里的 None 理解为“没有创建对象”。'
            plain['why']='让同一个对象完成这里列出的准备工作，供后续方法使用。'
        elif doc:
            plain['purpose']='按作者说明：'+doc.split('\n')[0].strip().rstrip('。')+'。'
            plain['title']='作者说明：'+doc.split('\n')[0].strip().rstrip('。')[:32]
        bound=re.search(r'最多允许 (\d+) 轮',g['purpose'])
        if bound:
            plain['purpose']=plain.get('purpose',g['purpose']).rstrip('。')+'。代码指定的错误最多允许 '+bound.group(1)+' 轮（包含第一次）；成功时可提前结束。'
        if fields:
            field_text='从赋值语句可以看到：'+'；'.join('把 '+value+' 保存到当前对象的 '+name for name,value in fields[:6])+'。'
            plain['output']=plain.get('output','')+'\n'+field_text
        elif not returns and node.name!='__init__':
            plain['output']='如果正常执行到末尾，这次调用没有交回具体结果（Python 用 None 表示）。调用其他工具是否改变了数据，需要查看相应实现。'
        from call_reading_python import batch_plain, decorate_call
        batch = batch_plain(node, self.e)
        if batch:
            plain.update(batch)
        g['plain']=plain
        g['needsSource']=[x for x in g.get('limits',[]) if '本文件未找到' in x]
        g['limits']=[x for x in g.get('limits',[]) if x not in g['needsSource']]
        owner=self.e.owner(node)
        base_names={b.id for b in owner.bases if isinstance(b,ast.Name)} if owner else set()
        local_bases=[c for c in self.e.tree.body if isinstance(c,ast.ClassDef) and c.name in base_names]
        base_refs=[]
        for c in local_bases:
            target=next((x for x in c.body if isinstance(x,ast.FunctionDef) and x.name=='__init__'),c)
            base_refs.append(dict(span(target,self.source),title=c.name+' · 继承来源',purpose='这是当前文件中的继承来源定义；实际方法查找仍以继承关系为准。'))
        if supers:
            if base_refs:g.setdefault('related',[]).extend(base_refs)
            if not base_refs or len(local_bases)<len(owner.bases):
                g['needsSource'].append('继承来源的完整实现：当前文件没有展示全部定义，无法继续核对 __init__ 内部保存或修改什么。')
            else:g['limits'].append('继承来源在当前文件中，下面可点开查看；具体执行哪个初始化方法仍取决于继承查找顺序。')
        def visit(items):
            for item in items:
                candidates=[n for n in own if isinstance(n,ast.stmt) and getattr(n,'lineno',0)==item['start'] and getattr(n,'end_lineno',0)==item['end']]
                n=candidates[0] if candidates else None
                guide=item.get('guide')
                if n and item['kind'] in ('step','return','await'):
                    if not guide:
                        guide=item['guide']=dict(title=item['label'],purpose=item.get('detail',''),basis='依据当前语句的源码写法。',limits=[])
                    guide['parts']=self.parts(n)
                if guide:
                    guide['validation']=g['validation']
                    if guide.get('id')=='py.super':
                        guide['plain']=dict(purpose='复用继承来的初始化步骤，继续为当前这个对象做准备；这里不会另外创建一个父类对象。',
                            input='把这次收到的参数传给找到的初始化方法：'+guide.get('input',''),
                            output='已有的初始化方法会处理同一个对象。具体保存了哪些数据，要查看那个方法的定义。',
                            why='已有的准备步骤可以继续使用，不必在这里重复写一遍。是否必须调用，取决于继承来源的设计。')
                        guide['related']=base_refs
                        guide['needsSource']=[x for x in g['needsSource'] if '继承来源' in x]
                    if n and isinstance(n,(ast.Assign,ast.AnnAssign)) and n.value is not None and not guide.get('id'):
                        targets=n.targets if isinstance(n,ast.Assign) else [n.target]
                        if len(self.e.raw(n.value))<=100:
                            guide.setdefault('plain',{})['purpose']='先取得 '+self.e.raw(n.value)+' 的值，再保存到 '+ '、'.join(self.e.raw(t) for t in targets)+'。'
                    if n:
                        decorate_call(n, item, self.e)
                    if isinstance(n,ast.Return) and isinstance(n.value,ast.Tuple) and not any(isinstance(x,ast.Starred) for x in n.value.elts):
                        guide['title']='把 '+str(len(n.value.elts))+' 项结果一起交回'
                        guide.setdefault('plain',{})['purpose']='把 '+str(len(n.value.elts))+' 项按源码顺序装成一个元组（一组有顺序的值），交回调用处，结束这次处理。逗号用于分开这些项，不是依次返回多次。'
                for key in ('children','otherwise','afterLoop','handlers','afterSuccess','finalizer'):visit(item.get(key,[]))
        visit(block.get('controlFlow',[]))
