# Repository collaboration

- Read README.md, CONTRIBUTING.md, ARCHITECTURE.md and VALIDATION.md before
  changing behavior. The product is Who Is JSON; the package and some internal
  identifiers still use CodeLingo.
- Work on a task branch and target `main` in a PR. Follow the existing PR
  template. Keep each PR focused; do not combine feature work with broad
  formatting changes.
- Use the pnpm version in `package.json` and the existing `pnpm-lock.yaml`.
  Install with `pnpm install --frozen-lockfile --ignore-scripts`; do not generate
  npm or Yarn lockfiles.
- Development verification uses Python 3.12. Set `CODELINGO_PYTHON` and ensure
  the same interpreter is available as `python` on PATH: some historical tests
  invoke that name directly. On Windows, `dev.ps1` prepares both settings.
- Run `pnpm test` and `pnpm run test:release` for shared analysis/model changes.
  On Windows, `./dev.ps1 -Task Verify` runs both. For UI changes, also run the
  relevant browser scripts as described in VALIDATION.md. State any unrun checks.
- Parsers own syntax and positions; semantic modules own behavior facts;
  `explanation/model.js` defines the shared guide; UI modules render it.
  Include positive and negative examples for new semantic rules.
- Source positions use one-based lines and zero-based UTF-16 columns, with
  exclusive end columns. Preserve original source and verify Unicode, copied
  formatting, and partial recovery when touching location logic.
- Never execute or import user source, corpus files, holdout files or fixtures
  as part of analyzing them. Tests may execute the project's explicit teaching
  examples; this does not authorize executing third-party samples.
- Preserve exact sample bytes, manifests, source commits and licenses. Do not
  rewrite expected hashes to hide checkout or content changes. Respect
  `.gitattributes` for tests/corpus, tests/holdout and tests/fixtures.
- Keep machine paths, credentials, local reports and installed tools out of
  tracked files. Local development preferences belong in
  `.runtime/dev-config.json`; generated reports belong in `.browser-artifacts`.
- Desktop packaging is a separate workflow under desktop/. Do not infer that
  passing source tests validates the installer or Windows GUI integration.
