const {test}=require('node:test'),assert=require('node:assert/strict');
const {createTrialOperation,BILLING_VERSION}=require('../trial-operation');
test('explicit pre-dispatch rejections do not imply a reservation or pending refund',async()=>{
 const calls=[];const op=createTrialOperation(async data=>{
  calls.push(data);if(data.action==='quota')return {billingVersion:BILLING_VERSION};
  throw Object.assign(Error('invalid input'),{status:400});
 });
 await assert.rejects(op.call({}));assert.equal(await op.finish(false),null);
 assert.equal(calls.length,2);
});

test('the desktop retrieves a cloud-confirmed whole-operation refund and retries only a lost status acknowledgement',async()=>{
 const calls=[];let refundAttempts=0;
 const op=createTrialOperation(async data=>{
  calls.push(data);
  if(data.action==='quota')return {billingVersion:BILLING_VERSION};
  if(data.action==='complete'){
   assert.equal(data.success,false);
   if(++refundAttempts===1)throw Error('connection lost after refund');
   return {ok:true,state:'refunded'};
  }
  return {choices:[{message:{content:'draft or review'}}]};
 });
 await op.call({messages:[]});await op.call({messages:[]});
 assert.equal(await op.finish(false),'refunded');
 const models=calls.filter(x=>x.billing_operation);
 assert.equal(models.length,2);assert.equal(models[0].billing_operation,models[1].billing_operation);
 assert.deepEqual(calls.filter(x=>x.action==='complete'),Array(2).fill({action:'complete',operationId:models[0].billing_operation,success:false}));
 await assert.rejects(op.call({}),/取消/);
});
test('old gateways are rejected before any paid call and before claiming a refund',async()=>{
 const calls=[];const op=createTrialOperation(async data=>{calls.push(data);return {};});
 await assert.rejects(op.call({}),/尚未启用失败返还/);
 assert.equal(await op.finish(false),null);assert.deepEqual(calls,[{action:'quota'}]);
});
test('lost model response can retrieve a cloud-confirmed refund by operation ID without retrying generation',async()=>{
 const calls=[];const op=createTrialOperation(async data=>{
  calls.push(data);
  if(data.action==='quota')return {billingVersion:BILLING_VERSION};
  if(data.action==='complete')return {ok:true,state:'refunded'};
  throw Error('lost response');
 });
 await assert.rejects(op.call({messages:[]}),/lost response/);
 assert.equal(await op.finish(false),'refunded');
 assert.equal(calls.length,3);assert.equal(calls[1].billing_operation,calls[2].operationId);
});
test('failed completion/status acknowledgements never claim success without a recorded cloud refund',async()=>{
 const calls=[];let broken=true;
 const op=createTrialOperation(async data=>{
  calls.push(data);
  if(data.action==='quota')return {billingVersion:BILLING_VERSION};
  if(data.action==='complete'){
   if(broken)throw Error('ledger unavailable');
   return {ok:true,state:data.success?'succeeded':'refunded'};
  }
  return {};
 });
 await op.call({});await assert.rejects(op.finish(true));await assert.rejects(op.finish(false));
 broken=false;assert.equal(await op.finish(false),'refunded');
 assert.equal(calls.filter(x=>x.billing_operation).length,1);
});

test('a trusted final response closes the operation without a redundant acknowledgement request',async()=>{
 for(const outcome of ['succeeded','refunded']){
  const calls=[];const op=createTrialOperation(async data=>{
   calls.push(data);if(data.action==='quota')return {billingVersion:BILLING_VERSION};
   assert.equal(data.action,undefined);
   if(outcome==='refunded')throw Object.assign(Error('failed'),{diagnostics:{settlement:'refunded'}});
   return {operationState:'succeeded',choices:[{message:{content:'Validated final output'}}]};
  });
  if(outcome==='refunded')await assert.rejects(op.call({}));else await op.call({});
  assert.equal(await op.finish(outcome==='succeeded'),outcome);assert.equal(calls.length,2);
 }
});
