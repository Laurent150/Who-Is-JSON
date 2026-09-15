"""Statement-sized reading lessons. Inspect AST only; never execute user code."""
import ast
import tokenize
import keyword
from spans_python import span


def reading_units(tree, e):
    from pedagogy_python import Pedagogy
    pedagogy = getattr(e, 'pedagogy', None) or Pedagogy(e)
    units = []
    definitions = (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)
    containers = definitions + (ast.If, ast.For, ast.AsyncFor, ast.While, ast.With, ast.AsyncWith, ast.Try)
    keywords = {
        'def': '定义一个函数，也就是给一组可重复使用的步骤起名字。',
        'class': '定义一种类，用来组织对象的数据和方法。',
        'for': '每次取出一项，执行下面缩进的步骤，再处理下一项。',
        'in': '在这条循环头中，右边提供要逐项读取的内容。',
        'if': '检查后面的条件；成立时才进入下面缩进的代码。',
        'while': '每轮先检查条件，成立就继续，不成立就停止。',
        'return': '结束这次函数调用，把结果交给调用它的位置。',
        'import': '引入模块或工具，让后面的代码可以使用它。',
        'from': '指定从哪个模块引入名字。',
        'as': '为引入的名字或接收的对象指定本地名称。',
        'break': '离开当前循环，继续循环后面的代码。',
        'continue': '跳过本轮剩余步骤，进入下一轮。',
        'pass': '占住一个语法位置，这一步不做操作。',
    }

    def value(n):
        if isinstance(n, ast.Call) and isinstance(n.func, ast.Name) and e.teacher.builtin(n.func.id):
            if n.func.id == 'round' and 1 <= len(n.args) <= 2 and not n.keywords:
                precision = n.args[1] if len(n.args) == 2 else None
                if isinstance(precision, ast.Constant) and type(precision.value) is int and precision.value >= 0:
                    return '将 ' + e.raw(n.args[0]) + ' 的计算结果舍入到小数点后 ' + str(precision.value) + ' 位'
            if n.func.id == 'print':
                return '显示 ' + ('、'.join(e.raw(a) for a in n.args) or '一个空行')
        return e.value(n)

    for n in ast.walk(tree):
        if not isinstance(n, ast.stmt):
            continue
        if len(units) >= 350:
            break
        location = span(n, e.source)
        if isinstance(n, containers):
            # Stop at the header colon, respecting parentheses and same-line bodies.
            depth = 0
            for t in pedagogy.tokens_for(n):
                if t.type != tokenize.OP:
                    continue
                if t.string in '([{': depth += 1
                elif t.string in ')]}': depth -= 1
                elif t.string == ':' and depth == 0:
                    p = pedagogy.part(t, '')
                    location.update(end=p['end'], endColumn=p['endColumn'])
                    break
        text = None
        details = ''
        if isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef)):
            args = n.args.posonlyargs + n.args.args
            defaults = dict(zip([a.arg for a in args][-len(n.args.defaults):], n.args.defaults)) if n.args.defaults else {}
            defaults.update({a.arg: d for a, d in zip(n.args.kwonlyargs, n.args.kw_defaults) if d is not None})
            labels = [a.arg + ('（省略时使用 ' + e.raw(defaults[a.arg]) + '）' if a.arg in defaults else '') for a in args + n.args.kwonlyargs]
            text = '定义一个叫 ' + n.name + ' 的函数。' + ('它接收 ' + '、'.join(labels) + '。' if labels else '这里没有声明普通参数。')
            details = '下面缩进的代码属于这个函数，在调用时执行。默认值和装饰器可能在定义时求值。'
            if isinstance(n, ast.AsyncFunctionDef): details += '直接调用异步函数先得到协程；需要等待或安排它运行。'
        elif isinstance(n, ast.ClassDef): text = '定义一个叫 ' + n.name + ' 的类，在其中组织数据和方法。'
        elif isinstance(n, (ast.For, ast.AsyncFor)):
            text = '从 ' + e.raw(n.iter) + ' 中依次取出一项，暂时叫作 ' + e.raw(n.target) + '，然后执行下面缩进的步骤。'
            details = '每一轮会更新这个名字对应的值。遇到 break、return 或错误时，流程可能提前离开。'
            if isinstance(n, ast.AsyncFor): text = '异步读取：' + text
        elif isinstance(n, (ast.If, ast.While)):
            text = ('检查：' if isinstance(n, ast.If) else '每一轮先检查：') + e.value(n.test) + '。条件成立才执行下面缩进的代码。'
            details = '条件不成立时，转到其他分支或后续代码。' if isinstance(n, ast.If) else '执行完循环体后，再检查一次条件。'
        elif isinstance(n, ast.Assign):
            text = '先取得右边的值：' + value(n.value) + '。再把它保存到 ' + '、'.join(e.raw(t) for t in n.targets) + '，供后面的代码使用。'
        elif isinstance(n, ast.AugAssign):
            op = {ast.Add: '加上', ast.Sub: '减去', ast.Mult: '乘以', ast.Div: '除以'}.get(type(n.op))
            if op:
                text = '读取 ' + e.raw(n.target) + ' 原有的值，' + op + ' ' + e.raw(n.value) + '，再保存回 ' + e.raw(n.target) + '。'
                details = '这里按数值运算说明；文字、容器或自定义对象可能有不同的运算行为。'
        elif isinstance(n, ast.Return):
            text = ('取得结果：' + value(n.value) + '。然后交给调用这个函数的位置。' if n.value else '结束这次调用，交回 None，表示没有具体结果。')
            details = '到这里结束本次函数处理；如果所在范围有 finally 等收尾步骤，仍可能执行。'
        elif isinstance(n, ast.Expr) and isinstance(n.value, ast.Constant) and isinstance(n.value.value, str):
            text = '这里是一段字符串，可能用作作者说明；文字内容不等于已验证的代码行为。'
        elif isinstance(n, ast.Expr): text = value(n.value) + '。'
        if not text:
            text = e.statement(n)
        if not text:
            text = '这句使用 ' + type(n).__name__ + ' 结构，当前没有完整的逐句解释。可查看源码或使用 AI 补充。'

        basics = [p for p in pedagogy.parts(n) if (p['start'], p['startColumn']) >= (location['start'], location['startColumn']) and (p['end'], p['endColumn']) <= (location['end'], location['endColumn'])]
        known = {(p['start'], p['startColumn']) for p in basics}
        for t in pedagogy.tokens_for(n):
            p = pedagogy.part(t, '')
            if (p['end'], p['endColumn']) > (location['end'], location['endColumn']): break
            if (p['start'], p['startColumn']) in known: continue
            meaning = keywords.get(t.string)
            if t.string == 'in' and not isinstance(n, (ast.For, ast.AsyncFor)): meaning = '检查左边的值是否包含在右边的内容中。'
            if t.string == ':' and isinstance(n, containers): meaning = '引出下面的代码块；缩进表示哪些语句属于它。'
            if t.string == '+=': meaning = '把右边的值加到左边原有的值上，并保存结果；具体运算取决于类型。'
            if t.string in ('>', '<', '>=', '<=', '==', '!='): meaning = '比较左右两边的值，判断条件是否成立。'
            if t.type == tokenize.NUMBER: meaning = '直接写出的数字值：' + t.string + '。'
            if not meaning and t.type == tokenize.NAME and not keyword.iskeyword(t.string):
                meaning = '源码中的名字 ' + t.string + '。它的值或行为需要结合定义、参数或赋值位置理解。'
            if meaning: basics.append(pedagogy.part(t, meaning))

        ancestor = e.parents.get(n)
        context = None
        while ancestor:
            if isinstance(ancestor, containers):
                context = dict(span(ancestor, e.source), title='属于 ' + getattr(ancestor, 'name', '第 ' + str(ancestor.lineno) + ' 行开始的代码块'))
                break
            ancestor = e.parents.get(ancestor)
        units.append(dict(location, text=text, detail=details, basics=basics, context=context, kind=type(n).__name__))
    return sorted(units, key=lambda u: (u['start'], u['startColumn'], u['end']))
