// Stage-specific tests use a deterministic audit result, not a semantic oracle.
// Callers intentionally count only their existing stages. ai-final-audit.test.js
// independently tests the COMPLETE chain, rejection, usage and call bounds.
function mockFinalAudit(body,usage){
    if(!body.messages?.[0]?.content?.startsWith('FIMI_FINAL_AUDIT_V1'))return null;
    const input=JSON.parse(body.messages[1].content);
    return {usage,choices:[{finish_reason:'stop',message:{content:JSON.stringify({
        candidateHash:input.candidateHash,verdict:'pass',findings:[],
        checks:input.requiredChecks.map(id=>({id,status:'pass',reason:'Deterministic protocol fixture; not a semantic assessment.'}))
    })}}]};
}
module.exports={mockFinalAudit};
