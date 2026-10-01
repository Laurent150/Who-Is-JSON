# English explanation acceptance

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
