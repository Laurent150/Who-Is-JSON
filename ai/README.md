# AI reading modules

Server-side modules for contextual code reading, examples, follow-up questions,
provider requests, and response validation. `server.js` loads the public entry
points from this directory; browser UI code lives in `public/`.

- `ai-client.js`: provider transport and shared request handling.
- `ai-point.js`, `ai-direct-reading.js`: word, symbol, and selected-source reading.
- `ai-flow.js`, `ai-module-reading.js`: explanations attached to code structure.
- `ai-followup.js`: shared follow-up policy used by local and trial requests.
- `ai-talk-*.js`: retained walkthrough implementation; the current UI entry is unavailable.

Moving these modules does not change their prompts or provider settings. The
desktop payload list and CloudBase bundle builder include their `ai/` paths.
Run the repository tests from the project root.
