"""Small, conservative algorithm recognizers. Never execute imported code."""
import ast


def annotate(fn, block):
    body = [n for n in fn.body if not (isinstance(n, ast.Expr) and isinstance(n.value, ast.Constant) and isinstance(n.value.value, str))]
    if len(body) not in (2, 3) or not isinstance(body[-1], ast.Return):
        return
    loop = body[-2]
    if not isinstance(loop, ast.While) or loop.orelse or len(loop.body) != 2:
        return
    cmp = loop.test
    if not isinstance(cmp, ast.Compare) or len(cmp.ops) != 1 or not isinstance(cmp.ops[0], ast.Lt) or not isinstance(cmp.left, ast.Name) or not isinstance(cmp.comparators[0], ast.Name):
        return
    lo, hi = cmp.left.id, cmp.comparators[0].id
    middle, branch = loop.body
    if not isinstance(middle, ast.Assign) or len(middle.targets) != 1 or not isinstance(middle.targets[0], ast.Name) or not isinstance(branch, ast.If):
        return
    mid = middle.targets[0].id
    test = branch.test
    if not isinstance(test, ast.Compare) or len(test.ops) != 1 or not isinstance(test.ops[0], (ast.Lt, ast.LtE)) or not isinstance(test.left, ast.Subscript) or not isinstance(test.left.value, ast.Name) or not isinstance(test.comparators[0], ast.Name):
        return
    collection, target = test.left.value.id, test.comparators[0].id
    def same(node, text):
        return ast.dump(node) == ast.dump(ast.parse(text).body[0])
    op = '<=' if isinstance(test.ops[0], ast.LtE) else '<'
    expected = '%s = %s + (%s - %s) // 2' % (mid, lo, hi, lo)
    expected_branch = 'if %s[%s] %s %s:\n    %s = %s + 1\nelse:\n    %s = %s' % (collection, mid, op, target, lo, mid, hi, mid)
    if not same(middle, expected) or not same(branch, expected_branch) or not same(body[-1], 'return ' + lo):
        return
    if len(body) == 3 and not same(body[0], 'if %s < 0:\n    %s = len(%s)' % (hi, hi, collection)):
        return
    right = op == '<='
    block['meaning'] = dict(title='在有序列表中找插入位置', purpose='不断检查范围中间的一项，把不需要的那一半排除，直到确定目标应该放在哪个位置。遇到相同值时，找到它们的%s侧位置。' % ('右' if right else '左'), input='按从小到大排列的列表、目标值，以及有效的查找范围。', output='一个位置编号，从 0 开始；这个功能只找到位置，没有真的插入数据。', why='每轮排除约一半范围，避免从头逐个查看所有元素。', basis='根据中点计算、两侧边界更新和返回位置识别；需要列表有序、边界有效，且比较采用通常的数值含义。')
    block['purpose'] = block['meaning']['purpose']
    block['output'] = block['meaning']['output']
    labels = {loop.lineno: '范围还没缩到一个位置，就继续查找', middle.lineno: '取出当前范围的中间位置', branch.lineno: '中间项' + ('小于或等于' if right else '小于') + '目标值', branch.body[0].lineno: '排除中间项及左半边，继续查右侧', branch.orelse[0].lineno: '缩小右边界，继续查左侧', body[-1].lineno: '交回找到的位置编号'}
    if len(body) == 3:
        labels[body[0].lineno] = '没有指定右边界？'
        labels[body[0].body[0].lineno] = '把列表末尾作为右边界'
    def update(nodes):
        for node in nodes:
            if node['start'] in labels:
                node['label'] = labels[node['start']]
            for key in ('children', 'otherwise', 'afterLoop', 'handlers', 'afterSuccess', 'finalizer'):
                update(node.get(key, []))
    update(block.get('controlFlow', []))
