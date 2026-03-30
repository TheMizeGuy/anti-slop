# anti-slop

A Claude Code plugin that catches and blocks detectable AI patterns in prose, code, and UI output. Survived 30 adversarial reviews across 3 review cycles with zero remaining issues.

## What it does

AI-generated content has tells: overused vocabulary ("delve," "pivotal," "landscape"), structural cliches (rule of three, binary contrasts, sycophantic openers), code anti-patterns (obvious comments, premature abstractions, swallowed errors), and design defaults (purple gradients, Inter font, three-column icon grids).

This plugin loads rules that prevent these patterns during content generation. It covers writing, code, and frontend design.

## What's included

| Component | Description |
|-----------|-------------|
| **Skill** (`anti-slop`) | Core rules that activate on content-producing tasks |
| **Agent** (`slop-detector`) | Deep review agent with 5-dimension scoring (50pt scale) |
| **Command** (`/slop-check`) | Manual review of files, diffs, or recent output |
| **7 reference files** | Banned words (~230), banned phrases (~170), writing patterns, code patterns, design patterns, frontend patterns (React/CSS/perf/HTML/UX), self-check checklists |

## Coverage

**Writing:** ~230 banned AI-tell words with plain alternatives, ~170 banned phrases (sycophancy, throat-clearing, filler, meta-commentary, emphasis crutches), structural anti-patterns (rule of three, binary contrasts, hedging seesaws, dramatic fragmentation), formatting rules, rhythm checks.

**Code:** Comment slop (restating code, apologetic comments, banner dividers), over-engineering (factories for single implementations, premature abstractions), error handling (swallowing errors, defensive excess), security (SQL injection, XSS, path traversal, command injection, hardcoded credentials, eval, insecure randomness, sensitive data in logs), verification (hallucinated APIs, slopsquatting, deprecated methods), backend patterns (N+1 queries, missing timeouts, naive retries, unbounded queries), and "looks right but isn't" patterns (shallow copy bugs, floating-point money, date/time errors, async race conditions).

**Design/UI:** The generic AI aesthetic (purple gradients, Inter/Roboto defaults, three-column icon grids, glassmorphism abuse), CSS anti-patterns (magic numbers, !important, excessive nesting), accessibility (WCAG contrast ratios, focus management, aria-live, semantic HTML, heading hierarchy, prefers-reduced-motion, forced-colors, skip navigation, form accessibility), missing states (empty, error, loading), and generic microcopy.

## Context awareness

The plugin includes domain exceptions for academic writing, legal writing, creative fiction, pedagogical/teaching contexts, marketing, ML/data science, and grant writing. Technical terms (validate, aggregate, benchmark, optimize, framework, ecosystem) are allowed in their domain contexts. British English and formal registers are acknowledged.

A "Scope and Limitations" section in SKILL.md states what the plugin covers (web-centric code, general English prose) and what it doesn't (Rust, Go, C/C++, mobile platforms, ML workflows in depth).

## Installation

### From GitHub (recommended)

```bash
# In Claude Code, run:
/plugin marketplace add https://github.com/TheMizeGuy/anti-slop

# Then install:
/plugin install anti-slop@anti-slop
```

### For development/testing

```bash
claude --plugin-dir /path/to/anti-slop
```

## Usage

The skill activates automatically on content-producing tasks (writing, coding, design). For manual review:

```
/slop-check                              # review last output
/slop-check src/components/Header.tsx    # review specific file
/slop-check diff                         # review uncommitted changes
/slop-check pr                           # review current PR
```

## How it was built

1. Extensive research across 15+ sources (Wikipedia's "Signs of AI writing" catalog, GitHub anti-slop projects, GitClear code quality research, academic sycophancy studies, community word lists, OWASP guidelines, WCAG 2.2)
2. Plugin built with progressive disclosure (lean SKILL.md, detailed reference files)
3. 10 adversarial Opus 4.6 reviewers (linguist, security engineer, DX architect, pragmatist, accessibility expert, consistency auditor, frontend engineer, contrarian, backend architect, self-violation hunter) found ~185 issues, all resolved
4. 20 additional adversarial reviewers (Python expert, TS/JS expert, technical writer, information architect, prompt engineer, cognitive scientist, sociolinguist, QA engineer, devil's advocate, copy editor, game theorist, Rust/Go programmer, data scientist, mobile dev, pedagogy expert, open source maintainer, philosopher of language, adversarial ML researcher, self-violation hunter extreme, integration tester) - all 20 passed final review

## Philosophy

This is a heuristic guide, not a detection system. It reduces common AI tells but cannot make output undetectable. Word-level bans address symptoms; the deeper fix is writing with genuine specificity and voice. Rigid compliance with every rule creates its own recognizable pattern. The goal is natural variation, not a checklist.

## License

MIT
