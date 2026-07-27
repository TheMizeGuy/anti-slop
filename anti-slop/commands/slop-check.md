---
name: slop-check
description: Review output, a file, the working diff, or the current PR for AI slop patterns; reports a deterministic scan score and an agent review score with per-finding fixes.
argument-hint: "[target]"
allowed-tools: Read, Grep, Glob, Agent, Bash(git diff:*), Bash(gh pr:*), Bash(node:*)
---

# Slop Check

Review content for AI coding shortcomings and produce a scored report.

## Context

- Current branch: !`git branch --show-current 2>/dev/null || echo "not a git repo"`

## What to Review

Determine the target from $ARGUMENTS:
- If a file path is provided, review that file
- If "last response" or similar, review the most recent output
- If "diff" or "changes", run `git diff` and review unstaged changes
- If "pr" or "pull request", run `gh pr diff` for the current branch's PR
- If no target specified, review the most recent long output
- If the target does not match any of these, inform the user and list the valid options

If the diff or PR is empty, inform the user that no changes were found.

## Process

1. Identify the content to review
2. If a file path is provided, first run the scanner for a fast deterministic check (banned words, text constructs, design tells, code patterns, security issues):

   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/slop-scanner.mjs" scan <file...>
   ```

   It needs no install: the scanner has zero runtime dependencies. It exits 0 when clean, 1 on findings, 2 on a usage error, and takes `--format json` for machine output and `--record` to log findings for `history` and `stats`. The scanner catches surface tells and honors the `anti-slop-allow` / `unslop-ignore` escape hatch; it cannot see the structural tells (sentence rhythm, sycophancy, tutorial-shaped or over-engineered code, hallucinated APIs). Then dispatch to the `slop-detector` agent for that semantic review. For code, verify first -- a build or type-check catches hallucinated APIs that no scanner will.
3. For non-file targets (a diff, a PR, the last response), or if the scanner cannot be run, dispatch directly to the `slop-detector` agent.
4. If the Agent tool also fails, perform the review directly using the rules in the anti-slop skill.
5. Present the scored report to the user: the scanner's score (deterministic, `Scan score: N/50`) and the agent's review score (5-dimension judgment, `Review score: N/50`) are different scales measuring different things -- include both, labeled
6. Offer to fix the identified issues if the user wants
7. The dashboard is optional and off by default. Offer it only if the user asks or it's contextually useful; it is the one command that opens a port, and `.anti-slop/config.json` `{"dashboard": false}` disables it:

   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/slop-scanner.mjs" dashboard
   ```

## Usage Examples

- `/slop-check` (review last output)
- `/slop-check src/components/Header.tsx` (review specific file)
- `/slop-check diff` (review uncommitted changes)
- `/slop-check pr` (review current PR)
