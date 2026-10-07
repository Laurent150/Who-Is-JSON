// Actual local PostgreSQL/WASM ledger tests; never contacts a cloud service.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const root = path.resolve(__dirname, '..');
const { PGlite } = require(path.join(process.env.FIMI_PGLITE_PATH || path.join(root, '.runtime/sql-acceptance/package'), 'dist/index.cjs'));
(async () => {
  const db = new PGlite();
  const checks = [];
  try {
    await db.exec('CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role; GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;');
    await db.exec(fs.readFileSync(path.join(root, 'cloudbase/migrations/202610020002_ai_trial.sql'), 'utf8'));
    const rpc = async (name, args) => (await db.query(`SELECT public.${name}(${args.map((_,i) => '$'+(i+1)).join(',')}) AS value`, args)).rows[0].value;
    const quota = sub => rpc('fimi_ai_quota', [sub]);
    const reserve = (sub, id, amount) => rpc('fimi_ai_reserve', [sub,id,amount]);
    const settle = (id,cost) => rpc('fimi_ai_settle', [id,cost]);
    const fresh = await quota('reader');
    assert.equal(fresh.grant, 2000000); assert.equal(fresh.enabled, false);
    assert.equal(fresh.remaining, 2000000); assert.equal(fresh.poolRemaining, null); assert.equal(fresh.unlimitedPool, true);
    assert.equal((await reserve('reader',randomUUID(),100)).error, 'disabled');
    await db.exec('UPDATE public.fimi_ai_campaign SET enabled = true');
    const id = randomUUID();
    assert.equal((await reserve('reader',id,1000000)).ok, true);
    assert.equal((await quota('reader')).remaining, 1000000);
    assert.equal((await reserve('reader',id,1000000)).error, 'duplicate');
    assert.equal((await reserve('reader',randomUUID(),100)).error, 'busy');
    await assert.rejects(settle(id,1000001), /Invalid settlement/);
    await settle(id,250000); await settle(id,250000);
    await assert.rejects(settle(id,250001), /different cost/);
    assert.equal((await quota('reader')).remaining, 1750000);
    assert.equal((await quota('reader')).held, 0);
    checks.push('CNY 2 once, reservation, busy/duplicate prevention, settlement/refund of unused hold and idempotency');
    assert.equal((await reserve('reader',randomUUID(),1)).error, 'rate');
    await db.exec("UPDATE public.fimi_ai_wallets SET last_request = now()-interval '1 minute' WHERE subject='reader'");
    assert.equal((await reserve('reader',randomUUID(),1750001)).error,'quota');
    const last = randomUUID(); await reserve('reader',last,1750000); await settle(last,1750000);
    assert.equal((await quota('reader')).remaining,0);
    assert.equal((await quota('other')).remaining,2000000);
    checks.push('rate limit, exact exhaustion, repeated reads do not regrant, separate subjects');
    for(let i=0;i<10;i++){const r=randomUUID();await reserve('pool-'+i,r,2000000);await settle(r,2000000);}
    const total = (await db.query('SELECT spent FROM public.fimi_ai_campaign')).rows[0].spent;
    assert.ok(Number(total)>15000000);
    checks.push('spend beyond old CNY 15 total cap succeeds; only each account is capped');
    for(const role of ['anon','authenticated']) {
      for(const sql of ["SELECT * FROM public.fimi_ai_wallets", "SELECT public.fimi_ai_quota('reader')", `SELECT public.fimi_ai_reserve('reader','${randomUUID()}',1)`, `SELECT public.fimi_ai_settle('${id}',0)`]) {
        await db.exec('BEGIN; SET LOCAL ROLE '+role);
        await assert.rejects(db.exec(sql), /permission denied/);
        await db.exec('ROLLBACK');
      }
    }
    await db.exec('BEGIN; SET LOCAL ROLE service_role');
    assert.equal((await quota('other')).grant,2000000);
    await db.exec('ROLLBACK');
    checks.push('ordinary/anonymous roles cannot read or alter ledger; trusted role can use RPC');
    fs.mkdirSync(path.join(root,'.browser-artifacts/cloudbase-live'),{recursive:true});
    const result={pass:true,realCloud:false,engine:'PGlite',checks};
    fs.writeFileSync(path.join(root,'.browser-artifacts/cloudbase-live/trial-sql.json'),JSON.stringify(result,null,2));
    console.log(JSON.stringify(result,null,2));
  } finally {await db.close();}
})().catch(e=>{console.error(e.message);process.exitCode=1;});
