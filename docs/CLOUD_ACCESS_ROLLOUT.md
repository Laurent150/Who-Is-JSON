# Cloud access rollout

Status: implementation prepared for deployment; email delivery and regional connectivity are **not verified**. The production Supabase project, DNS and mail configuration have not been changed. The default release continues to use the existing Supabase origin and GitHub sign-in. Email sign-in remains hidden until enabled by the operator.

## Keep Supabase for the first deployment

The current problem is reaching the login service. Replacing the authentication/database engine would add account, identity, saved-library and trial-credit migration work without proving that the new network route works. First test a FIMI-operated HTTPS entry point against the same project. It must serve the existing Supabase-compatible `/auth/v1`, `/rest/v1` and `/functions/v1` APIs. This is not a generic forwarding proxy and must not accept an upstream URL from callers.

A domain alone is not a connectivity fix. The entry point's hosting network must be reachable by the intended users, and its outbound route must reach Supabase and the platform AI service. Select hosting only after testing candidate locations from mainland Chinese networks and intended overseas regions. No VPN is assumed. Do not advertise worldwide availability based on one computer or a successful health request.

Replace or self-host Supabase only if this deployment cannot achieve the required reliability or operating requirements. That decision needs an account/data migration and rollback design first. Do not create an unrelated second project and silently send existing users to empty libraries.

## Deployment inputs and configuration

Needed: a domain controlled by the publisher, an HTTPS service host, and a production SMTP sender. No vendor or paid resource has been selected or purchased.

Configure the app's trusted release/operator environment as a matched pair:

```text
WHO_SUPABASE_URL=https://accounts.example.com
WHO_SUPABASE_PUBLISHABLE_KEY=<public key for the same existing project>
WHO_CLOUD_ALLOW_CUSTOM_ORIGIN=1
WHO_EMAIL_LOGIN_ENABLED=1
```

`example.com` is a placeholder, not a working service. Do not put a service-role key, SMTP password or OAuth secret in the app. The URL is a bare HTTPS origin without credentials, paths, query strings or custom ports. A non-Supabase hostname needs the explicit custom-origin switch. Cloud API requests reject redirects to prevent silently forwarding request bodies or keys elsewhere. OAuth browser navigation continues to use the provider's authorization flow.

These are publisher settings, not fields every user must configure. After validation, include the approved public settings in the release configuration or managed launcher environment. The current installer does not enable them automatically. `WHO_CLOUD_DISABLED=1` still disables cloud use.

The entry point must use a fixed upstream, verify TLS, avoid logging authorization headers, codes or request bodies, and preserve existing RLS and trial enforcement. Allow only the needed API routes. Apply service-side send/verify rate limits; local desktop rate limits are not protection against direct abuse of public Auth APIs. Do not retry one-time authentication exchanges or billable AI calls when their outcome is unknown. Configure timeouts long enough for the existing AI trial call.

## Email OTP prerequisites

1. Enable email authentication with email confirmation. Configure custom SMTP, verify the sender domain and configure SPF/DKIM/DMARC according to the sender's instructions.
2. Change the Supabase Magic Link template to include `{{ .Token }}`. This app uses a numeric code entered in the same window, not a browser callback. Use a short, clear bilingual email template initially. Configure six-digit codes and a ten-minute expiry to match the local sign-in flow.
3. Keep production send/verify rate limits and an abuse response plan. If CAPTCHA becomes mandatory, integrate its challenge before enabling that requirement for these clients; this implementation does not include CAPTCHA.
4. Test actual delivery and confirmation with an authorized test mailbox before setting `WHO_EMAIL_LOGIN_ENABLED=1` for releases. Until then leave the switch unset. Supabase's default SMTP is restricted and is not a public production mail service.

Official references: [Email OTP](https://supabase.com/docs/guides/auth/auth-email-passwordless), [SMTP requirements](https://supabase.com/docs/guides/auth/auth-smtp), [self-hosting responsibilities](https://supabase.com/docs/guides/self-hosting).

## Accounts, AI and source preservation

Email sessions use the verified Supabase user ID and the existing library RLS. They do not merge libraries by an email address supplied by the browser. Existing GitHub login, PKCE and saved-library ownership remain intact. Guest collections are copied only by the existing explicit import action.

Platform trial accounting remains tied to a verified GitHub identity. Email-only users can sync collections and connect their own AI service; the interface says so. Adding email-only sponsored credits needs a separate server-side wallet/abuse policy and a migration that preserves existing balances. This rollout does not grant extra credits or change the trial database/functions.

Source code is not translated, executed or changed by login or language switching. Existing manuscript audience/style policies remain intact. Overview, flow, selection and manuscript generation/review already use the selected language. Language identification now receives the locale, and AI image transcription now uses matching English/Chinese instructions while preserving the original language of source text.

## Release acceptance and rollback

Local verification uses mocked cloud responses. It covers OTP expiry, attempt limits, cancelled/concurrent requests, identity mismatch, token isolation, existing GitHub behavior, library revision ownership, bilingual errors and source preservation. This does **not** prove live email delivery, live RLS or cloud reachability.

Before release, record network/region, app build, selected language, time and outcome for: email code delivery and sign-in, existing GitHub sign-in, a real AI explanation and review, save/reopen on the same account, cross-account isolation, and cloud interruption followed by local editing. Include VPN off and on where available, with at least a mainland network and an overseas network. Do not count retries as additional passing users or substitute an HTTP health check for these flows.

If the entry point fails, restore the prior matched URL/public key configuration and unset the custom-origin switch; this returns to the old connectivity characteristics, not guaranteed availability. Disable email sign-in separately with `WHO_EMAIL_LOGIN_ENABLED=0`. Because this stage makes no schema or account migration, existing accounts and saved data remain in the same project. Do not disable TLS, the firewall or antivirus to make a test pass.
