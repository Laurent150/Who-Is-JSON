// Syntax extraction only. Never import, transpile or execute the input.
const ts = require('typescript');
function extract(source, language, filename = '') {
    const kind = /\.tsx$/i.test(filename) ? ts.ScriptKind.TSX : /\.jsx$/i.test(filename) ? ts.ScriptKind.JSX : language === 'TypeScript' ? ts.ScriptKind.TS : ts.ScriptKind.JS;
    const file = ts.createSourceFile(filename || 'source', source, ts.ScriptTarget.Latest, true, kind);
    if (file.parseDiagnostics.length) return {status:'invalid-syntax', facts:[], limited:false};
    const facts = []; let limited = false;
    function ref(node) {
        if (!node) return null;
        const start = node.getStart(file), end = node.getEnd();
        return {start, end, quote:end-start <= 600 ? source.slice(start,end) : null};
    }
    function add(kind, node, owner, ancestry, details = {}) {
        if (facts.length >= 1200) { limited = true; return null; }
        const fact = {id:'s'+facts.length, kind, span:ref(node), owner, ancestry, details};
        facts.push(fact); return fact.id;
    }
    function visit(node, owner = null, ancestry = []) {
        if (ts.isFunctionLike(node) && node.body) {
            const id = add('function', node, owner, ancestry, {name:node.name?.getText(file)||'(anonymous)', async:!!node.modifiers?.some(m=>m.kind===ts.SyntaxKind.AsyncKeyword), generator:!!node.asteriskToken, body:ref(node.body), returnAnnotation:ref(node.type)});
            // A nested function is not executed by entering its lexical parents.
            for (const p of node.parameters) {
                add('parameter',p,id,[],{name:ref(p.name), annotation:ref(p.type), default:ref(p.initializer)});
            }
            if (ts.isArrowFunction(node) && !ts.isBlock(node.body)) add('return',node.body,id,[],{expression:ref(node.body), implicit:true});
            visit(node.body,id,[]); return;
        }
        if (ts.isIfStatement(node) || ts.isConditionalExpression(node)) {
            const ternary=ts.isConditionalExpression(node), condition=ternary?node.condition:node.expression;
            const yes=ternary?node.whenTrue:node.thenStatement, no=ternary?node.whenFalse:node.elseStatement;
            const id=add('branch',node,owner,ancestry,{form:ternary?'conditional-expression':'if', condition:ref(condition), then:ref(yes), else:ref(no)});
            visit(condition,owner,[...ancestry,{id,arm:'condition'}]);
            visit(yes,owner,[...ancestry,{id,arm:'then'}]);
            if(no)visit(no,owner,[...ancestry,{id,arm:'else'}]);
            return;
        }
        if (ts.isForStatement(node)||ts.isForOfStatement(node)||ts.isForInStatement(node)||ts.isWhileStatement(node)||ts.isDoStatement(node)) {
            const form=ts.isForStatement(node)?'for':ts.isForOfStatement(node)?'for-of':ts.isForInStatement(node)?'for-in':ts.isDoStatement(node)?'do-while':'while';
            const id=add('loop',node,owner,ancestry,{form, initializer:ref(node.initializer), condition:ref(node.condition||node.expression), update:ref(node.incrementor), body:ref(node.statement)});
            for(const part of [node.initializer,node.condition||node.expression,node.incrementor])if(part)visit(part,owner,[...ancestry,{id,arm:'header'}]);
            visit(node.statement,owner,[...ancestry,{id,arm:'body'}]); return;
        }
        if(ts.isTryStatement(node)) {
            const id=add('try',node,owner,ancestry,{body:ref(node.tryBlock), handler:ref(node.catchClause), finalizer:ref(node.finallyBlock)});
            visit(node.tryBlock,owner,[...ancestry,{id,arm:'try'}]);
            if(node.catchClause)visit(node.catchClause.block,owner,[...ancestry,{id,arm:'handler'}]);
            if(node.finallyBlock)visit(node.finallyBlock,owner,[...ancestry,{id,arm:'finally'}]);
            return;
        }
        if(ts.isBinaryExpression(node)) {
            const op=node.operatorToken.getText(file);
            if(['&&','||','??'].includes(op))add('logic',node,owner,ancestry,{operator:op,left:ref(node.left),right:ref(node.right)});
            if(['<','<=','>','>=','==','!=','===','!==','in','instanceof'].includes(op))add('comparison',node,owner,ancestry,{operator:op,left:ref(node.left),right:ref(node.right)});
        }
        if(ts.isPrefixUnaryExpression(node)&&node.operator===ts.SyntaxKind.ExclamationToken)add('logic',node,owner,ancestry,{operator:'!',operand:ref(node.operand)});
        if(ts.isReturnStatement(node))add('return',node,owner,ancestry,{expression:ref(node.expression),implicit:false});
        if(ts.isAwaitExpression(node))add('await',node,owner,ancestry,{expression:ref(node.expression)});
        if(ts.isYieldExpression(node))add('yield',node,owner,ancestry,{expression:ref(node.expression),delegated:!!node.asteriskToken});
        if(ts.isThrowStatement(node))add('throw',node,owner,ancestry,{expression:ref(node.expression)});
        if(ts.isBreakStatement(node)||ts.isContinueStatement(node))add(ts.isBreakStatement(node)?'break':'continue',node,owner,ancestry,{label:ref(node.label)});
        if(ts.isCallExpression(node)||ts.isNewExpression(node))add('call',node,owner,ancestry,{callee:ref(node.expression)});
        ts.forEachChild(node,child=>visit(child,owner,ancestry));
    }
    visit(file);
    return {status:'parsed',facts,limited};
}
module.exports={extract};
