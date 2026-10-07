# English explanation acceptance

## Selected beginner reading baseline — 2026-10-04

After inspecting the saved results and the Chinese/English comparison, the user selected the tested English method 3 draft plus the new paragraph reviewer as the current baseline. This applies to English Beginner-friendly word/symbol, single-line and selected-passage explanations. The selected runtime is build `3484695b6aef8641`; the English instructions are in `ai-point-prompts-en.js`, routed by `ai-point.js` and applied through `ai-point-paragraphs.js`.

Retain the tested prompts verbatim. Each successful explanation uses one draft request and one paragraph-review request, without an independent final model audit or automatic regeneration. Keep the existing source/selection verification, protocol checks and transactional paragraph edits. This decision does not select a new walkthrough prompt or change Standard mode.

The bounded English trial used all 12 authorized calls for six selections: all delivered; review had clear net benefit in three, left one unchanged, and had mixed effects in two. Known readability issues remain in the nullish explanation and the reviewed notification-results passage, where unnecessary asynchronous terminology was introduced. Selection is a product decision, not a claim of universal readability or factual correctness. Preserve these observations rather than silently rewriting the selected prompts or expanding paid tuning.

The source integration previously passed 483 automated tests, 19 release samples and 24 browser checks. This selection records the already-tested code; it adds no paid calls or runtime changes and does not update a running older product preview, cloud deployment or installer. Full local evidence and the selection manifest remain in the ignored `.browser-artifacts/method3-english-20261004/` directory. Later changes require a separately identified candidate and comparison against this baseline.

## Earlier criteria and evidence

Current severity criteria, focused live results and remaining limits are recorded in [the latest follow-up](BILINGUAL_FOCUSED_FOLLOWUP.md). The previous targeted regression report remains historical evidence. The checks below describe the acceptance criteria; they are not a claim that every complex AI explanation meets them.

English and Chinese use the same source-grounding rules and teaching depth. English uses natural English phrasing and conventional programming terms, with an immediate everyday explanation when the reader is a beginner. Switching language does not translate source, identifiers, comments, or previously saved AI responses.

## Reproducible checks

Use Beginner-friendly mode and this self-authored source. Analyze statically; do not execute it.

```javascript
function total(items, discount = 0) {
  let sum = 0;
  for (const item of items) {
    if (item.quantity <= 0) continue;
    sum += item.price * item.quantity;
  }
  return Math.round(sum * (1 - discount) * 100) / 100;
}

async function loadName() {
  const user = await getUser();
  return user.name;
}
```

- Overview: distinguish the two functions and keep the quantity condition. Do not claim they are called by this file.
- Flow for `total`: skip zero/negative quantities, accumulate before applying the discount and rounding. Keep parser-owned branches and ranges. Do not explain unrelated functions.
- Line 11: explain the call, waiting and result binding; the implementation of `getUser` is unknown. Do not invent a network request.
- Word `await`: explain what is paused, without claiming the entire program stops. Explain unfamiliar terminology when needed.
- Brief, full walkthrough: cover both main functions, with short sections. Explain Promise in everyday English. Distinguish a failed awaited call from an error reading the resulting value. Do not automatically append generic questions.
- Repeat a selected-line explanation in Chinese and in English Standard mode. Compare facts and level of detail, not word-for-word phrasing.
- Switch language while a request is running: old results must not appear or enter the new language's cache. Preserve exact source and saved content.

## Verification boundaries

Automated tests verify routing, schemas, locale preferences, source preservation, branch polarity and invalidation. They do not assess the quality of a live model's prose. Live results and limitations are recorded in VALIDATION.md. No tests in the default suite make paid model calls.
