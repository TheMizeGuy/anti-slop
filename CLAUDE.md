# anti-slop

Claude Code plugin that catches agentic-dev shortcomings (security, accessibility, AI-default design, banned vocabulary, regressions). Public repo TheMizeGuy/anti-slop, MIT, version 1.6.0. This clone is the source of truth for development; the LIVE plugin runs from the Claude Code plugin cache — changes here do nothing to the running session until the plugin is updated/reinstalled from the marketplace repo.

## Layout

- `anti-slop/` — the plugin itself: `.mcp.json`, `skills/anti-slop/` (SKILL.md + 10 references), `agents/slop-detector.md`, `commands/slop-check.md`, `scripts/` (MCP server + scanner).
- `.claude-plugin/` at root — marketplace manifests.
- `anti-slop/scripts/slop-scanner.mjs` — MCP entry (never rename; `.mcp.json` points at it). Logic lives in `scripts/lib/`: `rules.mjs` (rule data + precompiled regexes), `scan.mjs` (scanContent/score/verdict), `store.mjs` (per-project `.anti-slop/` data + `~/.anti-slop/registry.json`; `ANTI_SLOP_REGISTRY_DIR` env override for tests), `dashboard.mjs` + `dashboard.html` (on-demand stats dashboard).

## Model policy (future-proof — do not regress)

- The `slop-detector` agent does not pin a model — its frontmatter reads `model: inherit`, so it always runs on the session model, whichever Claude model the invoking session uses now or in the future.
- Never replace `inherit` with a pinned model name or a dated model ID. If an override is ever truly unavoidable, use an undated alias (`opus`, `sonnet`) and record why here.
- Nothing in this plugin may call out to, or wait on, a specific model.

## Commands

- Test: `cd anti-slop/scripts && npm ci && npm test` (76 tests, hermetic; no lint/build step). Use `npm test`, NOT bare `node --test` — Node's bare runner recursively executes the non-test corpus samples under `test/corpus/` and fails on their deliberate missing imports.
- Measure scanner precision/recall against the labeled corpus: `npm run measure` (report only) — regenerate `test/corpus/baseline.json` per `test/corpus/README.md` after deliberate rule changes.
- CI scan CLI: `node anti-slop/scripts/slop-scanner.mjs scan [--format text|json] [--fail-on any|high|medium|low|none] [--record] [--quiet] <files...>` (exit 0/1/2; no side effects without `--record`).
- Dev-run the plugin from a clone: `claude --plugin-dir ./anti-slop` (run from the repo root).

## Rules for this repo

- The scanner's subtle behaviors are deliberate and spec'd by the tests: escape hatch (`anti-slop-allow`/`unslop-ignore`), prose noise-stripping, low-confidence word clustering (count >= 2), design-pattern `suppress`, `skipInTests`, hardcoded-secret precision guards. Never weaken a test to pass.
- Dashboard is optional by design (v1.5.0): nothing may start an HTTP listener except a `get_dashboard_url` tool call; `.anti-slop/config.json` `{"dashboard": false}` must keep disabling it. The dashboard shows findings stats only — the /50 score belongs to MCP tool output.
- Version bumps touch 5 spots: SKILL.md frontmatter, both plugin.json files, marketplace.json, and the MCP Server constructor string in slop-scanner.mjs.
- Dogfood before committing docs: scan edited .md files with the project's own `scanContent` and diff finding counts against the pre-edit baseline (README carries a pre-existing em-dash-density finding at 5 dashes — leave untouched prose alone).
- `store.mjs` captures `process.cwd()` at import time; tests needing a different project dir must spawn a child node process (see the allowedWords test).
- Serena is activated for this repo (memories: project-overview, architecture-and-modules, build-test-release).
