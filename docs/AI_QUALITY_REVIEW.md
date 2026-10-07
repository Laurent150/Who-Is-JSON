# FIMI AI quality review — 2026-10-02

## Confirmed causes and changes

The default contracts pipeline previously made two calls: fallible source
notes, then manuscript composition. Composition requested a self-check but had
no later independent review. Quote membership and JSON structure checks did not
validate semantic claims. CloudBase forced thinking off even when the personal
connection supported reasoning. These are concrete differences; they do not
quantify a capability gap or prove thinking fixes it.

The candidate keeps complete source in all stages, validates composed JSON,
independently reviews the manuscript, and transactionally applies only existing
prose corrections. Invalid fact notes permit one schema/quote protocol repair;
invalid review permits one review protocol repair. Neither check is weakened.
Service failure
or cancellation does not retry a billable request or expose unchecked text.
Existing point explanations use the same condition and counterexample checks.

`ai-logic-policy.js` covers AND/OR/NOT, comparison boundaries, independent versus
exclusive conditions, absolute claims and result transformations. It requires
concrete novice expression, decisive conditions and nonrepetition. It is a model
instruction, not a semantic proof or source executor.

The new CloudBase policy accepts bounded low/high thinking for fact and review
phases, with pinned Flash and existing input/output limits and accounting.
Reasoning tokens are counted once in completion usage. Composition stays
non-thinking; final review adds a normal model call, latency and cost. Legacy
trial adapters keep their original capability bounds.
Scope hints identify broad claims for additional model attention; they do not
judge correctness or replace words locally. A complete walkthrough uses three
normal calls, at most five if both bounded protocol repairs are needed.

Actual outputs showed that the same-model reviewer could introduce a new false
absolute claim even after the drafting instructions prohibited it. For JS/TS,
`ai-source-returns.js` now supplies exact parser-derived parameter-return
statements and selected-statement enclosing loop headers to review. Relevant
records are supplied even when the draft has no matching claim: review must
check its own additions as well. These are syntax records, not proofs of
reachability, types or runtime effects; unsupported languages retain full-source
review without fabricated parser evidence.

One repeatedly observed JSON error was a missing closing bracket after a flat
`unknowns` string array, before an existing object close. The local repair only
inserts that delimiter at that exact grammar location, then runs the unchanged
schema and source-quote checks. It does not complete a truncated response or
invent facts. Other invalid ledgers still permit at most one paid repair.

## Checks and their meaning

Automated setting coverage: both languages × both reading modes × three audiences
× three detail levels × two coverage scopes = 72 walkthrough combinations. Tests
also cover token/line review in both languages/modes, source/selection preservation,
rejected review, cancellation, thinking forwarding and reasoning accounting.

These mocked provider checks establish request/response behavior, not actual
generated accuracy or novice comprehension. Browser checks use the real
app/parser with mocked AI to verify bilingual failures and existing Word/Markdown
exports without extra model calls.

## Real API evaluation

`node tests/ai-quality-server.cjs` starts a localhost-only manual evaluator. A
saved pre-change snapshot is required; without it the evaluator refuses to call
current code the old version. A personal key entered in the local password form
stays in memory, is cleared from the form and is absent from status and reports.

Four groups use the same source/settings: old chain with thinking off/on and
candidate chain with thinking off/on. The candidate also changes condition
instructions, so this compares the combined changes, not only adding a review.
Actual request parameters are captured per stage. Each batch has at most six
outputs; the session originally allowed 80 dispatched requests and stops a batch
on failure. At request 79 the user explicitly authorized increasing the total
cap to 90 for final regression checks. The cap counts every dispatched request,
including failed calls and protocol repairs; records survive a service restart,
while the in-memory key does not.
It records final prompts, model prose and usage, never hidden reasoning text.

Static self-authored cases include independent accumulating rebates, a locked
counter bypassing clamping, and an async factory with retry/zero/fractional
attempt boundaries. They are never executed. Acceptance facts are not sent
to the model. Case source hashes and stage outputs are kept in local reports.

Judge final results for accuracy, consistent conditions, causal explanation,
audience fit, repetition and language. Valid JSON means a successful return only.
A model reviewer's approval is not an independent human quality judgment.
Repeated known cases do not replace later unseen-input acceptance.

This tool uses the official provider and personal credentials with local gateway
policy emulation. It does not validate deployed CloudBase authentication,
settlement, latency or thinking. Deployment needs the tagged package and a real
authenticated check; see [deployment instructions](../cloudbase/AI_TRIAL_DEPLOYMENT.md).

Official parameter reference: [DeepSeek thinking mode](https://api-docs.deepseek.com/guides/thinking_mode/).

### Initial live observations and refinement

The first 12 outputs dispatched 30 provider requests: 10 returned a manuscript,
and two stopped at invalid fact-ledger JSON/schema. This is a return count, not
a quality pass rate. One candidate without thinking misplaced `unknowns`; one
candidate with thinking left an array unclosed. Thinking did not eliminate
protocol errors. This evidence motivated the bounded fact-protocol repair.

Six rebate manuscripts covered all audiences in both languages with beginner
reading, standard detail and full coverage. They preserved the independent
voucher condition, but Codex source-to-output inspection found overbroad input-domain/cap claims,
unhelpful timing wording and excessive technical density in some outputs.
The first detailed counter manuscript correctly distinguished locked early
return from unlocked clamping and coercion; the following peer run failed its
fact protocol and stopped the batch. English outputs contained no Chinese prose
in this sample; that is not an unconditional language guarantee.

The refinement scopes error claims to reached operations, checks broad headings
and domain claims, distinguishes synchronous completion from instant work, and
asks novice prose to omit unnecessary timing/exotic-type detail.

At the cap-extension checkpoint, 32 outputs had dispatched 79 requests: 29
returned and three failed their fact protocol. These are cumulative development
runs across changing revisions, not a final-model pass rate. Six detailed counter
manuscripts covered all three audiences in both languages. The source's locked
branch returns the caller's value unchanged; nevertheless, English and Chinese
review prose incorrectly inferred that a non-async function never returns a
Promise. Repeating a general prompt rule did not reliably remove this error.

The next English retry removed that claim, but its draft did not trigger the
then-gated source hint, so the improvement cannot be attributed to that hint.
Selected-line explanations exposed another blind spot: a completed catch was
described as necessarily causing another attempt, even though a fractional
attempt count can terminate at the loop condition. Keyword-gated hints also
missed a paraphrase, and review introduced the same error. This motivated always
supplying relevant parser records instead of relying on wording triggers.

The latest Chinese beginner line explanation at request 79 used the loop hints
and correctly described awaiting success, early return and transfer to catch,
without promising a retry or adding an unrelated boundary lecture. Token tests
covered both languages and reading modes; early beginner answers repeated code
names too heavily, and revisions added concrete action/value explanations.
Real walkthrough samples cover standard and detailed outputs, full and highlight
coverage, and all audiences; brief mode has automated coverage only. The real
sample is not all 72 setting combinations and is not a broad unseen-code study.

### Final focused regression results

After the authorized restart, four outputs used nine additional requests,
ending at **88 of 90 requests**. All four returned reviewed results without a
protocol repair. Codex inspection of their actual prose found:

- English, code-review audience, standard reading, detailed/highlights: relevant
  return-origin hints were present. No unsupported “non-async means never returns
  a Promise” guarantee appeared. Review also corrected a heading that wrongly
  implied the locked branch bypassed the earlier incoming assignment; the final
  text distinguishes assigning the local result from returning current.
- English beginner selected-line explanation: short, local explanation of
  waiting, successful return and failure transferring to catch, without an
  unconditional retry claim. It explains the returned Promise in context.
- English standard selected-line explanation: distinguishes fulfillment,
  rejection and synchronous call failure; after catch it follows increment,
  condition recheck, conditional next attempt or the skipped result.
- Chinese standard selected-line explanation: likewise requires the actual
  loop condition to remain true before another attempt. Relevant loop syntax
  hints were present in all three selected-line reviews. Together with the
  earlier Chinese beginner check, both languages and both reading modes were
  inspected for this loop-boundary regression.

These are passes for the stated targeted regressions, not a blanket content
quality certification. The inspection was performed by Codex, not independent
human reviewers. The English detailed review remains dense and contains
some unnecessary scope boilerplate. The Chinese standard answer calls the
Promise-returning callback an “asynchronous function”; “callback declared to
return a Promise” would distinguish its contract from an unobserved `async`
declaration more precisely. No claim is made that all presentation issues have
disappeared or that parser hints alone caused the observed improvement.

The cumulative development record is **36 outputs, 33 successful returns and
three fact-protocol failures**, spanning several revisions. A returned response
is not automatically accurate. The latest four-output batch is only a focused
regression sample; it is not a controlled model comparison, an unseen holdout
study or proof of universal improvement. The remaining two authorized requests
were not spent just to reach the cap.

Final automated checks: **368 tests passed**, including all 72 mocked setting
combinations; **19 release samples passed**, build `a11ab73a3c660569`. The local
main preview on port 43173 was restarted with that build. The CloudBase
`review-thinking-v1` package is prepared but not deployed; its live identity,
settlement and reasoning behavior still require deployment acceptance. No new
installer was built. The local connection page now retains connection errors
instead of overwriting them during polling; that fix was verified without
dispatching a paid request.
