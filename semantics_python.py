"""Conservative, source-backed behavior facts shared by guides and lessons.

This module reads AST nodes only. It never imports or evaluates submitted code.
Patterns describe observable operations, not inferred author intentions.
"""
import ast
from spans_python import span


def own_nodes(root):
    yield root
    for child in ast.iter_child_nodes(root):
        if isinstance(child, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef, ast.Lambda)):
            continue
        yield from own_nodes(child)


class Semantics:
    def __init__(self, explanation):
        self.e = explanation
        self.source = explanation.source
        self.nodes = list(ast.walk(explanation.tree))
        self.cache = {}

    def scope(self, n):
        while n in self.e.parents:
            n = self.e.parents[n]
            if isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef, ast.Lambda)):
                return n
        return self.e.tree

    def library(self, n):
        name = self.e.library_name(n)
        # Rebinding or modifying imported members makes library semantics uncertain.
        head = self.e.raw(n).split('.')[0]
        for x in self.nodes:
            if isinstance(x, ast.Attribute) and isinstance(x.ctx, (ast.Store, ast.Del)):
                if self.e.raw(x).split('.')[0] == head:
                    return ''
        return name

    def path_value(self, n, depth=0):
        if depth>5:return False
        if isinstance(n,ast.Call) and self.library(n.func) in ('pathlib.Path','pathlib.PurePath','pathlib.PurePosixPath','pathlib.PureWindowsPath'):return True
        if isinstance(n,ast.BinOp) and isinstance(n.op,ast.Div):return self.path_value(n.left,depth+1)
        if isinstance(n,ast.Name):
            scope=self.scope(n)
            if not isinstance(scope,(ast.FunctionDef,ast.AsyncFunctionDef)):return False
            if any(isinstance(x,ast.Name) and x.id==n.id and isinstance(x.ctx,(ast.Store,ast.Del)) for x in own_nodes(scope)):return False
            return any(a.arg==n.id and a.annotation and self.library(a.annotation) in ('pathlib.Path','pathlib.PurePath','pathlib.PurePosixPath','pathlib.PureWindowsPath') for a in scope.args.posonlyargs+scope.args.args+scope.args.kwonlyargs)
        return False

    def string(self, n, depth=0):
        if depth > 8 or n is None:
            return False
        if isinstance(n, (ast.JoinedStr,)) or isinstance(n, ast.Constant) and isinstance(n.value, str):
            return True
        if isinstance(n, ast.Call):
            if self.library(n.func) == 'json.dumps':
                return True
            if self.library(n.func) == 're.sub' and len(n.args) >= 3:
                return self.string(n.args[2], depth + 1)
            if isinstance(n.func, ast.Name) and n.func.id == 'str' and self.e.teacher.builtin('str'):
                return True
            if isinstance(n.func, ast.Attribute) and n.func.attr in ('strip', 'replace'):
                return self.string(n.func.value, depth + 1)
        if isinstance(n, ast.Name):
            scope = self.scope(n)
            # Only propagate through a preceding assignment in the same statement list.
            current = n
            while current in self.e.parents and not isinstance(current, ast.stmt):
                current = self.e.parents[current]
            parent = self.e.parents.get(current)
            body = next((v for _, v in ast.iter_fields(parent) if isinstance(v, list) and current in v), []) if parent else []
            for statement in reversed(body[:body.index(current)] if current in body else []):
                writes = [x for x in own_nodes(statement) if isinstance(x, ast.Name) and x.id == n.id and isinstance(x.ctx, ast.Store)]
                if not writes:
                    continue
                if isinstance(statement, (ast.Assign, ast.AnnAssign)):
                    return self.string(statement.value, depth + 1)
                return False
        return False

    def call(self, n):
        if n in self.cache:
            return self.cache[n]
        self.cache[n] = None
        if not isinstance(n, ast.Call):
            return None
        name = self.library(n.func)
        raw = self.e.raw
        args = [raw(a) for a in n.args]
        settings = [((k.arg + '=') if k.arg else '**') + raw(k.value) for k in n.keywords]
        fact = None
        if name in ('json.loads', 'json.dumps') and n.args:
            reading = name == 'json.loads'
            fact = dict(id='py.json-read' if reading else 'py.json-write',
                        title='把 JSON 文字读成数据' if reading else '把数据写成 JSON 文字',
                        purpose=('把 ' + args[0] + ' 中的 JSON 内容转换成 Python 数据，供后续读取。' if reading else '把 ' + args[0] + ' 转成 JSON 文字，方便保存或传递。'),
                        why=('转换以后，可以从一组内容中按位置取值，或从对应表（字典）中按名字取值；具体取决于 JSON 里记录的内容。' if reading else '不同程序可以通过 JSON 文字交换数据，而不必使用同一种编程语言。'),
                        naming=name + ' 来自 Python 标准库 json，也就是 Python 随安装提供的工具库；点号后的名称由库规定，输入变量名由作者起。',
                        failure='JSON 格式错误会报告 JSONDecodeError；这不等于已经验证字段齐全。' if reading else '不支持的数据类型或循环引用可能导致转换失败。')
        elif name == 're.sub' and len(n.args) >= 3:
            fact = dict(id='py.regex-replace', title='按匹配规则替换文字',
                        purpose='在 ' + args[2] + ' 中查找符合规则的部分，并按替换参数生成新内容。',
                        why='可以一次处理同一类字符；规则决定会改动哪些内容，替换不代表已经修好 JSON。',
                        naming='re 是 Python 标准库；sub 是它提供的替换功能。正则表达式是一种描述“要找什么”的规则。',
                        failure='规则或替换内容不合法可能报错；替换也可能改变原文含义。')
        elif isinstance(n.func, ast.Attribute) and n.func.attr in ('strip', 'replace') and self.string(n.func.value):
            method = n.func.attr
            fact = dict(id='py.text-strip' if method == 'strip' else 'py.text-replace',
                        title='去掉文字两端的空白' if method == 'strip' and not n.args else '去掉两端指定的字符' if method == 'strip' else '替换文字中的指定内容',
                        purpose=('生成去掉两端空白的新文字，中间的空格保留。' if not n.args else '从两端移除参数包含的字符；参数是一组字符，不是完整前后缀。') if method == 'strip' else '按给出的旧文字与新文字进行替换，生成新文字；不是按正则规则匹配。',
                        why='让后续步骤使用整理后的文字；原字符串不会被原地修改。',
                        naming=method + ' 是 Python 字符串提供的方法名；点号前是要处理的文字。',
                        failure='参数类型或数量不符合方法要求时会报错。')
        elif isinstance(n.func, ast.Attribute) and n.func.attr == '__init__' and isinstance(n.func.value, ast.Call) and isinstance(n.func.value.func, ast.Name) and n.func.value.func.id == 'super' and not n.func.value.args and self.e.teacher.builtin('super'):
            fact = dict(id='py.super', title='接着完成继承来的初始化工作',
                        purpose='沿当前类的继承查找顺序，调用后续实现中的 __init__，把参数交给它。',
                        why='让继承来的部分先准备数据，再继续当前类的初始化。究竟保存哪些数据，需要查看对应实现。',
                        naming='super 是 Python 内置工具，__init__ 是创建实例时使用的约定方法名；不是任意起的普通名称。',
                        failure='对应方法不存在、参数不匹配或初始化内部失败，都可能报告错误。')
        if fact:
            fact.update(subject=raw(n.func), input='；'.join(args + settings), basis='语法结构与标准库约定；未执行导入的代码。', limits=[fact['failure']], evidence=[dict(span(n, self.source), label='这一调用的源码依据')])
            if settings:
                fact['purpose'] += ' 本次还设置：' + '；'.join(settings) + '；这些设置可能改变默认行为。'
        self.cache[n] = fact
        return fact

    def retry(self, loop):
        """Recognize a narrow, bounded counter + try/except retry structure."""
        if not isinstance(loop, ast.While) or not isinstance(loop.test, ast.Compare):
            return None
        t = loop.test
        if not isinstance(t.left, ast.Name) or len(t.ops) != 1 or not isinstance(t.ops[0], ast.Lt):
            return None
        name = t.left.id
        bound = t.comparators[0]
        maximum = bound.value if isinstance(bound, ast.Constant) else self.e.constants.get(bound.id) if isinstance(bound, ast.Name) else None
        if type(maximum) is not int or not 0 < maximum <= 1000:
            return None
        parent = self.e.parents.get(loop)
        body = next((v for _, v in ast.iter_fields(parent) if isinstance(v, list) and loop in v), []) if parent else []
        before = body[:body.index(loop)] if loop in body else []
        initial = next((s for s in reversed(before) if isinstance(s, ast.Assign) and any(isinstance(x, ast.Name) and x.id == name for x in s.targets)), None)
        if not initial or not isinstance(initial.value, ast.Constant) or type(initial.value.value) is not int or initial.value.value != 0:
            return None
        if len(loop.body) != 1 or not isinstance(loop.body[0], ast.Try):
            return None
        trial = loop.body[0]
        if not trial.handlers or trial.finalbody or trial.orelse:
            return None
        increments = []
        for h in trial.handlers:
            updates = [s for s in h.body if isinstance(s, ast.AugAssign) and isinstance(s.target, ast.Name) and s.target.id == name and isinstance(s.op, ast.Add) and isinstance(s.value, ast.Constant) and type(s.value.value) is int and s.value.value == 1]
            if len(updates) != 1 or h.body[0] is not updates[0]:
                return None
            increments.extend(updates)
        if not trial.body or not isinstance(trial.body[-1], ast.Return) or any(isinstance(s,ast.Continue) for s in own_nodes(trial)):
            return None
        allowed = {x.target for x in increments} | set(initial.targets)
        for x in own_nodes(self.scope(loop)):
            if isinstance(x, ast.Name) and x.id == name and isinstance(x.ctx, (ast.Store, ast.Del)) and x not in allowed:
                return None
            if isinstance(x, (ast.Global, ast.Nonlocal)) and name in x.names:
                return None
        return dict(id='py.retry', title='失败后重试，有次数上限',
                    purpose='计数从 0 开始；捕获指定错误后加 1，再次尝试。循环条件最多允许 ' + str(maximum) + ' 轮（包含第一次）；提前返回或未处理的错误可使它更早结束。',
                    why='为指定失败提供再次尝试的机会，同时用计数上限避免无限重试；不保证重试一定成功。',
                    basis='已核对初始值、循环上限、错误分支与计数更新；不执行尝试。',
                    evidence=[dict(span(x,self.source),label=label) for x,label in [(initial,'初始计数'),(t,'次数上限')]+[(x,'捕获错误后更新计数') for x in increments]],
                    limits=['只覆盖这个明确的计数重试结构；被调用功能的内部行为未验证。'])

    def field(self, n):
        if not isinstance(n,ast.Subscript) or not isinstance(n.value,ast.Name):
            return None
        statement = n
        while statement in self.e.parents and not isinstance(statement,ast.stmt):
            statement = self.e.parents[statement]
        parent = self.e.parents.get(statement)
        body = next((v for _,v in ast.iter_fields(parent) if isinstance(v,list) and statement in v),[]) if parent else []
        previous = body[:body.index(statement)] if statement in body else []
        for before in reversed(previous):
            writes = [x for x in own_nodes(before) if isinstance(x,ast.Name) and x.id==n.value.id and isinstance(x.ctx,(ast.Store,ast.Del))]
            if not writes:
                continue
            value = getattr(before,'value',None)
            if not isinstance(before,ast.Assign) or not isinstance(value,ast.Call) or self.library(value.func)!='json.loads':
                return None
            key = n.slice.value if isinstance(n.slice,ast.Index) else n.slice
            if not isinstance(key,ast.Constant) or not isinstance(key.value,(str,int)):
                return None
            return dict(id='py.index',title='从转换后的数据中取出 '+repr(key.value),
                        purpose='前面把 JSON 读成了 '+n.value.id+'；这里按 '+repr(key.value)+' 读取其中的一项。',
                        input=n.value.id,output='取出的那一项内容',
                        why='后续可以直接使用这一项，不必继续处理整段 JSON 文字。',
                        naming=n.value.id+' 是作者起的名字；方括号是读取写法，里面的键或位置必须与实际数据对应。',
                        basis='已找到同一组步骤中此前的 JSON 转换赋值和当前读取操作。',
                        evidence=[dict(span(before,self.source),label='数据从这里转换而来'),dict(span(n,self.source),label='读取这一项')],
                        limits=['JSON 的形状和字段没有经过此工具验证；键不存在或类型不符可能报错。'])
        return None

    def decorate(self, root, block):
        facts = []
        for n in own_nodes(root):
            fact = self.call(n) if isinstance(n, ast.Call) else self.retry(n) if isinstance(n, ast.While) else self.field(n) if isinstance(n,ast.Subscript) else None
            if fact:
                facts.append((n, fact))
        def visit(items):
            for item in items:
                candidates = [(n, f) for n, f in facts if item['start'] <= n.lineno and n.end_lineno <= item['end']]
                # Compound control nodes keep their own purpose; details belong to leaf nodes.
                if item['kind'] == 'loop':
                    candidates = [(n, f) for n, f in candidates if f['id'] == 'py.retry' and n.lineno == item['start']]
                elif item['kind'] not in ('step', 'return', 'await'):
                    candidates = []
                if candidates:
                    n, fact = candidates[0]
                    item['guide'] = dict(fact)
                    item['label'] = fact['title']
                    if item['kind'] == 'return':
                        item['guide']['purpose'] += ' 这里将结果交回调用处，结束本次函数处理。'
                    elif isinstance(n, ast.Call):
                        parent = self.e.parents.get(n)
                        if isinstance(parent, (ast.Assign, ast.AnnAssign)):
                            targets = parent.targets if isinstance(parent,ast.Assign) else [parent.target]
                            item['guide']['output'] = '结果保存为 '+ '、'.join(self.e.raw(x) for x in targets)
                for key in ('children','otherwise','afterLoop','handlers','afterSuccess','finalizer'):
                    visit(item.get(key, []))
        visit(block.get('controlFlow', []))
        for n, fact in facts:
            position = span(n, self.source)
            block['learning'] = [x for x in block['learning'] if not (x.get('gap') and all(x.get(k) == position[k] for k in ('start','end','startColumn','endColumn')))]
            block['learning'].append(dict(position,id=fact['id'],context=fact['purpose'],why=fact['why']))
        g = block.get('guide')
        if not g:
            return
        g['evidence'] = [dict(span(root,self.source),label='功能定义与执行步骤')]
        g['milestones'] = [dict(span(n,self.source),title=f['title'],purpose=f['purpose']) for n,f in facts if f['id'] != 'py.super'][:8]
        if len(facts)>8:
            g['limits'].append('处理环节摘要最多列出 8 项；其他步骤请在流程图中查看。')
        retry = next((f for _,f in facts if f['id']=='py.retry'), None)
        if retry:
            g['purpose'] += ' '+retry['purpose']
        if facts:
            g['why'] = '这里可核对的处理包括：'+' → '.join(dict.fromkeys(f['title'] for _,f in facts))+ '。下面可点击对应源码；这不是对所有调用内部行为的推断。'
        for n in own_nodes(root):
            if not isinstance(n,ast.Call) or self.call(n):
                continue
            if isinstance(n.func,ast.Name) and self.e.teacher.builtin(n.func.id):
                continue
            target = self.e.local_call(n)
            if target:
                g.setdefault('related',[]).append(dict(span(target,self.source),title=self.e.raw(n.func),purpose='本文件中的定义；点击定位。'))
            elif isinstance(n.func,ast.Attribute) and isinstance(n.func.value,ast.Name) and n.func.value.id=='self':
                g['limits'].append(self.e.raw(n.func)+'：本文件未找到对应方法；需要提供所属类或继承来源的实现。')
        g['limits'] = list(dict.fromkeys(g['limits']))[:8]
