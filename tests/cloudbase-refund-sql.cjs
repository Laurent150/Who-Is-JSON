// Local PostgreSQL/WASM accounting invariants. Never contacts CloudBase.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {randomUUID}=require('node:crypto');
const {PGlite}=require(path.join(process.env.FIMI_PGLITE_PATH,'dist/index.cjs'));
(async()=>{
 const db=new PGlite();const checks=[];
 try{
  await db.exec('CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role; GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;');
  for(const file of ['202610020002_ai_trial.sql','202610090001_trial_failure_refunds.sql'])await db.exec(fs.readFileSync(path.join(__dirname,'../cloudbase/migrations',file),'utf8'));
  await db.exec('UPDATE public.fimi_ai_campaign SET enabled=true');
  const rpc=async(name,args)=>(await db.query(`SELECT public.${name}(${args.map((_,i)=>'$'+(i+1)).join(',')}) AS value`,args)).rows[0].value;
  const quota=s=>rpc('fimi_ai_quota',[s]);
  const reserve=(s,o,r,n=500000)=>rpc('fimi_ai_reserve_operation',[s,o,r,n]);
  const settle=(r,c)=>rpc('fimi_ai_settle',[r,c]);
  const finish=(s,o,ok)=>rpc('fimi_ai_complete',[s,o,ok]);
  const clearRate=()=>db.exec("UPDATE public.fimi_ai_wallets SET last_request=now()-interval '1 minute'");
  const op=randomUUID(),r1=randomUUID(),r2=randomUUID();
  await reserve('reader',op,r1);await settle(r1,1000);await clearRate();await reserve('reader',op,r2);
  assert.equal((await quota('reader')).remaining,1499000);
  assert.equal((await finish('reader',op,false)).state,'refunded');
  await finish('reader',op,false);assert.equal((await quota('reader')).remaining,2000000);assert.equal((await quota('reader')).held,0);
  assert.equal((await settle(r2,3000)).refunded,true);assert.equal((await quota('reader')).remaining,2000000);
  assert.equal((await finish('reader',op,true)).state,'refunded');
  assert.equal((await reserve('reader',op,randomUUID())).error,'closed');
  checks.push('multi-stage refund restores both spent and held credit exactly once; late provider replies and commits cannot charge again');
  const earlier=randomUUID();await finish('reader',earlier,false);
  assert.equal((await reserve('reader',earlier,randomUUID())).error,'closed');
  await assert.rejects(finish('other',op,false),/owner/);
  await assert.rejects(reserve('other',op,randomUUID()),/owner/);
  assert.equal((await quota('other')).remaining,2000000);
  checks.push('refund-before-reservation tombstone and authenticated account ownership');
  await clearRate();const good=randomUUID(),r3=randomUUID();await reserve('reader',good,r3);await settle(r3,2500);
  assert.equal((await finish('reader',good,true)).state,'succeeded');await finish('reader',good,true);
  assert.equal((await quota('reader')).remaining,1997500);
  await db.exec("UPDATE public.fimi_ai_operations SET created_at=now()-interval '3 hours'");
  assert.equal((await quota('reader')).remaining,1997500);
  checks.push('successful operation is charged once and is not expired/refunded on later quota reads');
  await clearRate();const lost=randomUUID();await reserve('reader',lost,randomUUID());
  await db.exec("UPDATE public.fimi_ai_operations SET created_at=now()-interval '3 hours' WHERE state='pending'");
  assert.equal((await quota('reader')).held,500000);
  assert.equal((await rpc('fimi_ai_operation_status',['reader',good])).state,'succeeded');
  await rpc('fimi_ai_mark_failed',['reader',lost]);
  assert.equal((await quota('reader')).remaining,1997500);assert.equal((await quota('reader')).held,0);
  checks.push('recovery refunds only a trusted failure; disappearance or timeout alone cannot obtain free results');
  // Administrator-only compensation, never exposed through a client failure flag.
  await finish('reader',good,false);assert.equal((await quota('reader')).remaining,2000000);
  const ledger=(await db.query('SELECT spent,held FROM public.fimi_ai_campaign')).rows[0];
  assert.equal(Number(ledger.spent),0);assert.equal(Number(ledger.held),0);
  for(const role of ['anon','authenticated'])for(const sql of [
   'SELECT * FROM public.fimi_ai_operations',
   `SELECT public.fimi_ai_complete('reader','${op}',false)`,
   `SELECT public.fimi_ai_refund_request('${r1}')`,
   `SELECT public.fimi_ai_reserve_operation('reader','${op}','${randomUUID()}',1)`,
   `SELECT public.fimi_ai_mark_failed('reader','${op}')`,
   `SELECT public.fimi_ai_operation_status('reader','${op}')`,
   "SELECT public.fimi_ai_recover('reader')"]){
    await db.exec('BEGIN; SET LOCAL ROLE '+role);await assert.rejects(db.exec(sql),/permission denied/);await db.exec('ROLLBACK');
   }
  checks.push('platform ledger remains balanced; ordinary roles cannot read or modify refunds');
  console.log(JSON.stringify({pass:true,realCloud:false,simultaneousConnectionsTested:false,checks},null,2));
 }finally{await db.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
