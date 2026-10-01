// Offline checks only. A successful request is not a semantic quality pass.
const fs = require('node:fs');
const path = require('node:path');
const manifest = require('./live-bilingual-cases.json');
const profile = process.argv[2] || 'zh-stress';
if (!['ui','zh-stress'].includes(profile)) throw Error('Use ui or zh-stress');
const root = path.resolve(__dirname, '../.browser-artifacts', profile === 'ui' ? 'bilingual-live-ui' : 'bilingual-live');
const records = fs.readFileSync(path.join(root, 'results.jsonl'), 'utf8').trim().split('\n').filter(Boolean).map(JSON.parse);
const findingsPath = path.join(root, 'manual-findings.json');
const findings = fs.existsSync(findingsPath) ? JSON.parse(fs.readFileSync(findingsPath, 'utf8')) : [];
const key = x => [x.id, x.locale, x.readingMode].join('/');
const flatten = nodes => (nodes || []).flatMap(n => [n, ...n.branches.flatMap(b => flatten(b.nodes))]);
function prose(record) {
  const r = record.response;
  if (!r) return [];
  if (record.task === 'overview') return [r.summary, ...r.blocks.flatMap(b => [b.purpose, b.example, ...b.terms.flatMap(t => [t.name, t.meaning])])];
  if (record.task === 'flow') return [r.summary, ...flatten(r.nodes).flatMap(n => [n.title, n.explanation, n.example])];
  if (record.task === 'talk') return [r.title, ...r.sections.flatMap(s => [s.title, s.text]), ...r.questions.flatMap(q => [q.question, q.answer])];
  return [r.answer, ...Object.entries(r.knowledge || {}).filter(([k]) => ['title','plain','naming','result','pitfall'].includes(k)).map(([,v]) => v)];
}
const languageFlags = records.filter(r => r.locale === 'en' && prose(r).some(s => /[\u3400-\u9fff]/.test(s || ''))).map(key);
const blankFlowNodes = records.filter(r => r.ok && r.task === 'flow').flatMap(r => flatten(r.response.nodes).filter(n => !n.explanation).map(n => ({record: key(r), node: n.id, start: n.start})));
const incomplete = manifest.cases.flatMap(c => ['zh-CN','en'].flatMap(locale => ['beginner','standard'].map(readingMode => ({id:c.id,locale,readingMode})))).map(key).filter(k => !records.some(r => key(r) === k));
const metrics = {
  profile,
  complete: incomplete.length === 0 && records.length === 160,
  sampleCount: manifest.cases.length, requestCount: records.length,
  responseCount: records.filter(r => r.ok).length, requestFailures: records.filter(r => !r.ok).map(r => ({record:key(r),error:r.error})),
  distinctVariants: new Set(records.map(key)).size, incomplete,
  languageFlags, blankFlowNodes,
  phaseCounts: Object.fromEntries(['development','holdout'].map(p => [p,records.filter(r => r.phase === p).length])),
  languageCounts: Object.fromEntries(['Python','JavaScript','TypeScript','Java'].map(l => [l,manifest.cases.filter(c => c.language === l).length])),
  taskCounts: Object.fromEntries(['overview','flow','selection','token','talk'].map(t => [t,manifest.cases.filter(c => c.task === t).length])),
  findingsCount: findings.length,
  semanticAcceptance: 'not-established; confirmed failures exist',
  reviewScope: 'Source-grounded spot review; not a line-by-line human audit of all 160 outputs. Language flags are mechanical candidates, not a quality score.',
  protocol: manifest.protocol
};
fs.writeFileSync(path.join(root,'metrics.json'), JSON.stringify(metrics,null,2));
console.log(JSON.stringify(metrics,null,2));
