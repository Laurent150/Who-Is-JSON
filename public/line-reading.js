(function(root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    else root.WhoLineReading = api;
})(this, function() {
    function units(result) {
        if (result.reading) return result.reading;
        // Existing parser guides remain the source of facts for other languages.
        const output = [];
        function visit(items) {
            for (const n of items || []) {
                const g = n.guide || {};
                output.push({...n, text:g.plain?.purpose || g.purpose || n.detail || n.label,
                    detail:g.plain?.why || g.why || '', basics:g.parts || []});
                for (const key of ['children','otherwise','afterLoop','handlers','afterSuccess','finalizer']) visit(n[key]);
            }
        }
        for (const b of result.blocks || []) {
            visit(b.controlFlow || b.configurationNodes);
        }
        return output;
    }
    function select(result, source, start, end = start) {
        const lines = source.split('\n');
        start = Math.max(1, Math.min(start, lines.length));
        end = Math.max(start, Math.min(end, lines.length));
        const all = units(result);
        const selected = [];
        for (let line = start; line <= end; line++) {
            if (!lines[line-1].trim()) continue;
            const matches = all.filter(n => n.start <= line && n.end >= line);
            const smallest = matches.sort((a,b) => (a.end-a.start)-(b.end-b.start))[0];
            if (smallest && !selected.includes(smallest)) selected.push(smallest);
            // Multiple statements on one physical line are explained separately.
            for (const n of matches.filter(n => n.start === line && n.end === line)) {
                if (!selected.includes(n)) selected.push(n);
            }
        }
        const a = Math.min(start, ...selected.map(n => n.start));
        const z = Math.max(end, ...selected.map(n => n.end));
        return {start:a, end:z, requestedStart:start, requestedEnd:end, units:selected,
            code:lines.slice(a-1,z).join('\n')};
    }
    function basics(selection, result, cards) {
        const found = new Map();
        for (const n of selection.units) for (const p of n.basics || []) {
            const key = p.text + '\0' + p.plain;
            if (!found.has(key)) found.set(key, {title:p.text, text:p.plain});
        }
        for (const b of result.blocks || []) for (const r of b.learning || []) {
            if (r.start < selection.start || r.end > selection.end || r.gap || !cards[r.id]) continue;
            const c = cards[r.id];
            if (!found.has(c.id)) found.set(c.id, {title:c.title, text:c.plain, example:c.example, result:c.result});
        }
        return [...found.values()];
    }
    return {units, select, basics};
});
