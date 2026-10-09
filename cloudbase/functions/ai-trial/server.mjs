import http from 'node:http';
import { Readable } from 'node:stream';
import { createHandler, DIAGNOSTICS_VERSION, BILLING_VERSION, DIRECT_READING_PROFILE } from './handler.mjs';
import { POLICY_VERSION, CODE_REVIEW_PROFILE } from './policy.mjs';
const handle = createHandler({ logger: event => console.warn(JSON.stringify(event)) });
const server = http.createServer(async (req, res) => {
  if (req.url === '/health' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ok:true,policyVersion:POLICY_VERSION,diagnosticsVersion:DIAGNOSTICS_VERSION,billingVersion:BILLING_VERSION,directReadingProfile:DIRECT_READING_PROFILE,codeReviewProfile:process.env.FIMI_CODE_REVIEW_LONG_REQUESTS==='1'?CODE_REVIEW_PROFILE:null})); return;
  }
  if (req.url !== '/trial') { res.writeHead(404); res.end(); return; }
  const length = Number(req.headers['content-length']);
  if (Number.isFinite(length) && length > 120000) { res.writeHead(413); res.end(); return; }
  try {
    const request = new Request('http://gateway/trial', {
      method: req.method, headers: req.headers,
      ...(!['GET','HEAD'].includes(req.method) ? { body: Readable.toWeb(req), duplex: 'half' } : {})
    });
    const result = await handle(request);
    res.writeHead(result.status, Object.fromEntries(result.headers));
    res.end(Buffer.from(await result.arrayBuffer()));
  } catch {
    res.writeHead(503, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: '额度服务暂时不可用。' }));
  }
});
server.requestTimeout = 180000;
server.listen(Number(process.env.PORT || 3000), '0.0.0.0');
