# anti-slop

A Claude Code plugin that raises the quality bar for AI-assisted development. It catches the shortcuts, defaults, and blind spots that agentic coding tools produce when left unchecked.

**This is not about hiding that AI wrote something.** It's about fixing the real shortcomings of agentic development: the security holes AI introduces, the accessibility it ignores, the performance it tanks, the abstractions it invents for no reason, and the purple-gradient-Inter-font sameness it defaults to on every project.

AI coding tools produce working code fast. They also produce N+1 queries, swallowed errors, hardcoded secrets, inaccessible forms, 70KB lodash imports, `useEffect` for derived state, and hero sections that all look identical. This plugin catches those problems before they ship.

## What it does

The plugin loads rules during content generation that target documented AI failure patterns across three domains:

- **Writing**: vocabulary tells, structural cliches, sycophantic openers, filler phrases
- **Code**: security vulnerabilities, architectural over-engineering, comment slop, missing error handling, performance anti-patterns, backend mistakes
- **Frontend/Design**: the generic AI aesthetic, CSS bugs, React anti-patterns, accessibility failures, missing states, demo-ware

## What's included

| Component | Description |
|-----------|-------------|
| **Skill** (`anti-slop`) | Core rules that activate on content-producing tasks |
| **Agent** (`slop-detector`) | Deep review agent with 5-dimension scoring (50pt scale) |
| **Command** (`/slop-check`) | Manual review of files, diffs, or recent output |
| **7 reference files** | Banned words (~230), banned phrases (~170), writing patterns, code patterns, design patterns, frontend patterns (React/CSS/perf/HTML/UX), self-check checklists |

## Why this exists

Agentic coding tools have specific, documented failure modes:

- **Security**: AI-generated code has 2.74x more security vulnerabilities than human-written code (CodeRabbit 2024). 100% of tested vibe-coded apps lacked CSRF protection (Escape.tech).
- **Accessibility**: 70-80% of AI-generated UI fails WCAG AA without explicit instructions (University of Michigan 2025). AI code has 3-5x more accessibility violations per page than hand-authored code (Deque 2024).
- **Performance**: 86% of frontend repos have at least one missing cleanup pattern. AI imports full libraries (lodash at 70KB) when 2KB cherry-picked imports exist. Barrel file re-exports bloated one project from 200KB to 1.5MB.
- **Architecture**: AI generates premature abstractions, factories for single implementations, and monolithic 500-line components. Refactoring dropped from 25% of changed lines to under 10% in AI-assisted codebases (GitClear 2024).
- **Design**: Every AI tool defaults to the same purple gradient, Inter font, three-column icon grid aesthetic. Adam Wathan (Tailwind creator) apologized for making `bg-indigo-500` the demo default that trained every AI on the internet.
- **Code quality**: AI-generated PRs contain 1.7x more issues, 75% more logic errors, and 3x worse readability than human-written PRs (CodeRabbit 2024).

This plugin targets those specific problems. It does not try to make AI output "sound human" or hide its origin. It tries to make AI output correct, secure, accessible, and distinct.

## Coverage

**Writing:** ~230 banned AI-tell words with plain alternatives, ~170 banned phrases (sycophancy, throat-clearing, filler, meta-commentary, emphasis crutches), structural anti-patterns (rule of three, binary contrasts, hedging seesaws, dramatic fragmentation), formatting rules, rhythm checks.

**Code:** Comment slop (restating code, apologetic comments, banner dividers), over-engineering (factories for single implementations, premature abstractions), error handling (swallowing errors, defensive excess), security (SQL injection, XSS, path traversal, command injection, hardcoded credentials, eval, insecure randomness, sensitive data in logs), verification (hallucinated APIs, slopsquatting, deprecated methods), backend patterns (N+1 queries, missing timeouts, naive retries, unbounded queries), and "looks right but isn't" patterns (shallow copy bugs, floating-point money, date/time errors, async race conditions).

**Frontend:** React anti-patterns (useEffect misuse, missing cleanup, "use client" overuse, hydration mismatches, stale closures), CSS pitfalls (z-index stacking contexts, sticky/fixed positioning, Tailwind dynamic classes, animation performance, font loading, dark mode, modern CSS features), performance (full library imports, image optimization, code splitting, render-blocking resources), HTML semantics (div soup, link vs button, heading hierarchy, native elements), and UX (happy path only, demo-ware, modal overuse, search debouncing, form state, toast accessibility).

**Design/UI:** The generic AI aesthetic (purple gradients, Inter/Roboto defaults, three-column icon grids, glassmorphism abuse), CSS anti-patterns (magic numbers, !important, excessive nesting), accessibility (WCAG contrast ratios, focus management, aria-live, semantic HTML, heading hierarchy, prefers-reduced-motion, forced-colors, skip navigation, form accessibility), missing states (empty, error, loading), and generic microcopy.

## Context awareness

The plugin includes domain exceptions for academic writing, legal writing, creative fiction, pedagogical/teaching contexts, marketing, ML/data science, and grant writing. Technical terms (validate, aggregate, benchmark, optimize, framework, ecosystem) are allowed in their domain contexts. British English and formal registers are acknowledged.

A "Scope and Limitations" section in SKILL.md states what the plugin covers (web-centric code, general English prose) and what it doesn't (Rust, Go, C/C++, mobile platforms, ML workflows in depth).

## Installation

### From GitHub

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

1. Research across 100+ sources (Wikipedia's "Signs of AI writing" catalog, GitHub anti-slop projects, GitClear/CodeRabbit/CMU/METR code quality studies, academic sycophancy research, OWASP guidelines, WCAG 2.2, developer community discussions, AI web builder failure analyses)
2. 10 parallel research agents covering CSS/layout, React/components, accessibility, visual design, UX/interaction, performance, HTML semantics, Claude-specific patterns, AI builder failures, and design systems
3. Plugin built with progressive disclosure (lean SKILL.md, detailed reference files)
4. 50+ adversarial review perspectives across 4 review cycles, including specialists in Python, TypeScript, CSS, accessibility, security, backend architecture, information architecture, prompt engineering, game theory, sociolinguistics, epistemology, and adversarial ML
5. CodeRabbit code review on the final plugin

## Philosophy

This plugin does not try to make AI output undetectable. It tries to make it good.

AI coding tools have real, measurable shortcomings. They produce insecure code, inaccessible interfaces, bloated bundles, and generic designs. The goal of this plugin is to catch those failures during generation, not to disguise their origin.

Rigid compliance with every rule creates its own detectable pattern. The plugin tells Claude to apply rules with judgment, not mechanically. Domain exceptions exist for academic, legal, creative, and pedagogical contexts. The goal is quality output, not checklist compliance.

## License

MIT
