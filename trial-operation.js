const { randomUUID } = require('node:crypto');
const BILLING_VERSION = 'failure-refund-v1';

// One desktop API operation may contain several model calls. The trusted gateway
// refunds it on a verified failure. A desktop error alone cannot authorize money
// movement: finish(false) only retrieves the gateway's recorded outcome.
function createTrialOperation(send) {
  const operationId = randomUUID();
  let capability, recordedState, started = false, finished = false;
  async function prepare() {
    if (!capability) {
      const quota = await send({ action: 'quota' });
      if (quota.billingVersion !== BILLING_VERSION) throw Error('云端尚未启用失败返还额度，请更新试用服务或使用个人 API。');
      capability = quota;
    }
    return capability;
  }
  return {
    prepare,
    async call(data) {
      if (finished) throw Error('AI 请求已取消。');
      await prepare();
      const previouslyStarted = started;
      started = true; // Also covers a lost acknowledgement from the gateway.
      try {
        const result=await send({ ...data, billing_operation: operationId });
        if(result.operationState==='succeeded')recordedState='succeeded';
        return result;
      }
      catch(error){
        if(error.diagnostics?.settlement==='refunded')recordedState='refunded';
        // Explicit gateway validation/auth/quota/rate rejections happen before
        // provider dispatch. An uncertain transport error does not prove this.
        if(!previouslyStarted && [400,401,402,403,429].includes(error.status))started=false;
        throw error;
      }
    },
    async finish(success) {
      if (!started) return null;
      if(recordedState===(success?'succeeded':'refunded')){
        finished=true;
        return recordedState;
      }
      // Only the read-only failure-status check is retried. A potentially billed
      // model request is never replayed, and missing acknowledgements stay unknown.
      const request = { action: 'complete', operationId, success: success === true };
      let last;
      for (let attempt = 0; attempt < (success ? 1 : 2); attempt++) {
        try {
          const result = await send(request);
          if (result.ok !== true || result.state !== (success ? 'succeeded' : 'refunded')) throw Error('额度返还尚未确认，请稍后重新查询额度。');
          finished = true;
          return result.state;
        } catch (error) { last = error; }
      }
      throw last;
    }
  };
}
module.exports = { createTrialOperation, BILLING_VERSION };
