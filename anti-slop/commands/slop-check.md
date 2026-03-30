---
name: slop-check
description: Review output or files for AI slop patterns with scored report.
argument-hint: "[target]"
allowed-tools: Read, Grep, Glob, Agent, Bash(git diff:*), Bash(gh pr:*)
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
2. Use the Agent tool to dispatch to the `slop-detector` agent defined in this plugin. If the Agent tool returns an error or produces no output, inform the user that the full agent review was unavailable and perform the review directly using the rules in the anti-slop skill.
3. Present the scored report to the user
4. Offer to fix the identified issues if the user wants

## Usage Examples

- `/slop-check` (review last output)
- `/slop-check src/components/Header.tsx` (review specific file)
- `/slop-check diff` (review uncommitted changes)
- `/slop-check pr` (review current PR)
