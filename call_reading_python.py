"""Explain visible calls and tuple returns without guessing the callee's type."""
import ast
from spans_python import span


def batch_shape(node):
    if not isinstance(node, ast.FunctionDef) or node.decorator_list:
        return None
    body = list(node.body)
    if body and isinstance(body[0], ast.Expr) and isinstance(body[0].value, ast.Constant) and isinstance(body[0].value.value, str):
        body = body[1:]
    if len(body) < 3 or not isinstance(body[-1], ast.Return) or not isinstance(body[-1].value, ast.Tuple):
        return None
    assigns = body[:-1]
    if not all(isinstance(s, ast.Assign) and len(s.targets) == 1 and isinstance(s.targets[0], ast.Name)
               and isinstance(s.value, ast.Call) and isinstance(s.value.func, ast.Name)
               and s.value.keywords and not s.value.args and all(k.arg for k in s.value.keywords)
               for s in assigns):
        return None
    names = [s.targets[0].id for s in assigns]
    if len(set(names)) != len(names) or len({s.value.func.id for s in assigns}) != 1:
        return None
    if any(not isinstance(n, ast.Name) for n in body[-1].value.elts) or [n.id for n in body[-1].value.elts] != names:
        return None
    # Await/yield and nested calls can change the apparent process; retain the general guide.
    if any(isinstance(n, (ast.Call, ast.Await, ast.Yield, ast.YieldFrom, ast.NamedExpr, ast.Lambda))
           for s in assigns for k in s.value.keywords for n in ast.walk(k.value)):
        return None
    if assigns[0].value.func.id in names:
        return None
    return assigns


def batch_plain(node, explanation):
    assigns = batch_shape(node)
    if not assigns:
        return None
    name, count = assigns[0].value.func.id, len(assigns)
    from semantics_python import own_nodes
    shadowed = any((isinstance(n,ast.arg) and n.arg==name) or (isinstance(n,ast.Name) and n.id==name and isinstance(n.ctx,(ast.Store,ast.Del))) for n in own_nodes(node))
    imported = bool(explanation.semantics.library(assigns[0].value.func)) and not shadowed
    display = name+('（从其他文件引入的工具）' if imported else '')
    return dict(title='分别准备 '+str(count)+' 份结果，再一起交回',
                purpose='把 '+str(count)+' 组数据分别交给 '+display+'，将每次得到的结果记下来，最后按顺序一起交回。',
                output='正常完成后，交回一个包含 '+str(count)+' 项的元组，也就是按顺序装在一起的一组值：'+'、'.join(s.targets[0].id for s in assigns)+'。',
                why='调用这里一次，就能按源码顺序完成这 '+str(count)+' 次调用并拿到整组结果。中途报错时，后续步骤可能无法完成。')


def value_origin(value, e):
    if isinstance(value, ast.Attribute):
        if isinstance(value.value, ast.Name) and value.value.id == 'self':
            return '读取当前对象保存的 '+value.attr
        return '从 '+e.raw(value.value)+' 读取 '+value.attr
    if isinstance(value, ast.Name):
        return '读取 '+value.id+' 当前的值'
    return '先求出 '+e.raw(value)+' 的值'


def decorate_call(statement, item, e):
    if not isinstance(statement, (ast.Assign, ast.AnnAssign)) or not isinstance(statement.value, ast.Call):
        return
    guide = item.get('guide', {})
    if guide.get('id'):
        return  # Keep more specific semantic explanations, e.g. JSON and super.
    call = statement.value
    if not call.keywords or not all(k.arg for k in call.keywords) or any(isinstance(a,ast.Starred) for a in call.args):
        return
    targets = statement.targets if isinstance(statement, ast.Assign) else [statement.target]
    name, target = e.raw(call.func), '、'.join(e.raw(t) for t in targets)
    item['label'] = '调用 '+name+'，把结果记为 '+target
    guide['title'] = item['label']
    guide.setdefault('plain', {}).update(purpose='先读取下面列出的值，再交给 '+name+'；这次调用正常完成后，把得到的结果保存为 '+target+'。',
        output='后续代码可以通过 '+target+' 使用这次调用的结果。',
        why='括号里每个“名字=值”都在说明：把哪个值交给对方的哪个参数。')
    guide['arguments'] = [dict(name='第 '+str(i+1)+' 个位置参数',source=e.raw(v),plain=value_origin(v,e),**span(v,e.source)) for i,v in enumerate(call.args)]
    guide['arguments'] += [dict(name=k.arg,source=e.raw(k.value),plain=value_origin(k.value,e),**span(k.value,e.source)) for k in call.keywords]
    guide['needsSource'] = guide.get('needsSource', []) + ['这里只能确定怎样调用 '+name+'。它内部是否创建对象、发送请求或做其他工作，需要查看对应定义。']
    item['guide'] = guide
