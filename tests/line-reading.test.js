const {test} = require('node:test');
const assert = require('node:assert/strict');
const {analyze} = require('../analyzer');
const reading = require('../public/line-reading');
const cards = require('../public/knowledge').cards;
const python = process.env.CODELINGO_PYTHON || 'python';
const parse = code => analyze(code,'lesson.py',python);

test('line reading separates function headers, loop conditions and updates', () => {
    const code = 'def total(items, factor=0.9):\n    value = 0\n    for item in items:\n        if item > 0:\n            value += item\n    return round(value * factor, 2)';
    const result = parse(code);
    assert.equal(result.status,'ready');
    const header = reading.select(result,code,1);
    assert.equal(header.end,1);
    assert.match(header.units[0].text,/定义.*total.*省略时使用 0.9/);
    assert.ok(reading.basics(header,result,cards).some(x=>x.title==='def'));
    const update = reading.select(result,code,5);
    assert.match(update.units[0].text,/value 原有的值.*加上 item.*保存回 value/);
    assert.equal(update.units[0].context.start,4);
    assert.match(reading.select(result,code,6).units[0].text,/小数点后 2 位/);
    assert.equal(reading.select(result,code,3).end,3);
});

test('multiline calls and Unicode locations preserve the full original statement', () => {
    const code = 'def read():\r\n    文字 = tool(\r\n        "😀",\r\n        count=2,\r\n    )\r\n    return 文字';
    const result = parse(code), chosen = reading.select(result,code,3);
    assert.equal(chosen.start,2); assert.equal(chosen.end,5);
    assert.equal(chosen.code,code.split('\n').slice(1,5).join('\n'));
    assert.ok(chosen.units[0].basics.some(p=>p.text==='=' && p.startColumn===7));
    assert.equal(reading.select(result,code,2,6).end,6);
});

test('shadowed round and unknown tools never acquire standard-library behavior', () => {
    for (const code of ['def f(round, x):\n    return round(x, 2)', 'def f(x):\n    return CustomRound(x, 2)']) {
        const result = parse(code);
        assert.doesNotMatch(reading.select(result,code,2).units[0].text,/小数点后/);
    }
});

test('same-line statements, copied gutters and unsupported source stay honest', () => {
    const code = 'def f():\n    a = 1; b = 2\n    return a + b';
    assert.equal(reading.select(parse(code),code,2).units.length,2);
    const copied = '1 | def f():\n2 |     a = 1\n3 |     return a';
    const result = parse(copied);
    assert.equal(result.reading.find(n=>n.kind==='Assign').startColumn,8);
    const unknown = analyze('void main() {}','main.c',python);
    assert.equal(reading.select(unknown,'void main() {}',1).units.length,0);
    assert.equal(reading.select(parse(code+'\n'),code+'\n',4).units.length,0);
});

test('other language flow guides remain usable in the reading view', () => {
    const code = 'function read(s) {\n  return JSON.parse(s);\n}';
    const result = analyze(code,'read.js',python), selected = reading.select(result,code,2);
    assert.match(selected.units[0].text,/JSON/);
    assert.ok(reading.basics(selected,result,cards).some(x=>/JSON/.test(x.title)));
});
