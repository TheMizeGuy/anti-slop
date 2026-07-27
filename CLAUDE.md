# anti-slop

Claude Code plugin that catches agentic-dev shortcomings (security, accessibility, AI-default design, banned vocabulary, regressions). Public repo TheMizeGuy/anti-slop, MIT, version 2.0.0. This clone is the source of truth for development; the LIVE plugin runs from the Claude Code plugin cache — changes here do nothing to the running session until the plugin is updated/reinstalled from the marketplace repo.

## Layout

- `anti-slop/` — the plugin itself: `skills/anti-slop/` (SKILL.md + 13 references), `agents/slop-detector.md`, `commands/slop-check.md`, `scripts/` (the scanner CLI). No `.mcp.json`: the MCP server was removed in 2.0.0 and the plugin has zero runtime dependencies.
- `.claude-plugin/` at root — marketplace manifests.
- `anti-slop/scripts/slop-scanner.mjs` — the CLI entry point and the module that re-exports the rule tables (never rename; the command and docs point at this path). Subcommands: `scan`, `history`, `stats`, `dashboard`. Logic lives in `scripts/lib/`: `rules.mjs` (rule data + precompiled regexes), `scan.mjs` (scanContent/score/verdict), `store.mjs` (per-project `.anti-slop/` data + `~/.anti-slop/registry.json`; `ANTI_SLOP_REGISTRY_DIR` env override for tests), `dashboard.mjs` + `dashboard.html` (on-demand stats dashboard).

## Model policy (future-proof — do not regress)

- The `slop-detector` agent does not pin a model — its frontmatter reads `model: inherit`, so it always runs on the session model, whichever Claude model the invoking session uses now or in the future.
- Never replace `inherit` with a pinned model name or a dated model ID. If an override is ever truly unavoidable, use an undated alias (`opus`, `sonnet`) and record why here.
- Nothing in this plugin may call out to, or wait on, a specific model.

## Commands

- Test: `cd anti-slop/scripts && npm test` (131 tests, hermetic; no deps, no lint/build step — `npm ci` is unnecessary). Use `npm test`, NOT bare `node --test` — Node's bare runner recursively executes the non-test corpus samples under `test/corpus/` and fails on their deliberate missing imports.
- Measure scanner precision/recall against the labeled corpus: `npm run measure` (report only) — regenerate `test/corpus/baseline.json` per `test/corpus/README.md` after deliberate rule changes.
- CI scan CLI: `node anti-slop/scripts/slop-scanner.mjs scan [--format text|json] [--fail-on any|high|medium|low|none] [--record] [--quiet] <files...>` (exit 0/1/2; no side effects without `--record`).
- Link integrity for the reference library: `npm run check-references` (also gated by `test/references.test.mjs`).
- Dev-run the plugin from a clone: `claude --plugin-dir ./anti-slop` (run from the repo root).

## Rules for this repo

- The scanner's subtle behaviors are deliberate and spec'd by the tests: escape hatch (`anti-slop-allow`/`unslop-ignore`), prose noise-stripping, low-confidence word clustering (count >= 2), design-pattern `suppress`, `skipInTests`, hardcoded-secret precision guards. Never weaken a test to pass.
- Every UI rule declares `confidence` (the four-class enum) and `mode` (presence, or concentration + `minCount`); code rules declare `confidence`. `test/rule-metadata.test.mjs` fails on a rule missing either, and on any drift between `CONFIDENCE` in rules.mjs and its single definition in `references/confidence-and-evidence.md`.
- Design tells run on web extensions only and native tells on Apple extensions only (`WEB_SURFACE_EXTENSIONS` / `NATIVE_UI_EXTENSIONS`). A rule that fires `text-4xl` on Swift or `.frame(width:` on CSS costs more trust than it earns.
- Never widen a rule until its remediation would remove responsive, accessible, or motion-preference behaviour. That defect shipped twice (Strongest-10 entry 9; `important-overuse` on the reduced-motion idiom) and is the reason the corpus carries `responsive-type-clean.html` and `AdaptiveShell.swift` as clean controls.
- Dashboard is optional by design (v1.5.0, preserved through the 2.0.0 MCP removal): nothing may start an HTTP listener except an explicit `slop-scanner.mjs dashboard` call; `.anti-slop/config.json` `{"dashboard": false}` must keep disabling it. The dashboard shows findings stats only — the /50 score belongs to the `scan` output. `lib/dashboard.mjs` and `lib/stats.mjs` are dynamically imported so the `scan` path never loads the HTTP module.
- Version bumps touch 4 spots: SKILL.md frontmatter, both plugin.json files, and marketplace.json. (It was 5 until 2.0.0 removed the MCP Server constructor from slop-scanner.mjs.) `test/dashboard.test.mjs` A9 enforces agreement.
- Dogfood before committing docs: scan edited .md files with the project's own `scanContent` and diff finding counts against the pre-edit baseline (README carries a pre-existing em-dash-density finding at 5 dashes — leave untouched prose alone).
- The corpus is the single owner of its fixtures; ui-craft's `tests/corpus/` is a downstream view. Per-item ownership across the three repos is in `anti-slop/docs/rankings-refresh.md` (Downstream sync). Fixture roles are `positive`, `clean-control`, and `coverage-boundary` (plants a real tell this scanner has no rule for -- never cite one as evidence the tell is absent).
- `store.mjs` captures `process.cwd()` at import time; tests needing a different project dir must spawn a child node process (see the allowedWords test).
- Serena is activated for this repo (memories: project-overview, architecture-and-modules, build-test-release).
