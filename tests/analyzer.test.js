const {test}=require('node:test');const assert=require('node:assert/strict');const {analyze,detect,heuristic}=require('../analyzer');
test('language detection prioritizes file extension',()=>{assert.equal(detect('const x=1','x.py'),'Python');assert.equal(detect('function f(){}'),'JavaScript');});
test('pasted JavaScript classes ignore language keywords in comments and strings',()=>{
 const code='import { createHash } from "node:crypto";\n// package IDs; private int value; interface Example\nexport class Progress {\n  accept(event) { return event; }\n}\nconst flag="--package-import-method=copy";\nfunction report() { return flag; }';
 for(const name of ['', 'clipboard.txt']){
  const r=analyze(code,name);assert.equal(r.language,'JavaScript');assert.equal(r.status,'ready');
  assert.ok(r.blocks.some(b=>b.title==='accept'));assert.ok(r.blocks.some(b=>b.title==='report'));
 }
 assert.equal(detect('export class Box { value() { return 1; } }'),'JavaScript');
 assert.equal(detect('import { value } from "./values.js";'),'JavaScript');
 assert.equal(detect('const packageName="x"; class Box {}'),'JavaScript');
});
test('real Java and TypeScript syntax still wins over words in literal text',()=>{
 assert.equal(detect('// const value = 1;\npackage demo;\npublic class Demo { private int count; }'),'Java');
 assert.equal(detect('public class Demo { public static void main(String[] args) { String text="function let"; } }'),'Java');
 assert.equal(detect('export interface Person { name: string }'),'TypeScript');
 assert.equal(detect('const count: number = 2;'),'TypeScript');
 assert.equal(detect('export class Box {}','Box.java'),'Java');
});
test('ignores fake functions and loops inside JS strings/comments',()=>{const code='// function pretend() {\nconst s="for(x) {";\nfunction actual(a) {\n if (a) { return a; }\n}\n';const b=heuristic(code);assert.deepEqual(b.map(x=>x.kind),['function','condition']);assert.equal(b[0].end,5);});
test('reports uncertainty for unsupported structure instead of inventing business purpose',()=>{const r=analyze('fn main() {}','x.rs');assert.equal(r.language,'Rust');assert.equal(r.mode,'local');assert.equal(r.status,'unsupported');assert.ok(r.warnings.length);assert.deepEqual(r.blocks,[]);});
test('Python handles nested functions and rejects broken syntax without executing',()=>{const p=process.env.CODELINGO_PYTHON||'python';const r=analyze('def outer(x):\n    def inner(y):\n        return y+1\n    for n in x:\n        if n:\n            print(inner(n))\n','a.py',p);assert.equal(r.parser,'Python AST');assert.equal(r.blocks.length,4);assert.equal(r.blocks.find(x=>x.title==='inner').start,2);assert.equal(r.blocks[0].end,6);const broken=analyze('def broken(:\n','a.py',p);assert.ok(broken.warnings[0].includes('无法解析'));});
