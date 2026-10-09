// Operational metadata only: never copy provider text, prompts, keys or headers.
const codes = new Set([
  'trial_quota_failed', 'trial_followup_scope',
  'trial_gateway_timeout', 'trial_gateway_connection', 'trial_gateway_response',
  'trial_provider_timeout', 'trial_provider_connection', 'trial_provider_http',
  'trial_provider_response', 'trial_usage_invalid', 'trial_settlement_failed',
  'trial_invalid_content'
]);
const stages = new Set(['quota-ledger', 'gateway-request', 'gateway-response', 'provider-request',
  'provider-response', 'usage-validation', 'settlement', 'content-validation']);
const phases = new Set(['single', 'followup', 'draft', 'contracts', 'contract-repair',
  'composition', 'composition-format-repair', 'review', 'repair', 'final-audit',
  'final-audit-repair', 'final-audit-recheck']);
const transportCodes = new Set(['UND_ERR_SOCKET','UND_ERR_CONNECT_TIMEOUT','UND_ERR_HEADERS_TIMEOUT',
  'UND_ERR_BODY_TIMEOUT','ECONNRESET','ECONNREFUSED','ETIMEDOUT','ENOTFOUND','EAI_AGAIN','EACCES','EPERM']);
function safe(value) {
  const result = {};
  if (!value || typeof value !== 'object') return result;
  if (codes.has(value.code)) result.code = value.code;
  if (transportCodes.has(value.transportCode)) result.transportCode = value.transportCode;
  if (stages.has(value.stage)) result.stage = value.stage;
  if (phases.has(value.aiPhase)) result.aiPhase = value.aiPhase;
  if (typeof value.requestId === 'string' && /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(value.requestId)) result.requestId = value.requestId;
  if (Number.isInteger(value.providerStatus) && value.providerStatus >= 100 && value.providerStatus <= 599) result.providerStatus = value.providerStatus;
  if (Number.isInteger(value.gatewayStatus) && value.gatewayStatus >= 100 && value.gatewayStatus <= 599) result.gatewayStatus = value.gatewayStatus;
  if (['json','html','other'].includes(value.responseType)) result.responseType = value.responseType;
  if (Number.isSafeInteger(value.elapsedMs) && value.elapsedMs >= 0 && value.elapsedMs <= 86400000) result.elapsedMs = value.elapsedMs;
  if (['pending', 'unknown', 'confirmed', 'refunded', 'refund_pending'].includes(value.settlement)) result.settlement = value.settlement;
  return result;
}
function attach(error, value) {
  const diagnostics = safe(value);
  if (Object.keys(diagnostics).length) error.diagnostics = diagnostics;
  return error;
}
function report(error, logger = console.warn) {
  const diagnostics = safe(error?.diagnostics);
  if (!Object.keys(diagnostics).length) return {};
  // Logging failures must never change the request outcome or trigger a retry.
  try { logger(JSON.stringify({ event: 'fimi_ai_failure', ...diagnostics })); } catch {}
  return { diagnostics };
}
module.exports = { safe, attach, report };
