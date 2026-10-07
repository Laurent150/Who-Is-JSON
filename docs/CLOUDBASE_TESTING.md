# CloudBase email sign-in: staged integration

This is a new account system. Existing Supabase users, balances and cloud data
are not imported, linked or deleted. Local guest favorites remain unchanged.
The published installer has not been replaced by this development test.

## Start an isolated local test

Set these environment variables before running `node server.js`:

```powershell
$env:WHO_ACCOUNT_PROVIDER = 'cloudbase'
$env:WHO_CLOUDBASE_ENV_ID = 'YOUR_ENVIRONMENT_ID'
$env:WHO_CLOUDBASE_LIBRARY_ENABLED = '0'
$env:CODELINGO_PORT = '43170'
node server.js
```

The application does not load `.env` automatically. Configure Python as described
in CONTRIBUTING.md if testing local parsing. Do not pass a CloudBase administrator
API key, a SMTP password, or a model key to the account adapter. This integration
uses public authentication endpoints and the resulting user's access token.
`WHO_CLOUD_DISABLED=1` disables this provider as well. The existing release
configuration remains available until CloudBase is accepted for release.

In CloudBase, enable Identity Authentication / Login Methods / Email Verification
Code and configure CloudBase's delegated mail service. No custom SMTP is required
for this test. The user enters their own address and code in the local application,
never in chat. Requests may send an email and create an ordinary application user.

## What is implemented

- Send verification, verify the code, then sign up or sign in based on CloudBase's
  `is_user` response. Get `/auth/v1/user/me` with the issued token and verify the
  identity before creating a local session.
- Opaque local session; provider access tokens remain only in server memory.
  Refresh tokens are not retained. Restart or expiry requires signing in again.
- One send per address per minute and eight sends per minute per local server.
  These are local safeguards, not global anti-abuse controls or quota enforcement.
- Wrong code retries are bounded; uncertain requests are never silently retried.
  Cancellation blocks further stages and prevents creating a local session.
- Selected language is passed as `Accept-Language: en-US` or `zh-CN`, consistent
  with the official JS SDK 3.10.1. Actual email language and delivery need live checks.
- If CAPTCHA is requested, show a localized limitation and stop; no bypass.
- Auth-only mode calls `me` after login, retains local favorites and hides sync
  actions. It never returns a fake successful cloud save or awards trial credit.

## Enable favorites only after database verification

The reviewed setup candidate is
`cloudbase/migrations/202610020001_library.sql`. It creates new FIMI tables and a
compare-and-swap save function in CloudBase PostgreSQL, using `auth.uid()` and RLS.
It is not a Supabase migration. The user has now supplied a console screenshot
reporting successful execution (0 affected rows); ordinary-user access still
requires live verification.

The user's 2026-10-02 catalog results confirmed that both roles exist and
`auth.uid()` returns text from JWT `sub` (with the JSON claims fallback).
`auth.users.id` is bigint, while `auth.users.sub` is varchar(255). The library
table was absent. These results resolve the console's misleading warning about
missing functions and roles, but exposed an incompatible foreign key in the
original candidate. The revised migration stores the opaque subject as text
(1–255 characters), preserving exact identity through REST and JavaScript.
It does not reference the internal numeric ID or cast the subject to a number.
The strict application owner check and database RLS remain in place.

No foreign key to `auth.users.sub` is assumed because its uniqueness and project
scope have not been verified. Account deletion therefore requires explicit
library cleanup before production account-deletion support; there is no automatic
cascade. This migration is for this single checked environment, not a shared
multi-project database. The two catalog check scripts only inspect metadata and
do not establish HTTP gateway JWT enforcement or actual account isolation.

Apply the revised migration once using the authenticated CloudBase SQL console.
If the same two compatibility warnings recur in this checked environment, they
can be acknowledged for this revised script. Investigate any different error.
For acceptance testing, run a separate local server with
`WHO_CLOUDBASE_LIBRARY_ENABLED=1`; keep the release configuration unchanged.
Verify with two ordinary users that each can read and write only their own
library. Verify stale revisions conflict and unauthenticated requests cannot
read or write. Enable released sync only after these checks; local mock tests
alone do not establish readiness.

Account storage keys include provider, environment ID and UID, preventing accidental
reuse of a different provider's local account data. Existing guest favorites are
uploaded only through the existing explicit import action.

## Check stale-version saves without retaining test data

Run the entire `cloudbase/check-library-conflict.sql` block in the CloudBase SQL
console as administrator. The block creates a random synthetic subject, switches
to the ordinary authenticated role, and exercises the deployed save function:
initial save, stale-version conflict with unchanged contents, current-version
save/read-back, and denial of the first subject's row to a second subject. It
also rejects an unexpected direct-write grant or a role that bypasses RLS.
Its inner PL/pgSQL exception block deliberately rolls back all test writes and
role/claim changes on success, and also rolls back if a check fails. Existing
account rows are not modified. Run the whole block, not individual statements.

A successful execution means these SQL assertions passed; any error is a failed
or blocked check. This is a database-role test with administrator-supplied test
claims, not real JWT validation or two simultaneous HTTP requests. It does not
replace the real-user acceptance checks.

Local validation uses optional PGlite 0.5.8 in an ignored tooling directory,
without changing product dependencies. Run `node tests/cloudbase-library-sql.cjs`
with `FIMI_PGLITE_PATH` pointing to an unpacked PGlite package when needed.
The checker passed locally and rejected deliberately removed version protection,
disabled RLS, and an extra UPDATE grant; baseline rows and role/claims were
preserved after both success and failure.

The user subsequently supplied a CloudBase console screenshot reporting successful
execution (0 affected rows) in response to the instruction to run the entire
conflict-check block. Record the deployed SQL assertions as passed on this
user-supplied evidence: stale writes rejected with prior contents preserved,
current-version writes readable, subject isolation and test rollback. This is
not a captured cloud execution trace or a simultaneous HTTP concurrency test.

## Not yet enabled / release gates

- Platform-funded AI credits and the server-side proxy are now implemented as
  a deployment candidate, but not deployed or activated. Each CloudBase account
  receives CNY 2 once; there is no shared spending cap, per the user's request.
  See `cloudbase/AI_TRIAL_DEPLOYMENT.md`. Without the deployment URL and explicit
  enable flag, `trial-quota` remains disabled and sponsored generation is rejected.
  Users can still connect their own AI service.
- No social login, old-account import, automatic identity linking or refresh flow.
- No domain binding, deployment, installer publication, or ICP filing in this step.
- Before release: verify real email delivery/language, new and returning users,
  logout/expiry, two-user database isolation, quota transaction and server-side
  proxy behavior, CAPTCHA, and mainland/overseas connectivity independently.

## Evidence

Local checks: `pnpm test`, `pnpm run test:release`,
`node tests/browser-cloudbase-login.cjs`, and `node tests/browser-email-login.cjs`.
Browser tests run the actual local UI with explicitly mocked cloud responses;
they do not prove real email delivery, cloud login, or database isolation.

Official references:
- https://docs.cloudbase.net/http-api/auth/auth-send-verification
- https://docs.cloudbase.net/http-api/auth/auth-verify-verification
- https://docs.cloudbase.net/http-api/auth/auth-sign-in
- https://docs.cloudbase.net/http-api/auth/auth-sign-up
- https://docs.cloudbase.net/http-api/auth/user-me
- https://docs.cloudbase.net/authentication-v2/auth/auth-pg
- https://docs.cloudbase.net/database/postgresql/data-permission
- https://docs.cloudbase.net/http-api/pgdb/postgresql-restful-api

Live user report (2026-10-02): Chinese UI sign-in succeeded; English UI sign-in
succeeded and the received email was English. Chinese email body language,
VPN-off access, overseas networks and two-user database isolation remain unverified.

Live unauthenticated checks after the reported SQL execution: GET library and
POST save RPC both returned HTTP 401 / MISSING_CREDENTIALS from the real gateway.
This proves rejection at the gateway, not table existence, SQL function behavior,
or RLS isolation for signed-in users. An isolated local acceptance server exposes
CloudBase email login and library sync with AI trial disabled; it is awaiting
user sign-in and actual save/read-back checks at that stage. No email was sent automatically.

Subsequent live user report: saving a test item, refreshing the cloud library,
then signing out and back into the same email account all succeeded, with the
item still present. This passes the single-account manual acceptance scenario.
The user subsequently reported the two-account isolation procedure passed:
each email account saved its own item and switching accounts did not expose
the other account's items (guest import was excluded by the test instructions).
This is a manual acceptance result for the normal application flow, not an
automated adversarial authorization test. Cross-device persistence, concurrent
revision conflicts and mainland/overseas network coverage remain unverified.
