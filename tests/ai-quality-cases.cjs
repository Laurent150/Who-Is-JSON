// Self-authored, static sources. Never execute or import these strings.
module.exports=[{
 id:'independent-rebate',name:'rebate.py',
 source:'def rebate(amount, member, voucher):\n    discount = amount * 0.1 if member else 0\n    if voucher and amount >= 100:\n        discount += 5\n    return min(discount, amount)\n',
 selection:{start:3,end:4},token:{line:3,startColumn:15,endColumn:18},
 oracle:['Membership and the voucher are independent; the voucher needs BOTH voucher truthiness and amount >= 100.','For amount 100, nonmember + voucher gets 5; member + voucher gets 15; member without voucher gets 10.','The return caps the combined discount at amount. No input validation or rounding is supplied.']
},{
 id:'bounded-counter',name:'counter.js',
 source:'export function update(current, incoming, locked) {\n  let result = current;\n  if (incoming !== null && incoming !== undefined) {\n    result = incoming;\n  }\n  if (locked) {\n    return current;\n  }\n  return Math.max(0, Math.min(10, result));\n}\n',
 selection:{start:3,end:5},token:{line:3,startColumn:24,endColumn:26},
 oracle:['0, false and empty string are not null/undefined and therefore replace the previous value before later processing.','locked returns the ORIGINAL current without clamping; it does not return incoming.','When not locked, Math.min then Math.max clamp/coerce the selected value; unsupported values are not rejected by explicit validation.']
},{
 id:'async-retry-boundary',name:'loader.ts',
 source:'export function makeLoader(fetchValue: () => Promise<string>) {\n  return async function load(attempts = 2) {\n    for (let i = 0; i < attempts; i++) {\n      try {\n        return await fetchValue();\n      } catch (error) {\n        if (i + 1 === attempts) throw error;\n      }\n    }\n    return "skipped";\n  };\n}\n',
 selection:{start:5,end:5},token:{line:5,startColumn:15,endColumn:20},
 oracle:['makeLoader returns a FUNCTION; the returned async load function returns a Promise.','Default attempts 2 is at most 2 total calls, not 2 additional retries. Success returns early; the final caught error is rethrown.','Zero attempts skips fetchValue and fulfills with skipped. The implementation does not validate attempts; do not extend the integer final-rethrow guarantee to arbitrary fractions.','The supplied callback implementation is unknown; no network, cancellation or parallelism guarantee.']
}];
