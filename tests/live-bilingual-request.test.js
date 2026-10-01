const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const {buildRequest,questions} = require('./live-bilingual-request.cjs');
const corpus = require('./live-bilingual-cases.json');

test('live evaluation sends the exact localized questions used by the interface', () => {
  const ctx = vm.createContext({});
  vm.runInContext(fs.readFileSync(require.resolve('../public/locale-en'),'utf8'),ctx);
  for (const question of Object.values(questions)) assert.equal(ctx.WhoEnglish[question['zh-CN']], question.en);
  for (const c of corpus.cases) for (const mode of ['beginner','standard']) {
    const req = buildRequest(c,'source unchanged',{},'en',mode);
    assert.equal(req.payload.code,'source unchanged');
    assert.equal(req.payload.locale,'en');
    if (req.route === 'ask') {
      assert.doesNotMatch(req.payload.question,/[\u3400-\u9fff]/);
      assert.equal(req.payload.selection,c.selection);
      assert.equal(buildRequest(c,'',{},'en',mode,'zh-stress').payload.question,questions[c.task === 'token'?'token':mode]['zh-CN']);
    }
  }
});

test('corpus is pinned, balanced and has explicit parser positions for point requests', () => {
  assert.equal(corpus.cases.length,40);
  assert.equal(new Set(corpus.cases.map(c => c.id)).size,40);
  for (const lang of ['Python','JavaScript','TypeScript','Java']) assert.equal(corpus.cases.filter(c => c.language === lang).length,10);
  for (const task of ['overview','flow','talk','selection','token']) assert.equal(corpus.cases.filter(c => c.task === task).length,8);
  assert.equal(corpus.cases.filter(c => c.phase === 'holdout').length,10);
  for (const c of corpus.cases) {
    assert.match(c.commit,/^[a-f0-9]{40}$/); assert.match(c.sha256,/^[a-f0-9]{64}$/);
    assert.ok(c.expectations.length >= 5);
    assert.ok(!c.local.includes('..') && !c.local.includes(':'));
    if (c.task === 'flow') assert.ok(Number.isInteger(c.start) && c.start > 0);
    if (['selection','token'].includes(c.task)) assert.ok(c.selection.start > 0 && c.selection.end >= c.selection.start && c.selection.end <= c.lines);
    if (c.task === 'token') assert.equal(c.token.endColumn-c.token.startColumn,c.token.text.length);
  }
});
