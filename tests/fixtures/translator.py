"""自编 AST 练习：递归描述一个加法表达式。"""
import ast

def plain(n):
    if isinstance(n, ast.Name):
        return n.id
    if isinstance(n, ast.BinOp):
        left = plain(n.left)
        right = plain(n.right)
        return "%s 加上 %s" % (left, right)
    return "叶子"
