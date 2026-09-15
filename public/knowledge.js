(function (root, factory) { const api = factory(); if (typeof module === 'object' && module.exports)
    module.exports = api;
else
    root.WhoKnowledge = api; })(this, function () {
    const cards = {};
    function card(id, language, title, plain, naming, example, result, pitfall, check, expected) { cards[id] = { id, language, title, plain, naming, example, result, pitfall, check, expected }; return cards[id]; }
    (typeof require === "function" ? require("./knowledge/javascript") : globalThis.WhoJavascriptCards)(card);
    (typeof require === "function" ? require("./knowledge/python") : globalThis.WhoPythonCards)(card);
    (typeof require === "function" ? require("./knowledge/java") : globalThis.WhoJavaCards)(card);
    (typeof require === "function" ? require("./knowledge/shell") : globalThis.WhoShellCards)(card);
    (typeof require === "function" ? require("./knowledge/json") : globalThis.WhoJsonCards)(card);
    (typeof require === "function" ? require("./knowledge/dockerfile") : globalThis.WhoDockerfileCards)(card);
    (typeof require === "function" ? require("./knowledge/gitignore") : globalThis.WhoGitignoreCards)(card);
    function select(records, start, end) { const seen = new Set(); return (records || []).filter(r => cards[r.id] && r.start >= start && r.end <= end).sort((a, b) => (a.end - a.start) - (b.end - b.start)).filter(r => { if (seen.has(r.id))
        return false; seen.add(r.id); return true; }).map(r => ({ ...r, card: cards[r.id] })); }
    function merge(saved, card, source) { const list = JSON.parse(JSON.stringify(saved)), old = list.find(x => x.id === card.id); if (old) {
        old.card = JSON.parse(JSON.stringify(card));
        if (!old.sources.some(s => s.file === source.file && s.start === source.start && s.end === source.end && s.code === source.code && (s.startColumn ?? null) === (source.startColumn ?? null) && (s.endColumn ?? null) === (source.endColumn ?? null)))
            old.sources.push(source);
        return list;
    } list.unshift({ id: card.id, card, sources: [source], savedAt: new Date().toISOString() }); return list; }
    function markdown(item) { const c = item.card; const fence = s => '`'.repeat(Math.max(3, ...(s.match(/`+/g) || []).map(x => x.length + 1))); const code = s => fence(s) + '\n' + s + '\n' + fence(s); return '# ' + c.title + '\n\n' + c.plain + '\n\n## 名称与写法\n\n' + c.naming + '\n\n## 换个场景试试\n\n' + code(c.example) + '\n\n' + (c.walkthrough || []).map((x,i)=>(i+1)+'. '+x).join('\n') + (c.transfer ? '\n\n'+c.transfer : '') + (c.exercise ? '\n\n少写这一步：'+c.exercise : '') + '\n\n预期：' + c.result + '\n\n注意：' + c.pitfall + '\n\n## 关联源码\n\n' + item.sources.map(s => s.file + ' · 第 ' + s.start + '—' + s.end + ' 行\n\n' + s.context + '\n\n' + code(s.code)).join('\n\n'); }
    function contains(a, b) { return (a.start < b.start || a.start === b.start && (a.startColumn ?? 0) <= (b.startColumn ?? 0)) && (a.end > b.end || a.end === b.end && (a.endColumn ?? Infinity) >= (b.endColumn ?? Infinity)); }
    function overlaps(a, b) { const before = (x, y) => x.end < y.start || x.end === y.start && (x.endColumn ?? Infinity) <= (y.startColumn ?? 0); return !before(a, b) && !before(b, a); }
    function coverage(records, range) {
        const unique = xs => { const seen = new Set(); return xs.filter(x => { const k = x.id + (x.gap ? ':' + x.label : ''); if (seen.has(k))
            return false; seen.add(k); return true; }).map(x => ({ ...x, card: cards[x.id] })); };
        const current = (records || []).filter(x => contains(range, x)), rest = (records || []).filter(x => !contains(range, x) && overlaps({ start: range.start, end: range.end }, x));
        return { current: unique(current.filter(x => cards[x.id] && !x.gap)), context: unique(rest.filter(x => cards[x.id] && !x.gap)), gaps: unique(current.filter(x => x.gap || !cards[x.id])), contextGaps: unique(rest.filter(x => x.gap || !cards[x.id])), precise: Number.isInteger(range.startColumn) };
    }
    return { cards, select, merge, markdown, coverage, contains };
});
