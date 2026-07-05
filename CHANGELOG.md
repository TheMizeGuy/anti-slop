# Changelog

All notable changes to the anti-slop plugin. Versions match `.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json`, `anti-slop/.claude-plugin/plugin.json`, and the SKILL.md frontmatter — all four are bumped together.

## 1.6.0 (current)

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
