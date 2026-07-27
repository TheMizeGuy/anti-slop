# Changelog

All notable changes to the anti-slop plugin. Versions match `.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json`, `anti-slop/.claude-plugin/plugin.json`, and the SKILL.md frontmatter — all four are bumped together. (It was five until 2.0.0 removed the MCP Server constructor.)

## 2.0.0 (current)

**Breaking: the MCP server is gone.** The plugin no longer registers
`anti-slop-scanner`, ships no `.mcp.json`, and exposes no MCP tools. Anything calling
`scan_file`, `get_dashboard_url`, `get_score_history`, or `get_rule_stats` must move to the
CLI, which does the same work without a resident server, an SDK, or a tool round-trip.

The protocol was buying nothing. Every tool was a thin wrapper over a synchronous function,
delivered through a stdio server that had to be running, discovered, and kept alive to
return output a subprocess hands back directly. It also made the scanner unusable outside
Claude Code without reimplementing the transport.

No capability was dropped. All four tools have a subcommand:

| Was | Now |
|---|---|
| `scan_file` | `slop-scanner.mjs scan [options] <file...>` |
| `get_score_history` | `slop-scanner.mjs history` |
| `get_rule_stats` | `slop-scanner.mjs stats` |
| `get_dashboard_url` | `slop-scanner.mjs dashboard` |

- **Zero runtime dependencies.** `@modelcontextprotocol/sdk` was the only one, and the
  lockfile is now empty of packages. The scanner runs from a fresh clone or an installed
  plugin with no `npm install`, which also means a CI gate cannot silently skip it because
  a dependency failed to resolve.
- The v1.5.0 dashboard invariant survives intact: nothing opens an HTTP listener except an
  explicit `dashboard` command, and `.anti-slop/config.json` `{"dashboard": false}` still
  disables it. `lib/dashboard.mjs` and `lib/stats.mjs` are now dynamically imported so the
  `scan` path never loads the HTTP module at all.
- Zero-argument invocation used to start the stdio server and block; it now prints usage
  and exits 2.
- `/slop-check` calls the scanner via `Bash(node:*)` instead of an MCP tool, and falls back
  to the agent when it cannot.
- Version parity is now four spots, not five. `test/dashboard.test.mjs` A9 enforces it.
- 11 new tests assert the removal is real rather than dormant: no `.mcp.json`, no SDK
  import anywhere, no MCP identifier left in the entry point, and no subcommand except
  `dashboard` opening a port. Suite is 131 tests.

## 1.7.0

Integrates the anti-AI work from the `ui-craft` 0.3.0 and `apple-ui-craft` 0.3.1 releases.
Both are downstream of this plugin's UI research, and both produced material that flows
back, including a correction to a rule this plugin shipped.

**Fixed: a rule that told people to delete responsive typography.** Strongest-10 entry 9
flagged any responsive type scale, with no remediation. A designer or agent clearing that
finding removes fluid type scaling, which makes the page worse and fails WCAG 1.4.4 Resize
Text. It is now the *verbatim* Tailwind default run, graded as a genericness signal, with a
`clamp()` remediation attached. Two corpus fixtures pin both directions.

**Fixed: `!important` overuse fired on the reduced-motion idiom.** `* { transition: none
!important }` inside a `prefers-reduced-motion` block is the correct WCAG 2.3.3
implementation, and the rule was reporting it on three clean controls. Its only available
"fix" was an accessibility regression. Now suppressed, and the rule fires at two or more
matches, since it is named *overuse*.

- **Confidence classes.** Every finding carries one of Hard defect, Quality defect, Pattern
  smell, or Taste note, in both the scanner's JSON output and the `slop-detector` report.
  Independent of severity: a possible hardcoded credential is severity high and confidence
  Pattern smell, because a regex cannot prove the string is live. Defined once, in
  `references/confidence-and-evidence.md`, with a test that fails on drift between the
  doctrine and the code.
- **Presence versus concentration.** Design and native tells declare which they are, and
  concentration tells carry a numeric threshold instead of firing on the first match:
  `rounded-everything` at 3, `cream-serif-default` / `ai-purple-hex` / `ai-purple-class` /
  `important-overuse` at 2. The floor rule -- a lone utility-class hit is not a finding --
  is now enforced rather than advisory.
- **Native UI rule set** (`references/native-ui-patterns.md`) with five SwiftUI tells:
  `UIScreen.main.bounds`, fixed content frames, device-idiom branching, fixed grid columns,
  and ungated repeating symbol effects. Design tells now run on web extensions only and
  native tells on Apple extensions only; previously every code extension was matched against
  Tailwind vocabulary.
- **Density and economy** (`references/density-and-economy.md`): the first rule against
  WASTE rather than excess, with thresholds for viewport utilisation, internal distribution,
  page economy, copy economy, and action placement. Waste without a measurement is a taste
  note; with one it is MEDIUM or HIGH.
- **Evidence discipline.** The detector states its evidence mode and coverage on the first
  line of its report, needs real geometry for any spatial or numeric claim (a screenshot is
  never geometry evidence), and reports NOT ASSESSED rather than clean for anything the
  evidence could not reach.
- **One corpus, 48 fixtures.** Absorbed ten fixtures authored in ui-craft, added a `native`
  modality and three new design fixtures. Labels now carry severity, confidence, and a role:
  `positive`, `clean-control`, or `coverage-boundary` (a real tell this scanner has no rule
  for, recorded rather than implied). anti-slop owns the corpus; ui-craft's is a downstream
  view. Per-item ownership across the three repos is in `docs/rankings-refresh.md`.
- **Two new gates.** `check-references.mjs` verifies every reference citation resolves to a
  real file and heading and warns on orphans; `corpus-contract.test.mjs` enforces the
  clean-control tolerances, catches label grading drift, and tests the scorer's own
  arithmetic. Suite is 123 tests, up from 76.
- Corpus accuracy moved **precision 95.4% -> 100.0%** and **recall 98.4% -> 98.6%**. The
  precision gain is the three reduced-motion false positives; recall rose despite dropping
  two `rounded-everything` labels that the floor rule shows were never correct.

## 1.6.0

- CI-facing scan CLI: `node scripts/slop-scanner.mjs scan [options] <file...>` for pre-commit hooks and CI gates that don't speak MCP, with `--format`, `--fail-on`, `--record`, and `--quiet` flags.
- Split score naming: `Scan score: N/50` (deterministic, from `scan_file` or the CLI) and `Review score: N/50` (the `slop-detector` agent's 5-dimension judgment) are now always labeled separately so neither is mistaken for the other.
- Suppressed-finding capture and the `get_rule_stats` MCP tool: per-rule counts of findings that fired live versus were deliberately suppressed (escape hatch or `allowedWords`), with worst severity and last-seen timestamp.
- Labeled corpus and precision/recall measurement harness (`npm run measure`) with a committed baseline for tracking scanner accuracy across rule changes.
- Model policy: the `slop-detector` agent no longer pins a model. Its frontmatter reads `model: inherit`, so it always runs on the session's active Claude model, present or future.
- Docs refresh: corrected the reference-file count (10, not 8), added a worked walkthrough and a troubleshooting table to the README, and added this changelog.

## 1.5.0

- The web dashboard became optional and on-demand: nothing starts an HTTP listener except an explicit `get_dashboard_url` call, and `.anti-slop/config.json` `{ "dashboard": false }` disables it entirely.
- Dashboard scope narrowed to findings statistics only (scan counts, severity breakdown, findings by rule, findings per scan, recent findings) — the earlier score-centric view was dropped.
- `slop-scanner.mjs` split into `scripts/lib/` modules (`rules.mjs`, `scan.mjs`, `store.mjs`, `dashboard.mjs`, `stats.mjs`, `cli.mjs`) with no behavior change.

## 1.4.x

- 1.4.1: cut hardcoded-secret false positives in the scanner.
- 1.4.0: integrated an empirical AI-tells dataset and expanded scanner coverage.

## 1.2.0

- Context-aware hooks and expanded domain exceptions — the plugin now yields to academic, legal, medical, ML, and other domain conventions instead of flagging their standard vocabulary.

## 1.1.0

- Plugin optimization pass informed by best-practices research on Claude Code plugin structure.

## 1.0.0

- First stable release: the `anti-slop` skill, the `slop-detector` agent, the `/slop-check` command, the MCP scanner with web dashboard, and the banned-words/banned-phrases/pattern reference catalogs.

## 0.9.0

- Initial release.
