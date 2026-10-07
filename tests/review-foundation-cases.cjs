// Self-authored static inputs. These strings are never executed or imported.
module.exports=[
 {id:'js-independent',name:'rules.js',source:'function f(a,b){if(a)useA();if(b)useB();return b;}',rule:'LOGIC-01'},
 {id:'py-independent',name:'rules.py',source:'def f(a, b):\n    if a:\n        use_a()\n    if b:\n        use_b()\n    return b\n',rule:'LOGIC-01'},
 {id:'js-return',name:'return.ts',source:'function pass(value: unknown, locked = false) { if (locked) return value; return 0; }',rule:'RETURN-01'},
 {id:'py-return',name:'return.py',source:'def factory(value):\n    async def child():\n        return value\n    return child\n',rule:'RETURN-01'},
 {id:'js-loop',name:'loop.js',source:'async function f(n=2){for(let i=0;i<n;i++){try{return await work();}catch(e){if(i+1===n)throw e;}}return "skipped";}',rule:'LOOP-01'},
 {id:'py-loop',name:'loop.py',source:'def f(n=2):\n    while n > 0:\n        n -= 1\n        if n == 1:\n            break\n    return n\n',rule:'LOOP-01'},
 {id:'js-errors',name:'errors.js',source:'function f(){before();try{inside();}catch(e){handle(e);}finally{finish();}after();}',rule:'ERROR-01'},
 {id:'py-errors',name:'errors.py',source:'def f():\n    before()\n    try:\n        inside()\n    except KeyError:\n        handle()\n    else:\n        success()\n    finally:\n        finish()\n    after()\n',rule:'ERROR-01'},
 {id:'js-values',name:'values.js',source:'function f(x){if(x!==null && x!==undefined)return x;return false;}',rule:'VALUE-01'},
 {id:'py-values',name:'values.py',source:'def f(x):\n    if x is not None:\n        return x\n    return False\n',rule:'VALUE-01'},
 {id:'js-data',name:'data.js',source:'const text="if(a && b) return await f(); try {} catch(e) {}"; // while(true){}',rule:'SOURCE-01'},
 {id:'py-data',name:'data.py',source:'text = "if a and b: return await f()"\n# try: while True\n',rule:'SOURCE-01'}
];
