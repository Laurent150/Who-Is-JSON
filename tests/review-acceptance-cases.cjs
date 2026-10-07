// New, self-authored acceptance sources; never execute these strings. Expected
// observations are evaluator-only and MUST NOT enter any model request.
const cases=[
 {id:'inventory-window',name:'inventory.py',source:`def reserve(stock, requests, limit=3):
    accepted = []
    for sku, quantity in requests:
        if quantity <= 0 or sku not in stock:
            continue
        if len(accepted) >= limit:
            break
        if stock[sku] >= quantity:
            stock[sku] -= quantity
            accepted.append((sku, quantity))
    else:
        return accepted, "scanned"
    return accepted, "limited"
`,selection:{start:4,end:5},word:'or',wordLine:4,oracle:[
  'Nonpositive quantities OR absent stock keys are skipped. A request is accepted only when the available stock is sufficient; stock is mutated immediately.',
  'The limit counts accepted requests, not units or all requests. The limit is checked only after the skip guard, and before the stock comparison.',
  'The loop else runs on exhaustion, including empty requests, but not on break. Reaching the accepted count at the very end does not itself make the status limited.',
  'Earlier stock deductions are not rolled back if a later operation raises. No comprehensive type validation or concurrency protection is supplied.'
 ]},
 {id:'cached-label',name:'labels.js',source:`export function labelFor(cache, key, fallback = "untitled") {
  if (Object.hasOwn(cache, key)) {
    return cache[key] ?? fallback;
  }
  const label = String(key).trim() || fallback;
  cache[key] = label;
  return label;
}
`,selection:{start:2,end:4},word:'??',wordLine:3,oracle:[
  'An own cached property is reused. Only null or undefined uses fallback on that branch; 0, false and the empty string are preserved.',
  'For a missing own property, String(key).trim() is used unless the result is falsy; the produced label is stored before returning.',
  'A cached nullish value is not overwritten by fallback. The cached branch does not trim strings or guarantee a string result.',
  'The code does not validate cache/key types or guarantee that coercion, getters or writes cannot fail.'
 ]},
 {id:'sequential-batch',name:'batch.ts',source:`export function makeBatch(load: (id: string) => Promise<string>) {
  return async function collect(ids: string[], stopOnEmpty = false) {
    const values: string[] = [];
    for (const id of ids) {
      const value = await load(id);
      if (stopOnEmpty && value === "") break;
      values.push(value);
    }
    return values;
  };
}
`,selection:{start:5,end:7},word:'await',wordLine:5,oracle:[
  'makeBatch returns a function without invoking load. Calling collect returns a Promise; async is on the returned function.',
  'Each load is awaited before moving to the next id. The loop does not start all loads in parallel.',
  'stopOnEmpty AND an empty string breaks before pushing that value. If stopOnEmpty is false, the empty string is included.',
  'An unhandled load throw/rejection rejects collect; no partial array is returned on failure. Type annotations alone do not validate runtime input.'
 ]},
 {id:'record-parser',name:'records.py',source:`def read_count(record, fallback=0):
    text = record["count"]
    try:
        value = int(text)
    except ValueError:
        return fallback
    else:
        return max(value, 0)
    finally:
        record["checked"] = True
`,selection:{start:4,end:6},word:'ValueError',wordLine:5,oracle:[
  'The count lookup happens before try, so a missing key is not handled and does not run this finally.',
  'Only ValueError from the protected conversion takes the fallback path; int(None) raises TypeError and is not caught.',
  'Successful conversion returns max(value, 0). The fallback is returned unchanged, so it need not be nonnegative.',
  'Finally attempts to set checked on every exit from the try construct; failure of that assignment can replace a pending return or exception. It is not a guarantee that the record is always marked.'
 ]},
 {id:'queue-budget',name:'queue.js',source:`export function takeWithin(tasks, budget) {
  const selected = [];
  let remaining = budget;
  for (const task of tasks) {
    if (task.disabled) continue;
    if (task.cost > remaining) break;
    remaining -= task.cost;
    selected.push(task.id);
  }
  return { selected, remaining };
}
`,selection:{start:5,end:8},word:'break',wordLine:6,oracle:[
  'Disabled tasks are skipped. The first enabled task whose cost exceeds remaining stops the entire scan, so later cheaper tasks are not considered.',
  'An exact cost match fits. The cost is deducted before the id is appended. The original task records are not explicitly modified.',
  'No positivity or numeric type validation is implemented. Negative costs can increase remaining; claims that remaining necessarily decreases need appropriate scope.',
  'The result is an object containing the selected ids and final remaining value, not a count or a mutated tasks array.'
 ]},
 {id:'limited-mapper',name:'mapper.ts',source:`export function mapUntil<T>(items: T[], transform: (item: T) => string | null) {
  const output: string[] = [];
  for (const item of items) {
    const mapped = transform(item);
    if (mapped === null) return output;
    if (mapped !== "") output.push(mapped);
  }
  return output;
}
`,selection:{start:4,end:6},word:'null',wordLine:5,oracle:[
  'transform is called once per visited item; null stops immediately and returns accumulated output.',
  'An empty string is omitted but scanning continues. null and the empty string have different control-flow effects.',
  'An exception from transform propagates; accumulated output is not returned on that path.',
  'The callback implementation is absent; do not promise it is pure, or that TypeScript annotations validate runtime values.'
 ]}
];
for(const item of cases){
 const line=item.source.split('\n')[item.wordLine-1],column=line.indexOf(item.word);
 if(column<0)throw Error('Invalid acceptance token');
 item.token={line:item.wordLine,startColumn:column,endColumn:column+item.word.length};
}
function plan(){
 const candidates=[];let n=0;
 for(const locale of ['en','zh-CN'])for(const readingMode of ['beginner','standard'])for(const audience of ['beginner','peer','review']){
  const i=n++%6;candidates.push({id:cases[i].id,task:'talk',locale,readingMode,audience,detail:['standard','brief','detailed'][i%3],coverage:i%3===1?'highlights':'full'});
 }
 n=0;
 for(const task of ['token','line'])for(const locale of ['en','zh-CN'])for(const readingMode of ['beginner','standard'])candidates.push({id:cases[n++%6].id,task,locale,readingMode,audience:'beginner',detail:'standard',coverage:'full'});
 // Four paired walkthroughs and four paired point-readings. Alternate order to
 // avoid always warming the provider cache for the candidate.
 const paired=new Set([0,4,6,10,12,15,16,19]);let pair=0;
 return candidates.flatMap((job,i)=>{
  const fresh={...job,variant:'candidate',jobId:'j'+i+'-candidate'};
  if(!paired.has(i))return [fresh];
  const old={...job,variant:'baseline',jobId:'j'+i+'-baseline'};
  return pair++%2?[fresh,old]:[old,fresh];
 });
}
module.exports={cases,plan};
