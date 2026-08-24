# Changelog

All notable changes to the anti-slop plugin. Versions match `.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json`, `anti-slop/.claude-plugin/plugin.json`, and the SKILL.md frontmatter — all four are bumped together. (It was five until 2.0.0 removed the MCP Server constructor.)

## 2.2.0 - 2026-08-24

Design-tell additions adapted from [VibeCurb](https://github.com/Yu-369/VibeCurb)
(MIT, Copyright (c) 2026 Yu-369), deduplicated against the existing catalogue and
graded to this repo's confidence classes (heuristic provenance, not corpus-ranked,
so everything lands as Pattern smell or agent judgment).

New scanner rule: `bootstrap-default-blue` -- Bootstrap 5's compiled literals
(`#0d6efd`, `#0b5ed7`, `#dee2e6`) as a concentration rule from two occurrences,
the Bootstrap twin of `ai-purple-hex`. `generic-microcopy` gains the
"Scroll to explore" hero literal. Both carry bidirectional tests; corpus
precision holds at 100% with no new misses.

New catalogue entries in `design-patterns.md`: the Bootstrap Fingerprint
(incl. zebra-striped tables), scroll indicators in the hero, cards-inside-cards
nesting, the unchosen-easing / scale(0)-entrance motion defaults (deliberately
scanner-less -- keyword easings are ubiquitous in human CSS), and a new
Logo and Brand Mark Tells section (brain-neuron marks, globe-swoosh,
shield-wings, chrome 3D, gradient-dependent marks) with reduction-based
remediation (3-primitive cap, favicon test, one-sentence geometry, inversion
test). Scanner-coverage and concentration-threshold tables updated to match.

## 2.1.1 - 2026-08-24

`dead-branch` now matches Python's colon forms (`if False:`, `elif True:`,
`while False:`) alongside the parenthesised shapes it shipped with. `while True:`
stays excluded as the idiomatic event loop, and `if item is True:` still does not
match. The 2.1.0 rule was JS/TS-shaped only, a scoping recorded at release and closed
here on request. One corpus fixture gains the Python dead branch, the clean control
gains a `while True:` near-miss loop, and the reference entry documents both shapes.

## 2.1.0 - 2026-08-23

The largest detection expansion since 1.4.0, driven by a five-way audit of the whole
plugin (scanner engine, corpus and tests, instruction surface, docs and packaging, and
current-source research on 2026-era tells). Thirty rules are new, seven existing rules
were broken by realistic one-line inputs and are fixed, and the plugin's own reference
library now scans clean under its own scanner.

**Scanner: 30 new rules.** The tables grow from 49 to 79 distinct rules.

- *Design (14, web surfaces):* fixed pixel page shells and grid tracks, `100vh` app
  shells, spacing values that bypass the file's own token scale, repeated literal radii
  with no stated radius identity, dead controls (empty or TODO-only handlers),
  `outline: none` with no `:focus-visible` replacement, missing or generic `alt` text,
  the tracked-out uppercase overline, decorative blur blobs, the shadcn stats-row
  example figures shipping as content, generic microcopy, `transition-all`, and uniform
  section padding.
- *Code (13):* `dangerouslySetInnerHTML` without sanitization, `shell=True` command
  injection, unsafe deserialization (`pickle.loads` / bare `yaml.load`), Tailwind
  dynamic class construction, suppression comments (`@ts-ignore` / `eslint-disable`;
  `@ts-expect-error` deliberately exempt), deprecated APIs, dead branches
  (`if (true)` / `if (false)`), `forEach(async ...)`, `catch (e: any)`, leaked model
  tooling tokens (`oaicite`, `turn0search`, `[cite: N]` and kin — also active on
  prose), and the comment-slop family: banner, apologetic, and deferral/hedging
  comments.
- *Native (2, Apple surfaces):* `.font(.system(size:))` without `relativeTo:` or
  `@ScaledMetric` (Dynamic Type stops scaling), and `DispatchQueue.main.async` piled up
  as a blanket concurrency fix.
- *Prose (1):* the 2026 plain-word register, matched as collocations only
  (`quietly building`, `decisions compound`, `earn the right to`) — the bare words
  stay unbannable by design, and a test enforces that.
- *Updated:* the cream-serif tell gains its drifted warm accent leg (rusty orange and
  terracotta alongside sage), `generic-font` covers the current default set (Space
  Grotesk, Manrope, Plus Jakarta Sans, Outfit, DM Sans), the antithesis rule catches
  the "it's not about X, it's Y" reframe, and `z-index-escalation` sees the JS object
  form (`zIndex: 9999`).

**Fixed: seven rules that failed on realistic input.**

- `.html`, `.htm`, `.vue`, `.svelte`, and `.astro` files now run the code rules too.
  Previously a `<script>` block containing `eval()`, an `innerHTML` assignment, and a
  hardcoded key scanned clean on the most common surface for each.
- The escape hatch (`anti-slop-allow` / `unslop-ignore`) now works for banned phrases
  in code files. It silently did not.
- Context exceptions are word-anchored. The substring test had quietly disabled five
  banned words in almost any real file ("port" inside "important" disabled
  `ephemeral`).
- `hardcoded-secret` requires a secret-shaped value, so i18n strings
  (`password: "Please enter your password"`), lexer token kinds, and validation
  messages stop firing at high severity.
- Three class-fingerprint rules matched only one utility-class order and were silent on
  the exact canonical strings the reference catalog documents. They now match the
  tokens unordered, scoped to a single class attribute.
- The emoji ranges cover arrows, media controls, and geometric shapes (U+2190-21FF,
  U+2300-23FF, U+25A0-25FF) — the pause/play glyph family previously slipped through
  bare. Severity escalates above five emoji, and a prose file that discusses emoji is
  no longer flagged for its own examples.
- `listicle-scaffold`, `hr-divider`, `narrating-comment`, and `boilerplate-marker` are
  narrowed: "the migration runs in 3 steps", Markdown setext underlines, runbook
  `# Step 1:` comments, and RFC-2606 `example.com` in real config no longer fire.

**Engine.** Rules can declare file-scope guards (`requires` / `unless`), a numeric
`count` predicate joins `pattern` for rules whose test is arithmetic, and concentration
thresholds now apply on every table. `--record` batches to one write per invocation
(about 7x faster on large runs) and stores one aggregate score row per scan instead of
evicting its own results; `history` and `stats` no longer create an empty `.anti-slop/`
directory just by being asked.

**Verification.** The suite grows from 131 to 302 tests: a per-rule corpus regression
gate (a rule regression can no longer hide inside aggregate precision), a dedicated
false-positive suite, store and CLI coverage, a cross-module drift check, and a dogfood
snapshot gate that scans every shipped markdown file and pins the finding counts — it
caught a real defect in the dashboard's own stylesheet on its first run. The corpus
grows from 48 to 66 fixtures, including the first raw-CSS fixtures and near-miss clean
controls for every narrowed rule. Corpus accuracy: precision 100.0%, recall 99.1%.

**Instruction surface.** SKILL.md finally routes to the plugin's own executable: a
"How to run this" section states when to self-check inline, when to run the scanner,
and when to dispatch the `slop-detector` agent. The agent locates its reference library
by discovery instead of unresolvable relative paths, its findings carry an explicit
Severity alongside the confidence class, and dimensions its evidence cannot reach are
reported `NOT ASSESSED` instead of forcing a number. `/slop-check` runs the
deterministic scan on `diff` and `pr` targets via `git diff --name-only | xargs`. A
coverage matrix in `references/empirical-rankings.md` states, per tell family, whether
a scanner rule exists, whether the agent can reach it, and what needs a runtime or a
build — and `references/confidence-and-evidence.md` names the families that remain
judgment-only.

**Docs and packaging.** An internal maintainer work order is no longer shipped in the
plugin, the README's worked example and agent dimension names match the code, research
claims carry links only where the source was verified, the dev-install command points
at the actual plugin directory, and SECURITY.md and CONTRIBUTING.md exist. Both
`plugin.json` files are byte-identical and version parity remains four spots.

## 2.0.0 - 2026-07-27

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

## 1.7.0 - 2026-07-27

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

## 1.6.0 - 2026-07-03

- CI-facing scan CLI: `node scripts/slop-scanner.mjs scan [options] <file...>` for pre-commit hooks and CI gates that don't speak MCP, with `--format`, `--fail-on`, `--record`, and `--quiet` flags.
- Split score naming: `Scan score: N/50` (deterministic, from `scan_file` or the CLI) and `Review score: N/50` (the `slop-detector` agent's 5-dimension judgment) are now always labeled separately so neither is mistaken for the other.
- Suppressed-finding capture and the `get_rule_stats` MCP tool: per-rule counts of findings that fired live versus were deliberately suppressed (escape hatch or `allowedWords`), with worst severity and last-seen timestamp.
- Labeled corpus and precision/recall measurement harness (`npm run measure`) with a committed baseline for tracking scanner accuracy across rule changes.
- Model policy: the `slop-detector` agent no longer pins a model. Its frontmatter reads `model: inherit`, so it always runs on the session's active Claude model, present or future.
- Docs refresh: corrected the reference-file count (10, not 8), added a worked walkthrough and a troubleshooting table to the README, and added this changelog.

## 1.5.0 - 2026-07-03

- The web dashboard became optional and on-demand: nothing starts an HTTP listener except an explicit `get_dashboard_url` call, and `.anti-slop/config.json` `{ "dashboard": false }` disables it entirely.
- Dashboard scope narrowed to findings statistics only (scan counts, severity breakdown, findings by rule, findings per scan, recent findings) — the earlier score-centric view was dropped.
- `slop-scanner.mjs` split into `scripts/lib/` modules (`rules.mjs`, `scan.mjs`, `store.mjs`, `dashboard.mjs`, `stats.mjs`, `cli.mjs`) with no behavior change.

## 1.4.x - 2026-06-22

- 1.4.1: cut hardcoded-secret false positives in the scanner.
- 1.4.0: integrated an empirical AI-tells dataset and expanded scanner coverage.
- 1.4.0 also dropped the prompt-based hooks that 1.2.0 introduced (commit `3011c54`): a hook was the wrong enforcement mechanism for judgment-shaped rules. The domain exceptions stayed, the `hooks/` directory went, and no release since has shipped one.
- There is no 1.3.0 entry below because 1.3.0 was never released; the number was skipped.

## 1.2.0 - 2026-03-30

- Context-aware hooks and expanded domain exceptions — the plugin now yields to academic, legal, medical, ML, and other domain conventions instead of flagging their standard vocabulary. (The hooks were removed before the next release; see 1.4.x.)

## 1.1.0 - 2026-03-30

- Plugin optimization pass informed by best-practices research on Claude Code plugin structure.

## 1.0.0 - 2026-03-30

- First stable release: the `anti-slop` skill, the `slop-detector` agent, the `/slop-check` command, the MCP scanner with web dashboard, and the banned-words/banned-phrases/pattern reference catalogs.

## 0.9.0 - 2026-03-30

- Initial release.
