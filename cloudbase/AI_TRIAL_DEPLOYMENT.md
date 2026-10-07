# CloudBase AI trial deployment

## Code-review output budget candidate — 2026-10-07

The `code-review-64k-v1` profile raises the **code-review audience only** to
65,536 total output tokens per request, including reasoning. Other audiences
keep their existing limits. This is a safety ceiling, not a requested manuscript
length or proof that all legitimate inputs fit. Model, reasoning effort, prompts,
bounded repair counts and settlement rates are unchanged. Reservations cover
the larger worst-case output; actual verified usage is settled by the existing
ledger. A larger reservation may require more available trial credit.

Deploy the updated `functions/ai-trial/` files. Before enabling
`FIMI_CODE_REVIEW_LONG_REQUESTS=1`, verify the **actual HTTP ingress route** can
carry a response for at least 400 seconds. The provider deadline for this
profile is 360 seconds, the desktop gateway deadline 400 seconds, and the local
model-call deadline 420 seconds. The Node server's `requestTimeout` governs
receiving the inbound request body; changing it does not lengthen an upstream
gateway's response timeout. Do not assume updating JavaScript config changes
the managed ingress limit. CloudBase documents a 60-second timeout for some
CloudRun access paths: https://docs.cloudbase.net/run/limitation . Inspect the
deployed route and verify it; this document does not claim the current endpoint
supports long responses. If that route cannot accommodate the request, use a
durable asynchronous job/result-retrieval design before enabling this profile.

The flag is off by default. `/health` and authenticated quota responses expose
`codeReviewProfile: "code-review-64k-v1"` only when it is on. The new desktop
checks the quota capability before its first larger request, without reserving
credits or calling the model. Old or not-enabled gateways produce a specific
upgrade/use-personal-API message, not a truncated fallback. Capability checks
do not prove ingress reliability: the operator must complete the route check.
The profile marker is stripped before sending to DeepSeek; arbitrary client
token limits, model changes or URLs remain disallowed. No SQL change is needed.

Local source and mock tests are not a deployment record. This update has not
been deployed by the code change. Existing 150-second deployment advice below
describes ordinary requests and is insufficient for this new profile.

## Failure diagnostics candidate — 2026-10-04

The diagnostic update preserves `review-thinking-v1`, model/prompt settings,
all timeouts, reservation/settlement rules and retry bounds. It adds the health
field `diagnosticsVersion: "trial-failure-v1"`. Upload the prepared five-file
diagnostic ZIP to the same Run service, keep its environment variables and
route, and switch traffic only after the new version is ready. No SQL migration
or wallet adjustment is required. This section describes a prepared update,
not evidence that it has been deployed.

After a reserved call fails, the cloud log records `fimi_trial_failure` with
the request UUID, failing stage, elapsed milliseconds, provider HTTP status
when known, and settlement state. `computedCost` is included only after usage
has passed the existing validation; it is a computed micro-CNY charge, not
proof that the ledger accepted it. Settlement transport/acknowledgement errors
are `unknown`, not automatically unpaid. Provider timeout/connection/HTTP/JSON,
invalid usage, settlement and post-settlement content failures are distinct.
No source, prompts, model text/reasoning, account identity or keys are logged.

The updated desktop adapter retains this allowlisted metadata and the AI
phase in API error responses and `fimi_ai_failure` logs. Its user-facing errors
are translated into the selected Chinese/English UI language. Old gateways
remain compatible: a valid request UUID is retained, but a missing reason is
not guessed. Only a new diagnostic deployment and observed incident can show
the actual cause; this cannot reconstruct an earlier unlogged failure.

Do not retry a potentially billed call automatically or clear holds without
provider/ledger evidence. The reported 140-second walkthrough failure remains
unresolved: whole-workflow elapsed time alone does not identify which request
or stage failed. A current balance display alone is not a settlement audit.

## Current policy

- Each CloudBase email account (JWT `sub`) gets CNY 2 once, including existing
  test accounts when they first use the new ledger. Signing out, reinstalling,
  changing interface language or querying the balance does not replenish it.
- There is **no platform-wide spending cap**, as requested. A manual pause
  switch remains for maintenance; it is not a monetary limit.
- No Supabase users, balances or provider keys are copied. Separate email
  accounts have separate grants; this is per account, not proof of one person.
- Credits are non-withdrawable trial credit, denominated in millionths of CNY.
  Fixed Flash peak-equivalent rates: input miss CNY 2 / million tokens, cache
  hit CNY 0.04 / million, output CNY 8 / million. The provider may charge less
  off-peak; this credit ledger is not a copy of its billing statement.
  Pricing checked 2026-10-02 at https://api-docs.deepseek.com/zh-cn/quick_start/pricing/.
- Text-only, pinned `deepseek-flash`, bounded input/output. The service does
  not accept a client-selected model, upstream URL, tools, account ID or cost.
  Existing prompts and source text are not rewritten by this migration.
- The `review-thinking-v1` candidate accepts bounded `thinking: enabled`
  requests with `reasoning_effort: low/high`. Unsupported effort is reduced to
  low, never promoted to max. Ordinary drafting requests remain non-thinking.
  This must be deployed before the new desktop trial adapter can use thinking.

## Deploy in order

1. In the checked CloudBase environment, execute the entire
   `migrations/202610020002_ai_trial.sql` once as administrator. This requires
   `service_role` and creates only new `fimi_ai_*` tables/functions. It grants
   no ledger access to `anon` or `authenticated`. The campaign starts disabled.
2. Deploy `functions/ai-trial/` as a separate CloudBase Run Node.js 22+ service
   (or build its Dockerfile). Start `node server.mjs`, port `3000` (or `PORT`).
   Allow at least 150 seconds for HTTP requests. `/health` returns availability
   of the process only; it does not validate secrets, the ledger or paid calls.
3. Configure these secrets **only in the cloud service environment**:

   | Variable | Value |
   | --- | --- |
   | `CLOUDBASE_ENV_ID` | Your checked CloudBase environment ID |
   | `CLOUDBASE_SERVICE_ROLE_KEY` | CloudBase service_role API Key for that environment |
   | `DEEPSEEK_API_KEY` | The publisher's funded DeepSeek API key |

   Do not enter either key in the desktop app, source files, chat or a release
   archive. The user's personally entered desktop model key is not reused.
   Use HTTPS for the `/trial` endpoint. The service itself validates each user
   bearer token with `/auth/v1/user/me` and requires a valid text subject and
   email from that successful, trusted response. This environment omits the
   legacy `email_verified`, `status` and `providers` fields; an administrator
   query also confirmed NULL verification/status for the tested email account.
   Missing/null fields are unspecified, not proof of verified email. Eligibility
   is an authenticated CloudBase account with an email, not independent proof
   of mailbox verification. Explicit `email_verified: false`, non-active status,
   and malformed non-null values are rejected. Client identity fields are ignored.
   Preserve the Authorization header when configuring its HTTP route.
   Official reference: https://docs.cloudbase.net/authentication-v2/auth/auth-pg
4. Give the desktop test process only the public endpoint and flags:

   ```text
   WHO_ACCOUNT_PROVIDER=cloudbase
   WHO_CLOUDBASE_ENV_ID=<your environment>
   WHO_CLOUDBASE_TRIAL_URL=https://<your deployed service>/trial
   WHO_CLOUDBASE_TRIAL_ENABLED=1
   ```

   The release default is not switched automatically. A process restart requires
   signing in again. Before activation, a real authenticated quota request must
   return `grant:2000000`, `enabled:false`, `unlimitedPool:true` and `poolRemaining:null`.
5. Once the route and secrets are validated, activate with the administrator:

   ```sql
   UPDATE public.fimi_ai_campaign SET enabled = true WHERE id = true;
   ```

   Then test one small paid request and confirm the balance decreased, pending
   holds cleared, and another account's balance stayed unchanged. Repeated
   quota queries must not regrant money. Disable with `enabled = false` if needed.

## Accounting and failure handling

Reserve a conservative maximum before calling DeepSeek. Settle from validated
provider usage; unused reservation is released. Retries of the same settlement
are idempotent, while a changed settlement cost is rejected. One pending request
per account and a five-second start interval protect multi-stage requests.
All operations lock in the same order, campaign then wallet/request.

An ambiguous timeout, provider failure, malformed usage or uncertain settlement
does not auto-refund or automatically retry a potentially billed request. The
hold remains for reconciliation, and further calls on that account are blocked.
An administrator must check the provider record, then call `fimi_ai_settle` with
the confirmed cost (zero only when non-billing is confirmed). Never simply clear
wallet totals or delete request rows: that can grant duplicate credit or break
the audit trail. Turning the campaign off prevents new reservations but still
allows in-flight requests to settle. Old public installers cannot change balances.

## Updating the thinking/review candidate

Upload `fimi-ai-trial-review-thinking-v1.zip` to the existing `fimi-ai-trial`
Run service as a new version. Its five files are at archive root: Dockerfile,
package.json, server.mjs, handler.mjs and policy.mjs. Keep the existing cloud
secrets, route, port and environment. No SQL migration, grant replenishment or
account change is needed. Publish and switch traffic to this version.

`GET /health` must now return `policyVersion: "review-thinking-v1"`. An
authenticated generation response also reports its accepted `thinking` and
`reasoningEffort`. Health alone does not prove a paid request succeeds or that
content is accurate. After switching, verify a small paid request, actual usage
settlement and a cleared pending hold. The app also needs updated local modules
loaded; restarting its backend ends the in-memory account session.

Content acceptance compares final claims against source across both languages
and reading modes, walkthrough audiences/details and token/line selections.
The local personal-API evaluator simulates gateway parameters and explicitly
labels that simulation; it is not evidence of the deployed service's behavior.

## Evidence and remaining work

Local actual SQL-engine tests: `node tests/cloudbase-trial-sql.cjs` (optional
PGlite tooling, not a product dependency). HTTP service tests mock CloudBase and
DeepSeek; they do not spend funds or prove a deployment works. See VALIDATION.md
for actual test outcomes. A prepared ZIP or a local pass is not live activation.

On 2026-10-04, the owner updated the existing service. Its health response and
real model responses reported `review-thinking-v1`; low/high thinking settings
and reasoning-token usage were observed. Two walkthrough chains and a targeted
final audit used the new service. Credit deductions matched recorded usage and
reservations returned to zero. One chain initially failed local audit protocol
validation and was recovered by exact-response replay after a scoped parser
fix; deployment verification must not be confused with universal content
accuracy. No SQL migration was rerun for this service update.
