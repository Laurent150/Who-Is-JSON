# Who Is JSON

Use **解释风格** (Explanation style) in the header to switch between **零基础友好** (Beginner-friendly, the default) and **标准** (Standard). The browser remembers your choice. Beginner-friendly AI explanations focus on the immediate action in one or two short sentences, adding a small example only when useful. Local reference details can be expanded. Switching clears current AI explanations and the talk draft without changing source code or saved cards; generating again is an explicit action. Style constraints do not guarantee model accuracy.

[简体中文](README.md) · [English](README.en.md) · [日本語](README.ja.md) · [한국어](README.ko.md)

**Understand the code you find, and learn from it.**

An **AI-assisted code reading tool for vibe coders**, with interactive explanations and a personal knowledge library. Import source code, explore its purpose, steps and changing values, click unfamiliar terms, and generate a standalone explanation for review or interview preparation. For locally supported languages, follow functions, branches and loops alongside the original source.

**This is a documentation translation.** The application UI, built-in knowledge cards and default AI explanations are still primarily in Chinese. An interface language switch has not been implemented. Chinese button labels below help you find the current controls; linked supporting documents may also be in Chinese.

The current version is **0.8.0 preview**. See the [release notes](docs/releases/v0.8.0.md). The app reads and explains code; it does not execute imported source. Successful parsing does not prove that a program runs correctly.

This is the clean public distribution of v0.8.0. Original feedback test snippets have been replaced with independently authored samples, while development history remains in the original private repository. See the [public migration notes](docs/PUBLIC_MIGRATION.md) and [contributors](CONTRIBUTORS.md).

## Features

| Feature | What it does | AI required? |
| --- | --- | --- |
| Import and local parsing | Paste, drop or select source files; identify supported languages, functions and source ranges | No |
| AI code workspace | Expand flows on the left, read full source in the middle, and understand the selected step on the right; click nodes to locate branches, loops and exception paths | For explanations; source and function listings remain available without AI |
| Calls within the current file | Expand confirmed calls to another function, with recursion limits | Yes; call locations come from parsing, with a focus on Python |
| Click-to-explain source | Select statements or click variables, function names, keywords and operators for contextual explanations and small examples | Yes |
| Structure reference and knowledge cards | Browse local structure, available syntax lessons and examples; save and export learning material | Local material does not require AI; coverage varies by language |
| Categorized favorites | Save complete AI knowledge cards with related source; filter, search, reclassify and export | Generating AI cards requires AI; reading saved cards does not |
| Standalone explanation | Generate a code walkthrough by reading level, scope and detail; stop, retry, export or use the focused reading view | Yes |
| Image recognition | Import PNG, JPG or WebP, transcribe and review before analysis; English and Simplified Chinese OCR data are included | Local OCR: no. AI vision: a vision-capable model |
| Windows tools | Region screenshots and a floating desktop window through the root launch scripts after dependency installation | No |

![Three-column workspace and term explanation](docs/screenshots/ai-workspace.png)

*This screenshot comes from interaction testing with simulated AI. Actual text depends on the configured model.*

## Language support: explanations and structural navigation

**C and C++ can be imported and explained by AI.** Click-to-explain, follow-up questions and standalone explanations use source directly and do not require a function listing. Quality depends on the model and available context.

**AI supplies explanatory text; local parsers supply function listings, flow structure and confirmed call locations.** AI adds meaning to existing nodes. It does not automatically build complete function graphs for languages without a local parser.

| Source type | AI explanations and walkthroughs | Local structure |
| --- | --- | --- |
| Python | Available | Functions, branches, loops and some calls within the current file |
| JavaScript / TypeScript, Java, Bash | Available | Corresponding structures, with limits around complex syntax and call relationships |
| Dockerfile, JSON, YAML, HTML, CSS, SQL, `.gitignore` | Available | Instructions, hierarchies, rules or statements; not all are program flowcharts |
| **C / C++** (`.c`, `.cpp`, `.h`) | **Import and request AI explanations** | File type identification only; no function listing, function flowchart or call expansion |
| Go, Rust, C#, PHP, Ruby | Import recognized extensions and request AI explanations | File type identification only |
| MATLAB and other text source | Paste or import as `.txt`; specify the language in a question when needed | No corresponding reliable local parser; not every original extension can be imported directly |

“Available” means that the app provides a request path, not that every language, syntax or model has passed accuracy evaluation. The app does not compile or run C/C++, automatically read header implementations or external libraries, or load an entire project.

## Installation

### Requirements

- Node.js **20 or later**; **24** is recommended to match CI. Make sure `node` and its bundled `npm` are available.
- Python **3.12** is recommended to match development checks. The Windows development script requires 3.12 or later.
- pnpm **10.15.1**, as specified by `packageManager` in `package.json`.
- Clone this public repository, or download and extract its ZIP from GitHub.

```sh
git clone https://github.com/Laurent150/Who-Is-JSON-Public.git
cd Who-Is-JSON-Public
```

### Windows (PowerShell 7)

Run from the repository root:

```powershell
./dev.ps1 -Task Install
./dev.ps1 -Task Start -Python (Get-Command python.exe).Source
```

`Install` installs the pinned pnpm version and dependencies from the lockfile. If `python.exe` is not Python 3.12, replace the value after `-Python` with the path to your Python 3.12 executable. See [contributing](CONTRIBUTING.md) for configuration details.

### With pnpm already installed (Windows / macOS / Linux)

Verify that `pnpm --version` returns `10.15.1`, then run:

```sh
pnpm install --frozen-lockfile --ignore-scripts
pnpm start
```

If Python is not found at the default location, set `CODELINGO_PYTHON` before starting. On macOS / Linux: `export CODELINGO_PYTHON="$(command -v python3)"`. In PowerShell: `$env:CODELINGO_PYTHON = (Get-Command python.exe).Source`.

Open **http://127.0.0.1:43127**. Stop the server with `Ctrl+C`; use `CODELINGO_PORT` to change its port. The app only listens on localhost. Screenshot capture and the floating window are Windows-only. This release provides source to run after installing dependencies; no desktop installer was rebuilt.

## Usage

1. **Add code.** Choose “导入文件” (Import file), paste source, or select an example under “开源代码试读” (Open-source examples). The source limit is 100 KB. Keeping the filename helps identify the language. For images, choose “识别代码” (Recognize code), then check indentation, underscores and punctuation against the image.
2. **Open the workspace.** Choose “查看整段结构” (View full structure). The default is “AI 代码工作台” (AI code workspace). Supported local parsers show a function or structure listing. Other languages, including C/C++, still show source. An unsupported-structure message does not mean AI explanations are unavailable.
3. **Connect AI when needed.** In “设置” (Settings), enter a Chat Completions-compatible base URL, model and key. The base URL typically ends in `/v1`, not `/chat/completions`. Saving settings does not verify the connection.
4. **Read interactively.** Click a line for an explanation, use `Shift` to extend a selection, or click a term and close it with `Escape`. Arrow keys select lines; the right arrow enters terms. Expand a function and choose “生成这个函数的 AI 流程” (Generate AI flow for this function), then click steps to locate source. Without a function listing, use source explanations or the standalone walkthrough.
5. **Generate a walkthrough for review or interview preparation.** Open “讲解稿 · 可选” (Optional walkthrough), choose reading level, scope and detail, then “生成 AI 讲解稿” (Generate AI walkthrough). It explains purpose, inputs/outputs, approach, steps, examples and limits, with source-specific Q&A. It omits formal speech openings and has no speech-duration setting. It does not require an overview or a local function listing first.

“AI 总览（可选）” (Optional AI overview) controls overview generation and whether images use local OCR or AI vision. **Flow generation, source explanations and walkthrough generation are separate AI operations and are not disabled by this switch.** They each require valid configuration and provide errors or retry options.

With AI configured, uncertain language identification, parsing failures or missing usable program structure trigger an AI language check during analysis. The corresponding local parser then verifies the result. This works even with AI overview unchecked and can be stopped. Uncertain guesses, request failures or failed local verification preserve the original result. This step does not rewrite source or invent structure; languages without a parser still use source explanations and walkthroughs.

When copied code has formatting problems, a repair entry appears as needed. Preview local cleanup or AI repair suggestions, review the changes and apply them explicitly. You can undo before editing further. AI repair calls your configured service and does not automatically replace source.

### Favorites and review

Simple name definitions only show an explanation. A save button appears when AI returns a complete knowledge card with a principle, an independent example and pitfalls. Loading, connection notices and failures cannot be saved as cards. AI may misclassify content; generated examples are hypothetical and have not been executed.

“我的收藏” (My favorites) defaults to all cards. Filter by syntax and fundamentals; flow and functions; data structures and algorithms; async and error handling; files, networking and systems; or engineering and design. Search titles, tags and associated source. Only populated categories appear, and each card can be reclassified manually. Existing favorites remain available and receive automatic topic categories. Identical cards can link to multiple source snippets; exports include categories and AI attribution.

Favorites remain in the current browser. There is no account login, cloud sync or centrally paid AI service; users configure their own AI provider.

### Quick path for C/C++

Import `.c` or `.cpp` → view full structure → configure AI → click a source line or term, or generate a walkthrough. Do not wait for a function flow on the left: this version does not generate one for C/C++. Missing headers, macros or external function definitions require additional source to explain specific behavior.

## Example input and output

Save as `total.py` and import:

```python
def total_price(prices):
    total = 0
    for price in prices:
        total += price
    return total

amount = total_price([10, 20])
```

- **Structure:** `total_price` is on lines 1–5; the loop is on lines 3–4; line 7 calls this function.
- **Purpose:** add the supplied prices and return their total.
- **Steps:** start at zero → add each price → return the total.
- **Terms:** `[10, 20]` is a two-number list; `+=` adds to and updates `total`; `:` after the `for` line introduces the indented loop body.
- **Hypothetical result:** `0 + 10`, then `10 + 20`, gives `amount = 30`. With no `print`, the code does not print 30.

These are illustrative explanations, not guaranteed model output. The app does not run this input to compute a result; check AI explanations against the source.

## Data and limitations

- Local parsing and local OCR do not upload content to a model. AI overview, language identification, repair, flows, source explanations and walkthroughs send the relevant source and selections to your configured service; AI vision sends images. Charges and server-side data handling depend on that service.
- The service address, model name and favorites are stored in the browser. API keys are not persisted by the app and must be re-entered after a refresh. Favorites can contain source; review them before exporting or sharing.
- OCR can make mistakes. Indentation is estimated from image positions, and parseable output may still differ from the image.
- Flows depend on locally recognized structure. External function behavior cannot be confirmed from the current file alone. Oversized functions require a smaller scope; unfinished AI node explanations are marked as incomplete.
- Automated tests do not prove that arbitrary code will be explained correctly or that all new users will understand it. Real-model quality still needs evaluation; see the [workspace guide](docs/STUDIO.md) and [validation record](VALIDATION.md).

## Development and references

```sh
pnpm test
pnpm run test:release
```

Provide Python 3.12, set `CODELINGO_PYTHON`, and add its directory to `PATH`. On Windows, run both checks with `./dev.ps1 -Task Verify -Python (Get-Command python.exe).Source`. See [validation](VALIDATION.md) for browser and real-AI checks. Default tests do not call paid models.

- [Contributing and pull requests](CONTRIBUTING.md)
- [Architecture](ARCHITECTURE.md)
- [Workspace guide](docs/STUDIO.md)
- [Third-party code and references](OPEN_SOURCE_REFERENCES.md)
- [Local OCR data and limits](ocr-data/README.md)
- [Desktop packaging](desktop/README.md)

Project code is licensed under [MIT](LICENSE). Third-party samples and OCR data retain their own sources and licenses; they are not all relicensed under MIT.
