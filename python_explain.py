"""Source-grounded Python explanations. No imports or execution of submitted code."""
import ast
import re


def headline(node):
    return (ast.get_docstring(node) or '').split('\n')[0].strip()[:240]


def terms(text):
    glossary={'token':'模型计算内容长度的小单位，不等于一个汉字或一个英文单词。','LLM':'负责理解和生成文字的 AI 模型。','上下文窗口':'模型一次能参考的内容容量；历史过长时，程序可能需要压缩或删减。','基类':'供其他类继承和复用的一套数据与操作。','阈值':'触发某个操作的界线；超过它才采取下一步行动。'}
    return [dict(name=k,meaning=v) for k,v in glossary.items() if k in text]


class PythonExplanation:
    def __init__(self, source, tree, teacher):
        self.source, self.tree, self.teacher = source, tree, teacher
        self.parents = {child: parent for parent in ast.walk(tree) for child in ast.iter_child_nodes(parent)}
        self.raw_cache = {}
        from spans_python import SourceIndex
        self.source_index = SourceIndex(source)
        from semantics_python import Semantics
        self.semantics = Semantics(self)
        self.constants = {}
        for node in tree.body:
            if isinstance(node, ast.Assign) and isinstance(node.value, ast.Constant):
                for target in node.targets:
                    if isinstance(target, ast.Name):
                        self.constants[target.id] = node.value.value
        for name in list(self.constants):
            stores=sum(isinstance(n,ast.Name) and n.id==name and isinstance(n.ctx,ast.Store) for n in ast.walk(tree))
            if stores!=1 or any(isinstance(n,ast.arg) and n.arg==name for n in ast.walk(tree)):
                self.constants.pop(name)

    def raw(self, node):
        if node not in self.raw_cache:self.raw_cache[node] = self.source_index.segment(node)
        return self.raw_cache[node]

    def owner(self, node):
        while node in self.parents:
            node = self.parents[node]
            if isinstance(node, ast.ClassDef):
                return node
        return None

    def local_call(self, node):
        if isinstance(node.func, ast.Attribute) and isinstance(node.func.value, ast.Name):
            owner = self.owner(node)
            if owner and node.func.value.id == 'self':
                if any(isinstance(x,ast.Attribute) and isinstance(x.ctx,(ast.Store,ast.Del)) and self.raw(x)==self.raw(node.func) for x in ast.walk(owner)):
                    return None
                return next((x for x in owner.body if isinstance(x, (ast.FunctionDef, ast.AsyncFunctionDef)) and x.name == node.func.attr), None)
        if isinstance(node.func, ast.Name):
            from semantics_python import own_nodes
            if any(isinstance(x,ast.Name) and x.id==node.func.id and isinstance(x.ctx,(ast.Store,ast.Del)) for x in own_nodes(self.tree)):
                return None
            if sum(isinstance(x,(ast.FunctionDef,ast.AsyncFunctionDef,ast.ClassDef)) and x.name==node.func.id for x in self.tree.body)>1:
                return None
            scope = self.semantics.scope(node)
            from semantics_python import own_nodes
            if scope is not self.tree and any((isinstance(x,ast.arg) and x.arg==node.func.id) or (isinstance(x,ast.Name) and x.id==node.func.id and isinstance(x.ctx,(ast.Store,ast.Del))) for x in own_nodes(scope)):
                return None
            return next((x for x in self.tree.body if isinstance(x, (ast.FunctionDef, ast.AsyncFunctionDef)) and x.name == node.func.id), None)
        return None

    def library_name(self, node):
        raw = self.raw(node)
        first, *rest = raw.split('.')
        if first in self.teacher.imports and first not in self.teacher.defs:
            return '.'.join([self.teacher.imports[first], *rest])
        return ''

    def value(self, node, depth=0):
        if node is None:
            return '没有结果（None）'
        if depth > 5:
            return '这段表达式的结果（展开源码查看）'
        v = lambda n: self.value(n, depth + 1)
        if isinstance(node, ast.Constant):
            if node.value is None: return '没有内容（None）'
            if node.value is True: return '是（True）'
            if node.value is False: return '否（False）'
            if node.value == '': return '空文字'
            return repr(node.value) if not isinstance(node.value, str) else '文字 ' + repr(node.value[:65])
        if isinstance(node, ast.Name):
            errors={'ValueError':'提供的值不符合要求','KeyError':'字典中缺少指定的键','TypeError':'提供的类型或参数不符合要求','IndexError':'读取的位置超出范围'}
            if node.id in errors and self.teacher.builtin(node.id):return node.id+'（'+errors[node.id]+'）'
            return str(self.constants[node.id]) if node.id in self.constants else node.id
        if isinstance(node, ast.Attribute):
            if self.semantics.library(node)=='json.JSONDecodeError':return self.raw(node)+'（JSON 文字格式无法读取）'
            if isinstance(node.value, ast.Name) and node.value.id == 'self':
                return '当前对象保存的 ' + node.attr
            return self.raw(node)
        if isinstance(node, ast.Await):
            return '等待完成后取得结果：' + v(node.value)
        if isinstance(node,ast.IfExp):
            return '如果 '+v(node.test)+' 成立，就用 '+v(node.body)+'；否则用 '+v(node.orelse)
        if isinstance(node,ast.Lambda):
            return '准备一个简短的函数；调用它时再计算冒号右边的结果'
        if isinstance(node,(ast.Yield,ast.YieldFrom)):
            return ('逐项转交 '+v(node.value)+' 提供的结果' if isinstance(node,ast.YieldFrom) else '提供这一项并暂停：'+v(node.value))
        if isinstance(node, ast.UnaryOp) and isinstance(node.op, ast.Not):
            return v(node.operand) + ' 不成立或没有提供'
        if isinstance(node, ast.BoolOp):
            if isinstance(node.op,ast.Or):
                return '依次选第一个成立（非空等）的值；如果都不成立就用最后一个：'+' → '.join(v(x) for x in node.values)
            return '从左到右检查；遇到不成立的值就交回它，否则用最后一个：'+' → '.join(v(x) for x in node.values)
        if isinstance(node, ast.Compare):
            names = {ast.Eq:'等于', ast.NotEq:'不等于', ast.Gt:'大于', ast.GtE:'至少为', ast.Lt:'小于', ast.LtE:'不超过', ast.In:'包含在', ast.NotIn:'不包含在', ast.Is:'是同一个对象：', ast.IsNot:'不是同一个对象：'}
            return '，并且 '.join(v(left)+' '+names.get(type(op), '比较')+' '+v(right) for left,op,right in zip([node.left]+node.comparators,node.ops,node.comparators))
        if isinstance(node, ast.BinOp):
            if isinstance(node.op,ast.Div) and self.semantics.path_value(node.left):return '按 Path 路径用法，把 '+v(node.left)+' 和 '+v(node.right)+' 拼成路径'
            if isinstance(node.op, ast.FloorDiv): return v(node.left) + ' 除以 ' + v(node.right) + '，再向下取整'
            op = {ast.Add:'加上', ast.Sub:'减去', ast.Mult:'乘以', ast.Div:'除以', ast.Mod:'取余或填入文字（取决于左侧类型）'}.get(type(node.op),'进行运算')
            return v(node.left) + ' ' + op + ' ' + v(node.right)
        if isinstance(node, (ast.List, ast.Tuple, ast.Set)):
            return '、'.join(v(x) for x in node.elts) if node.elts else '一个空列表' if isinstance(node, ast.List) else '空内容'
        if isinstance(node, ast.Dict):
            if len(node.keys)<=3 and all(isinstance(x,(ast.Constant,ast.Name)) for x in node.values) and all(k is not None for k in node.keys):
                return '一份对应表，包含 '+ '、'.join(self.raw(k)+'='+v(x) for k,x in zip(node.keys,node.values))
            return '一份对应表，记录 ' + '、'.join(self.raw(k) for k in node.keys if k is not None)[:85]
        if isinstance(node, ast.JoinedStr):
            return '把当前数据填进文字模板'
        if isinstance(node, ast.Subscript):
            if isinstance(node.slice, ast.Slice):
                s = node.slice
                if s.lower is None and isinstance(s.upper, ast.Constant) and isinstance(s.upper.value, int) and s.upper.value >= 0 and s.step is None:
                    return '取 ' + v(node.value) + ' 的前 ' + str(s.upper.value) + ' 项（文字中为字符）'
                return '从 ' + v(node.value) + ' 按指定范围取出一部分'
            return '从 ' + v(node.value) + ' 读取 [' + self.raw(node.slice) + '] 对应的内容'
        if isinstance(node, (ast.ListComp, ast.GeneratorExp)):
            return '逐项计算：' + v(node.elt) + ('，生成新列表' if isinstance(node, ast.ListComp) else '，需要时逐项提供结果')
        if isinstance(node, ast.Call):
            name = self.raw(node.func)
            fact = self.semantics.call(node)
            if fact:
                return fact['purpose']
            args = [v(x) for x in node.args] + [((k.arg + '=') if k.arg else '**') + v(k.value) for k in node.keywords]
            library = self.library_name(node.func)
            if library == 'asyncio.create_task': return '安排任务开始运行：' + (args[0] if args else '所给任务')
            if library == 'asyncio.wait':
                first = any(k.arg == 'return_when' and self.library_name(k.value) == 'asyncio.FIRST_COMPLETED' for k in node.keywords)
                return ('等到任意一个任务先完成，把任务分成“已完成”和“仍在等待”两组；不会自动取消剩余任务' if first else '等待这一组任务达到指定完成条件，再区分已完成与仍在等待的任务')
            if isinstance(node.func, ast.Name) and self.teacher.builtin(name):
                if name == 'len' and args: return args[0] + ' 的长度或项数'
                if name == 'max' and len(args) > 1: return '取这些结果中最大的一个：' + '；'.join(args)
                if name == 'min' and len(args) > 1: return '取这些结果中最小的一个：' + '；'.join(args)
                if name in ('str','int','float') and args: return '把 ' + args[0] + ' 转成 ' + {'str':'文字','int':'整数','float':'小数'}[name]
                if name == 'sum' and args: return '把这些数加起来：' + args[0]
                if name == 'range': return '按 range 指定的起点、终点和步长依次取整数（不包含终点）'
            local = self.local_call(node)
            if local and headline(local): return name + '：按作者说明，' + headline(local) + ('；这次交给它：'+'、'.join(args)[:100] if args else '')
            if isinstance(node.func, ast.Attribute):
                receiver, method = v(node.func.value), node.func.attr
                if method == 'get' and args: return '从 ' + receiver + ' 查找 ' + args[0] + '（若为字典，缺失时用 ' + (args[1] if len(args)>1 else 'None') + '）'
                if method == 'append' and args: return '向 ' + receiver + ' 添加一项：' + args[0] + '（按常见列表用法）'
                if method == 'join' and args: return '用 ' + receiver + ' 连接 ' + args[0] + ' 中的文字（按字符串用法）'
            return '使用 ' + name + ('，处理 ' + '、'.join(args)[:110] if args else '；具体行为见该工具实现')
        return self.raw(node)[:100] or '当前内容'

    def statement(self, node):
        if isinstance(node, ast.AnnAssign) and node.value is None:
            return '提示 '+self.raw(node.target)+' 的预期类型为 '+self.raw(node.annotation)+'；这一行没有给它赋值。'
        if isinstance(node, (ast.Assign, ast.AnnAssign)):
            targets = node.targets if isinstance(node, ast.Assign) else [node.target]
            return '保存为 ' + '、'.join(self.raw(t) for t in targets) + '：' + self.value(node.value)
        if isinstance(node, ast.Return):
            return ('结束这次处理，不交回具体内容' if node.value is None else '交回结果：' + self.value(node.value))
        if isinstance(node, ast.Expr): return self.value(node.value)
        if isinstance(node, ast.AugAssign):
            op={ast.Add:'加上',ast.Sub:'减去',ast.Mult:'乘以',ast.Div:'除以'}.get(type(node.op),'按源码运算符处理')
            return '更新 '+self.raw(node.target)+'：用原值'+op+' '+self.value(node.value)
        if isinstance(node, ast.Pass): return '这里暂时不做任何操作'
        if isinstance(node,(ast.Import,ast.ImportFrom)):return '引入后面要使用的名字：'+self.raw(node)+'；导入时也可能执行对应模块的准备代码。'
        if isinstance(node,ast.Assert):return '检查 '+self.value(node.test)+'；不成立时报告 AssertionError。优化模式可能跳过 assert，不能用它代替必要的输入检查。'
        if isinstance(node,ast.Delete):return '删除指定的名字、属性或项目：'+'、'.join(self.raw(x) for x in node.targets)+'；不等于删除磁盘文件。'
        if isinstance(node,(ast.Global,ast.Nonlocal)):return '声明这些名字使用'+('模块中' if isinstance(node,ast.Global) else '外层函数中')+'的绑定：'+'、'.join(node.names)+'。这条声明本身不赋新值。'
        return None

    def decorate(self, node, block):
        doc = headline(node)
        if doc:
            block['purpose'] = '按代码中的作者说明：' + doc
        elif node.name == '__init__':
            fields = [x.targets[0].attr if isinstance(x,ast.Assign) else x.target.attr for x in node.body if (isinstance(x,ast.Assign) and x.targets and isinstance(x.targets[0],ast.Attribute)) or (isinstance(x,ast.AnnAssign) and isinstance(x.target,ast.Attribute))]
            block['purpose'] = '创建这个对象时，准备它要保存的数据：' + '、'.join(fields)
        else:
            actions = [s for x in node.body for s in [self.statement(x)] if s]
            block['purpose'] = '从源码可见：' + '；'.join(actions[:2]) if actions else '这个功能按下面的判断和步骤处理输入；具体业务用途尚未确认。'
        owner = self.owner(node)
        if owner:block['owner'] = owner.name
        if owner and node.args.args and node.args.args[0].arg == 'self' and not any(isinstance(d,ast.Name) and d.id=='staticmethod' for d in node.decorator_list):
            for symbol in block.get('symbols',[]):
                if symbol['name']=='self':
                    symbol.update(origin='实例方法的常用参数名', meaning='代表当前这个 '+owner.name+' 对象。通过对象调用方法时，Python 自动传入它，不需要另外填写 self。', rename='self 不是关键字，但通常保留这个约定名称。')
            block['inputs'] = block.get('inputs','').replace('self（需要传入）；','').replace('self（需要传入）','无需手动传入 self')
        args_doc = ast.get_docstring(node) or ''
        inputs = []
        defaults = {a.arg:self.value(d) for a,d in zip((node.args.posonlyargs+node.args.args)[-len(node.args.defaults):],node.args.defaults)} if node.args.defaults else {}
        defaults.update({a.arg:self.value(d) for a,d in zip(node.args.kwonlyargs,node.args.kw_defaults) if d is not None})
        for arg in node.args.posonlyargs + node.args.args + node.args.kwonlyargs:
            if arg.arg == 'self' and owner: continue
            description = re.search(r'^\s*'+re.escape(arg.arg)+r':\s*(.+)$',args_doc,re.M)
            kind = {'str':'文字','int':'整数','float':'数值','bool':'是或否（真假值）'}.get(self.raw(arg.annotation) if arg.annotation else '')
            inputs.append(arg.arg + ('：按作者说明，'+description.group(1) if description else '：预期接收'+kind+'（类型提示，不会自动转换）' if kind else '：类型提示为 '+self.raw(arg.annotation)+'；具体定义需对照来源' if arg.annotation else '：调用者提供的内容') + ('；省略时用 '+defaults[arg.arg] if arg.arg in defaults else ''))
        if node.args.kwarg: inputs.append('**'+node.args.kwarg.arg+'：接收额外的具名设置')
        if node.args.vararg: inputs.append('*'+node.args.vararg.arg+'：接收额外的位置参数')
        calls = list(dict.fromkeys(self.raw(x.func) for x in ast.walk(node) if isinstance(x,ast.Call) and self.local_call(x)))
        why = '配合本文件中的功能：'+'、'.join(calls[:7])+'。这些名称对应下面可点开的模块。' if calls else '输入经过这里的步骤，得到返回值或更新对象保存的数据；具体作用以所选步骤为准。'
        block['guide'] = dict(title=(owner.name+'.' if owner else '')+node.name, purpose=block['purpose'], why=why, input='；'.join(inputs), output=block.get('output',''), basis='函数用途引用作者文档字符串（可能过时）；执行步骤来自语法结构。未执行代码，也未验证外部依赖。', limits=[])
        block['guide']['example'] = ''
        block['guide']['terms'] = terms(block['purpose'])
        self.semantics.decorate(node, block)
        from pedagogy_python import Pedagogy
        if not hasattr(self, 'pedagogy'):
            self.pedagogy = Pedagogy(self)
        self.pedagogy.decorate(node, block)

    def document(self):
        doc = headline(self.tree)
        classes = [x for x in self.tree.body if isinstance(x,ast.ClassDef)]
        functions = [x for x in ast.walk(self.tree) if isinstance(x,(ast.FunctionDef,ast.AsyncFunctionDef))]
        purpose = ('作者对本文件的说明：'+doc) if doc else '这份文件定义了 '+str(len(functions))+' 个功能'+('，组织在 '+ '、'.join(x.name for x in classes)+' 等类中' if classes else '')+'。各功能用途见下面目录。'
        if not doc:
            descriptions = [(x.name,headline(x)) for x in classes if headline(x)]
            if descriptions:
                purpose = '作者对主要类的说明：'+'；'.join(name+'：'+description.rstrip('。；; ') for name,description in descriptions[:3])+'。这描述了作者意图，实际处理步骤需要继续对照源码。'
        simple = ('按作者说明：'+doc.rstrip('。')+'。') if doc else ('按作者说明：'+'；'.join(headline(x).rstrip('。；; ') for x in classes if headline(x))+'。' if any(headline(x) for x in classes) else '这份代码定义了 '+str(len(functions))+' 个功能。可以从下面目录选择一个，查看它的处理步骤。')
        from call_reading_python import batch_plain
        batches = [(f,batch_plain(f,self)) for f in functions if batch_plain(f,self)]
        if len(batches)==1:
            f, plain = batches[0]
            simple = '其中 '+f.name+' 的处理过程是：'+plain['purpose']
        return dict(title='先看这份代码的用途',purpose=purpose,plain=dict(purpose=simple),terms=terms(simple),basis='作者说明与本文件结构；作者说明不是运行验证。',limits=['没有执行源码。外部工具的内部行为与业务效果仍需项目上下文核对。'])
