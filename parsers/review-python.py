"""Read UTF-8 source on stdin and extract AST syntax. Never execute the input."""
import ast
import json
import sys


def extract(source):
    try:
        tree = ast.parse(source)
    except (SyntaxError, ValueError, RecursionError):
        return {"status": "invalid-syntax", "facts": [], "limited": False}
    lines = source.splitlines(keepends=True)
    offsets = [0]
    for line in lines:
        offsets.append(offsets[-1] + len(line.encode("utf-16-le")) // 2)
    facts = []
    limited = False
    encoded = source.encode("utf-16-le")

    def position(line, byte_column):
        prefix = lines[line - 1].encode("utf-8")[:byte_column].decode("utf-8")
        return offsets[line - 1] + len(prefix.encode("utf-16-le")) // 2

    def ref(node):
        if node is None or not hasattr(node, "end_lineno"):
            return None
        start = position(node.lineno, node.col_offset)
        end = position(node.end_lineno, node.end_col_offset)
        # Slice original bytes, preserving CRLF and supplementary Unicode.
        quote = encoded[start * 2:end * 2].decode("utf-16-le") if end - start <= 600 else None
        return {"start": start, "end": end, "quote": quote}

    def block(nodes):
        if not nodes:
            return None
        first, last = ref(nodes[0]), ref(nodes[-1])
        start, end = first["start"], last["end"]
        quote = encoded[start * 2:end * 2].decode("utf-16-le") if end - start <= 600 else None
        return {"start": start, "end": end, "quote": quote}

    def add(kind, node, owner, ancestry, **details):
        nonlocal limited
        if len(facts) >= 1200:
            limited = True
            return None
        identity = "s" + str(len(facts))
        facts.append({"id": identity, "kind": kind, "span": ref(node), "owner": owner, "ancestry": ancestry, "details": details})
        return identity

    def visit(node, owner=None, ancestry=None):
        ancestry = ancestry or []
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef, ast.Lambda)):
            body = node.body if isinstance(node.body, list) else [node.body]
            identity = add("function", node, owner, ancestry, name=getattr(node, "name", "(lambda)"), **{
                "async": isinstance(node, ast.AsyncFunctionDef), "body": block(body),
                "returnAnnotation": ref(getattr(node, "returns", None))})
            # Defaults are declaration syntax, not executed here or treated as validation.
            positional = node.args.posonlyargs + node.args.args
            defaults = [None] * (len(positional) - len(node.args.defaults)) + node.args.defaults
            params = list(zip(positional, defaults)) + list(zip(node.args.kwonlyargs, node.args.kw_defaults))
            params += [(p, None) for p in (node.args.vararg, node.args.kwarg) if p]
            for p, default in params:
                add("parameter", p, identity, [], name=p.arg, annotation=ref(p.annotation), default=ref(default))
            if isinstance(node, ast.Lambda):
                add("return", node.body, identity, [], expression=ref(node.body), implicit=True)
            for statement in body:
                visit(statement, identity, [])
            return
        if isinstance(node, (ast.If, ast.IfExp)):
            expression = isinstance(node, ast.IfExp)
            yes, no = ([node.body], [node.orelse]) if expression else (node.body, node.orelse)
            identity = add("branch", node, owner, ancestry, form="conditional-expression" if expression else "if", condition=ref(node.test), **{"then": block(yes), "else": block(no)})
            visit(node.test, owner, ancestry + [{"id": identity, "arm": "condition"}])
            for arm, statements in (("then", yes), ("else", no)):
                for statement in statements:
                    visit(statement, owner, ancestry + [{"id": identity, "arm": arm}])
            return
        if isinstance(node, (ast.For, ast.AsyncFor, ast.While)):
            identity = add("loop", node, owner, ancestry, form="while" if isinstance(node, ast.While) else "async-for" if isinstance(node, ast.AsyncFor) else "for", condition=ref(getattr(node, "test", None)), target=ref(getattr(node, "target", None)), iterable=ref(getattr(node, "iter", None)), body=block(node.body), **{"else": block(node.orelse)})
            header = getattr(node, "test", None) or getattr(node, "iter", None)
            visit(header, owner, ancestry + [{"id": identity, "arm": "header"}])
            for arm, statements in (("body", node.body), ("else", node.orelse)):
                for statement in statements:
                    visit(statement, owner, ancestry + [{"id": identity, "arm": arm}])
            return
        if isinstance(node, (ast.Try, getattr(ast, "TryStar", ast.Try))):
            identity = add("try", node, owner, ancestry, form="except-star" if type(node).__name__ == "TryStar" else "except", body=block(node.body), handlers=[{"type": ref(h.type), "body": block(h.body)} for h in node.handlers], **{"else": block(node.orelse), "finalizer": block(node.finalbody)})
            for arm, statements in [("try", node.body), ("else", node.orelse), ("finally", node.finalbody)] + [("handler", h.body) for h in node.handlers]:
                for statement in statements:
                    visit(statement, owner, ancestry + [{"id": identity, "arm": arm}])
            return
        if isinstance(node, ast.BoolOp):
            add("logic", node, owner, ancestry, operator="and" if isinstance(node.op, ast.And) else "or", operands=[ref(v) for v in node.values])
        if isinstance(node, ast.UnaryOp) and isinstance(node.op, ast.Not):
            add("logic", node, owner, ancestry, operator="not", operand=ref(node.operand))
        if isinstance(node, ast.Compare):
            operators = {ast.Eq: "==", ast.NotEq: "!=", ast.Lt: "<", ast.LtE: "<=", ast.Gt: ">", ast.GtE: ">=", ast.Is: "is", ast.IsNot: "is not", ast.In: "in", ast.NotIn: "not in"}
            add("comparison", node, owner, ancestry, operators=[operators[type(op)] for op in node.ops], operands=[ref(node.left)] + [ref(v) for v in node.comparators])
        if isinstance(node, ast.Return):
            add("return", node, owner, ancestry, expression=ref(node.value), implicit=False)
        if isinstance(node, (ast.Await, ast.Yield, ast.YieldFrom)):
            add("await" if isinstance(node, ast.Await) else "yield", node, owner, ancestry, expression=ref(node.value), delegated=isinstance(node, ast.YieldFrom))
        if isinstance(node, ast.Raise):
            add("throw", node, owner, ancestry, expression=ref(node.exc), cause=ref(node.cause))
        if isinstance(node, (ast.Break, ast.Continue)):
            add("break" if isinstance(node, ast.Break) else "continue", node, owner, ancestry)
        if isinstance(node, ast.Call):
            add("call", node, owner, ancestry, callee=ref(node.func))
        for child in ast.iter_child_nodes(node):
            visit(child, owner, ancestry)

    visit(tree)
    return {"status": "parsed", "facts": facts, "limited": limited}


if __name__ == "__main__":
    try:
        raw = sys.stdin.buffer.read(400001)
        source = raw.decode("utf-8")
        result = extract(source) if len(raw) <= 100000 else {"status": "source-limit", "facts": [], "limited": True}
    except (RecursionError, MemoryError, UnicodeError):
        result = {"status": "parser-limit", "facts": [], "limited": True}
    print(json.dumps(result, ensure_ascii=True))
