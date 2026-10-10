<p align="center">
  <strong>English</strong> · <a href="README.zh-CN.md">简体中文</a> · <a href="README.ja.md">日本語</a> · <a href="README.ko.md">한국어</a>
</p>

<h1 align="center">FIMI</h1>

<h3 align="center">Understand your code, one click at a time</h3>

<p align="center">A code-reading workspace for people building with AI and learning along the way</p>

<p align="center">
  <a href="https://github.com/Laurent150/FIMI/releases/latest"><img src="https://img.shields.io/github/v/release/Laurent150/FIMI?style=flat-square&amp;color=496B4A" alt="Latest release"></a>
  <a href="https://github.com/Laurent150/FIMI/releases/latest"><img src="https://img.shields.io/badge/desktop-Windows%20x64-496B4A?style=flat-square" alt="Windows x64"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-DCE7A4?style=flat-square" alt="MIT license"></a>
</p>

<p align="center">
  <a href="#get-started">Get started</a> · <a href="#what-you-can-do">Features</a> · <a href="#run-from-source">Run from source</a> · <a href="https://github.com/Laurent150/FIMI/issues">Feedback</a>
</p>

## See FIMI in action

https://github.com/user-attachments/assets/6b5deab6-18f2-4a1f-a3b5-622c61fa94fb

Follow a checkout function from an unfamiliar symbol to a practical question: why did a discount remove free shipping? Read the code, trace the decision, ask how to change it, and save the answer with its source.

## Why FIMI

Getting code from an AI is often easier than understanding what it does. FIMI helps you work through that gap without moving between a code editor, a chat window, and scattered notes.

Start with the part you do not understand. A word or symbol opens an explanation in context; a flow step takes you to its source; a follow-up question helps you connect the syntax to the behavior. Whether you call it vibe coding or are learning your first language, the goal is the same: understand the code you build with.

## What you can do

| Feature | In practice |
| --- | --- |
| **Read a word, symbol, or line** | Click a name, `=>`, or a whole line for an explanation tied to the current code. Drag the explanation card out of the way and close it when you are done. |
| **Follow the flow** | Open a function or module, then select a step to see the corresponding source and explanation side by side. Move from the overview to the detail without losing your place. |
| **Understand a passage** | Select a flow module or step to read the connected code as a unit, rather than piecing together isolated definitions. |
| **Ask for an example** | Turn an abstract condition or calculation into a concrete case you can follow. |
| **Ask a follow-up** | Ask why something happens or how a change would affect the current code. The source stays alongside the answer. |
| **Save what you learn** | Keep useful explanations in **Saved**, search them later, and reopen the source as it was when you saved it, with the relevant location highlighted. |

Completed click explanations are reused when you revisit the same selection in the current page. The interface and AI explanations support English and Simplified Chinese; English is the default and your language choice is remembered.

## Get started

1. **Install FIMI.** Download [FIMI for Windows 10/11 x64](https://github.com/Laurent150/FIMI/releases/download/v1.2.2/FIMI-1.2.2-Windows-x64-Setup.exe). Node.js and Python are bundled; no developer setup is required.
2. **Choose your AI connection.** Sign in with email to use the limited AI trial when available, or open **AI settings** and enter your own OpenAI-compatible API base URL, model name, and API key.
3. **Bring your code.** Paste it, import a file, or try the built-in example. Open a module in the flow map, click the source, and ask about anything that needs a closer look.

The Windows installer is currently unsigned. Checksums are included in the [release](https://github.com/Laurent150/FIMI/releases/latest); see the [installation guide](docs/WINDOWS_INSTALL.md) for details.

### Code and language support

Python, JavaScript/TypeScript, Java, and Bash have local structural navigation. Configuration and data formats such as JSON, YAML, HTML, CSS, SQL, and Dockerfile use structures appropriate to their format. C/C++, Go, Rust, C#, PHP, and Ruby can be imported for AI reading, but do not currently have full local function maps.

You can also import an image of code, recognize the text, and check it before reading. Local OCR includes English and Simplified Chinese; AI image recognition requires a vision-capable model. README translations do not imply additional interface languages.

### AI, accounts, and your code

- Local parsing and local OCR run without an AI connection. AI explanations require the trial or a configured provider; trial availability and usage limits apply.
- AI features send the relevant source and context to the selected service. AI image recognition also sends the image. Provider pricing and data policies apply when using your own service.
- Guest saves stay in the current browser. Account saves sync explanations **and their linked source** to the cloud.
- FIMI reads code; it does not run it. Explanations and examples should be checked against the source, especially when dependencies or surrounding code are missing.

## Run from source

Use Node.js 20 or later, Python (3.12 recommended), and pnpm 10.15.1.

```sh
git clone https://github.com/Laurent150/FIMI.git
cd FIMI
pnpm install --frozen-lockfile --ignore-scripts
pnpm start
```

Open <http://127.0.0.1:43127>. If Python is not on your PATH, set `CODELINGO_PYTHON` to its executable before starting. Windows setup scripts and development checks are covered in [Contributing](CONTRIBUTING.md).

## Contributing

Bug reports, reproducible code examples, and improvements to explanations are welcome. Open an [issue](https://github.com/Laurent150/FIMI/issues) or read the [contribution guide](CONTRIBUTING.md) before submitting a pull request. Please remove credentials and private code from anything you share.

## License

FIMI is released under the [MIT License](LICENSE). Third-party components and datasets retain their own licenses; see [attributions](OPEN_SOURCE_REFERENCES.md).
