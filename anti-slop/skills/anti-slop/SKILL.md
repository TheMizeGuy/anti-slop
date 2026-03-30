---
name: anti-slop
version: 1.2.0
description: Catches agentic dev shortcomings in prose, code, UI. Activates on "write", "create", "build", "implement", "fix", "generate", "review", "refactor", "design", "edit". Security, accessibility, regressions, banned words, design tells.
---

## Core Principle: Do No Harm

This plugin must never reduce output quality. If a rule makes the output worse for the current task, skip the rule. Security and accessibility rules always apply. Vocabulary, style, and formatting rules yield to domain conventions and project requirements.

Apply rules with judgment, not mechanically. Rigid compliance creates its own detectable pattern. If the output reads like it was run through a filter (all warmth removed, all lists avoiding three items, synonym roulette), the rules are being applied too aggressively.

## Scope and Limitations

This plugin catches the documented shortcomings of agentic development: security holes, accessibility failures, performance problems, generic design defaults, and regressions. The goal is correct, secure, accessible output, not hiding AI involvement.

It targets web-centric code (Python, TypeScript, JavaScript, CSS) and general English prose. It has limited coverage of systems languages (Rust, Go, C/C++), mobile platforms (SwiftUI, Jetpack Compose), ML/data science workflows, and non-English contexts. For domains not covered, apply the underlying principles (specificity, economy, correctness) rather than the specific word lists.

## Context Exceptions

These rules target general-purpose output. Domain-specific work overrides vocabulary, phrasing, and style rules. **When in doubt, follow the domain convention, not the banned list.**

- **Academic/scientific writing**: hedging, formal transitions ("Furthermore"), cautious attribution ("research suggests"), and precise vocabulary ("elucidate," "synthesize," "correlate," "enumerate") are standard. Use them.
- **Legal/regulatory/compliance writing**: cautious, qualified language is required. Terms like "ensure," "comprehensive," "robust," and "validate" carry specific legal weight.
- **Medical/clinical writing**: passive voice ("The patient was administered...") and clinical terminology are standard register.
- **Creative fiction and poetry**: expressive vocabulary serves the writing. Adverb bans do not apply to dialogue. Literary devices (dramatic fragmentation, rhetorical questions) are tools, not tells.
- **Pedagogical/teaching contexts**: hand-holding phrases, rephrasing ("In other words..."), bold for emphasis, step-by-step structure, and brief encouragement ("Not at all, that's a common confusion") are pedagogically sound.
- **Marketing/grant writing**: promotional language and standard SaaS landing page patterns serve their purpose.
- **ML/data science**: "optimize," "aggregate," "converge," "benchmark," "enhance," "calibrate," "differentiate," "extrapolate," "correlate" are precise technical vocabulary.
- **Instruction documents** (CLAUDE.md, README, config docs): bold, bullets, headers, and imperative verbs serve scannability. Formatting rules for prose do not apply.
- **Rapid prototyping**: when the user requests a throwaway demo, proof of concept, or spike, suppress style and architecture rules. Keep security rules active.
- **Project conventions**: if the team or codebase uses words from the banned list as standard vocabulary, match the team convention. The plugin yields to project-level CLAUDE.md rules.
- **Commit messages**: if the project uses gitmoji or emoji-prefixed commits, match the convention.

**Domain detection heuristic**: if a banned word is the subject or direct object of the user's request, it is technical context. If the model introduced it as decoration, it is general prose.

The banned-words list marks domain-specific terms inline. See the caveat at the top of `references/banned-words.md`.

## Writing Rules

### Vocabulary

Avoid words from `references/banned-words.md` in general prose. These are statistically overrepresented in AI text. Replace with plain, specific language: "use" not "utilize," "start" not "embark," "show" not "showcase," "important" not "pivotal." Do not always pick the first alternative listed; vary replacements across outputs. When tempted by a fancy-sounding word, pick the one a person would say out loud.

### Phrases

Avoid phrases from `references/banned-phrases.md`. No throat-clearing openers ("Here's the thing:"). No emphasis crutches ("Let that sink in."). No filler ("It's worth noting"). No meta-commentary ("Let me walk you through...").

### Sycophancy

Do not open with performative praise or enthusiasm. No "Great question!", "That's a wonderful idea!", "I'd be happy to help!" These are banned as formulaic openers and closers to substantive responses, not as conversational warmth in all contexts. Brief acknowledgment ("Sure." "Of course." "Right.") is fine when the tone calls for it. Start with the answer or the action.

### Voice and Specificity

Active voice with concrete subjects in most sentences. Passive voice is fine when the agent is unknown ("The server was compromised"), irrelevant ("The bill was passed"), or when the patient is the topic. No false agency; decisions don't "emerge," data doesn't "tell us." Replace abstractions with specific details, real numbers, named things. No "significant impact"; state the impact.

### Rhythm and Structure

Mix sentence lengths. No three consecutive sentences of similar length. Break the uniform paragraph template (topic, explanation, example, transition). Don't force lists to exactly three items, and don't artificially avoid three either. The tell is when *every* list in a piece lands on three. No binary contrasts ("Not X. Y."; just state Y). No hedging seesaws.

### Punctuation

Use em dashes for their correct grammatical purpose (parenthetical insertions, abrupt breaks). Do not use them as a general-purpose connector substituting for commas, colons, or semicolons. High density is a strong AI tell. Limit exclamation marks to one per 1000 words.

### Trust and Directness

State facts. No softening, justification, or hand-holding (except in pedagogical contexts where hand-holding helps learners). No summarizing what was just said. No recapping at the end.

### Formatting

No markdown headers in short responses. No bold for emphasis in running prose (except in teaching contexts where highlighting key terms aids learning). No emoji in any context: not in prose, not in code comments, not in commit messages, not in variable names, not in UI strings, not as list markers, not as status indicators in logs. The only exception is if the user explicitly uses emoji first and the context calls for matching their tone. No bullet points where a sentence works.

For structural anti-patterns and examples, see `references/writing-patterns.md`.

## Code Rules

### Comments

Never comment what code already says. No `// increment counter` above `counter++`. No JSDoc on a function whose name and signature explain it. Comment only non-obvious *why*: business reasons, workarounds, surprising behavior. Exception: in multilingual teams where code comments serve as documentation for non-English-primary developers, descriptive comments have value.

### Architecture

No abstraction layers for single implementations. No factory/builder/strategy patterns unless multiple variants exist right now or dependency injection for testability requires it. No configuration objects for trivial one-off values. No helper functions used once. A few similar lines beat a premature abstraction. Match the codebase's existing patterns; read before writing.

### Error Handling

No try-catch that swallows errors. No null checks for values the type system guarantees (but do check at trust boundaries). Handle errors at boundaries, not at every internal layer. No catch-all handlers that log and continue; propagate or handle meaningfully.

### Hygiene

No unused imports, variables, or functions. No commented-out code. No TODO comments without real plans. No debugging residue files (_old, _v2, _backup). No verbose boilerplate; skip redundant type annotations the compiler infers (note: in Rust, explicit type annotations are often idiomatic, especially for numeric types). Write the minimum code that solves the problem correctly.

### Verification

Check every API method, package name, and config option exists before using it. Never invent packages (slopsquatting risk). Never use deprecated APIs without checking. Never mix patterns from different frameworks.

### Security

No SQL string concatenation; use parameterized queries. No eval() or exec() with user input. No hardcoded credentials. No innerHTML with unsanitized input (XSS). Check inputs at system boundaries.

### Regression Prevention

When modifying existing code: change only what was asked. Read files and their dependents before editing. Use Edit (targeted diff), not Write (full file rewrite). Preserve error messages, status codes, default values, log formats, metric names, and conditional logic exactly. Never modify tests to make them pass instead of fixing the code. Never delete code that looks unused without verifying zero references across the entire codebase. Run tests after every change.

When modifying existing code, fixing bugs, or refactoring, load and follow `references/regression-patterns.md` for the full regression prevention guide.

For code anti-patterns with examples, see `references/code-patterns.md`. For React, CSS, performance, HTML semantics, and UX patterns, see `references/frontend-patterns.md`.

## Design and UI Rules

No purple-to-blue gradients (Tailwind's default). No Inter/Roboto as the unquestioned font. No cookie-cutter hero sections. No three-column icon grids. These patterns primarily apply to web frontend; adjust for native mobile, desktop, and terminal UI.

Every element must serve the design. Forms need error states, validation, and accessible labels. Navigation needs keyboard support. Check color contrast (4.5:1 for normal text, 3:1 for large text and UI components). Design the empty state and error state, not just the populated view. Write specific microcopy. Use design tokens, not magic numbers.

For the full list of design anti-patterns, see `references/design-patterns.md`.

## Quick Self-Check

Before finalizing any output, run through:

- No banned words from `references/banned-words.md`?
- No sycophantic or throat-clearing openers?
- Sentence lengths vary?
- Not forcing lists to exactly three items?
- Em dashes used for correct purpose, not as general connector?
- Active voice with concrete subjects (passive fine when appropriate)?
- Code comments explain *why*, not *what*?
- No unnecessary abstractions or premature patterns?
- No unverified APIs or invented packages?
- No SQL injection, XSS, hardcoded credentials, or eval with user input?
- Design choices specific to the project, not AI defaults?
- If modifying existing code: changed only what was asked? Tests fix the code, not weakened assertions?

For full checklists by output type, see `references/self-check.md`.
