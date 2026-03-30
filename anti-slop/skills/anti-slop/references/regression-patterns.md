# Regression Anti-Patterns

How AI coding tools break working code. The Alibaba SWE-CI benchmark (March 2026) tested 18 AI models across 100 real codebases spanning 233 days each: 75% of models break previously working code during long-term maintenance. CodeRabbit (2025) found AI PRs contain 1.7x more issues, 75% more logic errors, and 8x more performance problems than human PRs.

These rules apply when modifying existing code, fixing bugs, or refactoring. The core principle: **change only what was asked. Preserve everything else.**

## The Cardinal Rules

1. **Read before writing.** Read every file being modified. Read files that import from or are imported by the files being modified. Understand the dependency chain before changing anything.

2. **Change only what was asked.** Do not refactor adjacent code. Do not "clean up" formatting. Do not rename variables for consistency. Do not improve error handling that was not part of the request. The scope of changes should match the scope of the request.

3. **Preserve behavior.** If code works, do not change how it works unless that change was requested. Preserve sort order, error messages, status codes, default values, log formats, metric names, timing values, and conditional logic. Each of these is a behavioral contract that something else may depend on.

4. **Use Edit, not Write.** When modifying existing files, use targeted edits (Edit tool) that send only the diff. Do not rewrite entire files (Write tool) unless creating new files. Full-file rewrites risk omitting code that was not in the AI's immediate focus.

5. **Run tests after every change.** Do not claim a fix is complete without running the test suite. If tests fail, fix the code, not the tests.

## Fix-One-Break-Another

The most common AI regression pattern. The AI fixes Bug A but introduces Bug B because it modified shared code without tracing all dependents.

**Prevention:**
- Before modifying a function, check who calls it (grep for the function name across the codebase)
- Before changing a type, check who uses it
- Before modifying a shared utility, check every import site
- Make the smallest possible change that fixes the issue
- If the fix requires changing a function signature, update ALL callers in the same change

## Deleting "Unused" Code

AI sees a function with no callers in the current file and removes it. But the function is called via reflection, dynamic dispatch, external APIs, event handlers registered elsewhere, or from other repositories.

**Rules:**
- Never delete a function, method, class, or export unless you have verified it has zero references across the entire codebase (not just the current file)
- Never remove an exported function from a module; it may be part of a public API
- Never remove code with `@public`, `@api`, or `@export` annotations
- If a function looks unused but has a docstring or is exported, leave it alone and ask

## Unnecessary Rewrites

AI rewrites working code "for clarity" or "for consistency" during a bug fix. The rewrite introduces subtle behavior changes.

**Rules:**
- Do not refactor code that is not part of the current task
- Do not change variable names, formatting, or code style in files being modified for a bug fix
- Do not convert callbacks to async/await (or vice versa) unless that was the request
- Do not change import styles (require vs import) unless that was the request
- If the AI finds unrelated issues while fixing a bug, note them separately; do not fix them in the same change

## Context Loss and Compaction

AI loses track of earlier decisions as the context window fills. After compaction, rules, constraints, and file states may be lost. Claude Code GitHub issues #9796 and #13919 document this.

**Symptoms:**
- Reverting decisions made earlier in the session
- Re-introducing bugs that were already fixed
- Contradicting its own earlier analysis
- Forgetting CLAUDE.md constraints after compaction
- Generating code inconsistent with patterns established minutes ago

**Prevention:**
- Keep tasks small and focused; start new sessions for new tasks
- Re-state critical constraints after long exchanges
- Use CLAUDE.md for persistent rules rather than in-conversation instructions
- After compaction, re-read relevant files before making changes

## Test Manipulation

AI modifies tests to make them pass instead of fixing the underlying code. This is the most dangerous regression pattern because it creates the illusion of correctness.

**Hard rules:**
- Never modify a test's assertions to match incorrect code behavior
- Never delete or skip a failing test
- Never weaken an assertion (e.g., `toBe(90)` to `toBeDefined()`)
- Never lower coverage thresholds
- Never use `--no-verify` to bypass pre-commit hooks
- Never add `@ts-ignore`, `eslint-disable`, or `# type: ignore` to suppress errors instead of fixing them
- If a test fails, the code is wrong, not the test (unless the test itself is explicitly the thing being changed)

The $47,000 discount code incident: an AI changed `expect(total).toBe(90)` to `expect(total).toBe(0)` to match buggy 100%-off discount logic. The test passed, the bug deployed, and ran for 72 hours.

## Silent Behavioral Regressions

Changes that produce no errors but alter behavior in ways nothing catches until production.

### Error Messages and Status Codes

Monitoring, alerting, and client code depend on exact error strings and HTTP status codes. Changing them breaks those dependencies silently.

- Do not change error message text (monitoring rules match on substrings)
- Do not change error codes or exception types
- Do not change HTTP status codes (404 vs 200 with empty body, 400 vs 422, 201 vs 200)
- Do not change response envelope structure (wrapping/unwrapping `{ data: [...] }`)
- Do not change response field names or casing

### Default Values and Timing

- Do not change numeric defaults (page sizes, timeouts, retry counts, debounce intervals)
- Do not change boolean defaults (feature toggles, display options)
- Do not change fallback values or the nullish coalescing operator (`||` vs `??` have different behavior for `0`, `""`, `false`)
- Do not change animation durations, polling intervals, or cache TTLs
- Do not change rate limit thresholds

### Logging and Metrics

- Do not change log levels (warn to info, error to warn) -- monitoring dashboards depend on these
- Do not change log field names in structured logging -- dashboards query on field names
- Do not change metric names -- Grafana/Prometheus queries depend on exact names
- Do not remove logging statements during refactoring

### Conditional Logic and Feature Flags

- Never remove feature flag conditional branches (the "dead code" may be live for 90% of users in a gradual rollout)
- Never remove environment-conditional code (`NODE_ENV === 'development'`)
- Never remove A/B test logic
- Never remove backwards-compatibility code paths without explicit approval

## API and Type Contract Breaks

AI changes function signatures, type definitions, or API response shapes without updating all consumers.

**Rules:**
- Before changing a function signature, grep for all call sites and update them in the same change
- Before changing a TypeScript interface or type, check all files that reference it
- Before changing an API response shape, check all frontend consumers
- Never add required fields to existing interfaces without providing defaults
- Never remove fields from API responses (they may be consumed by external clients)
- Never change parameter order in functions with positional arguments

## File and Project Integrity

- Never rewrite an entire file when a targeted edit suffices
- Never create duplicate files (check if the functionality already exists before creating new files)
- Never execute destructive git commands (`git reset --hard`, `git clean -f`, `git checkout --` on modified files) without explicit user approval
- Never modify lock files (package-lock.json, yarn.lock) manually
- Never change build configuration (webpack, vite, tsconfig, next.config) unless that was the specific request
- Never modify .env files or expose environment variables in client-side code

## The Blast Radius Principle

Before making any change, estimate its blast radius:

- **Low risk**: change is contained within one function, no callers affected
- **Medium risk**: change affects a function called by other functions in the same file
- **High risk**: change affects an exported function, shared type, or configuration used across multiple files
- **Critical risk**: change affects database schema, API contracts, authentication, or deployment configuration

For high and critical risk changes, verify all dependents before proceeding. If you cannot verify all dependents, flag the risk to the user.

## Self-Check: Regression Prevention

Before completing any code modification:

- [ ] Did I change only what was asked? No unrelated "improvements"?
- [ ] Did I read the files I modified AND their dependents?
- [ ] Are all function callers updated if I changed a signature?
- [ ] Are all type consumers updated if I changed a type definition?
- [ ] Did I preserve error messages, status codes, and response shapes exactly?
- [ ] Did I preserve default values, timeouts, and configuration?
- [ ] Did I preserve logging levels, metric names, and log field names?
- [ ] Did I preserve feature flags and conditional logic I did not intend to change?
- [ ] Did I run the test suite? Do all tests pass?
- [ ] Did I fix the code, not the tests?
- [ ] Did I use Edit (targeted diff) rather than Write (full file rewrite)?
- [ ] Is my change atomic (one concern per change, not mixed)?
