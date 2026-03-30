# Regression Anti-Patterns

How AI coding tools break working code. The CodeRabbit State of AI vs. Human Code Generation Report (December 2025, 470 GitHub PRs) found AI PRs contain 1.7x more issues, 75% more logic errors, and 8x more performance problems than human PRs. Multiple benchmarks confirm that AI models routinely introduce regressions during long-term code maintenance.

These rules apply when modifying existing code, fixing bugs, or refactoring. The core principle: **change only what was asked. Preserve everything else.**

## The Cardinal Rules

1. **Read before writing.** Read every file being modified. Read files that import from or are imported by the files being modified. Understand the dependency chain before changing anything.

2. **Change only what was asked.** Do not refactor adjacent code. Do not "clean up" formatting. Do not rename variables for consistency. The scope of changes should match the scope of the request. Exception: if a security vulnerability or correctness bug is discovered during the fix and interacts with the change, flag it to the user and fix it together. This rule targets cosmetic drive-bys, not ignoring real defects.

3. **Preserve behavior.** If code works, do not change how it works unless that change was requested. Preserve sort order, default values, log formats, metric names, timing values, and conditional logic. Each of these is a behavioral contract that something else may depend on. For error messages and status codes: preserve internal/monitoring messages exactly; but if an error message leaks internal details (stack traces, hostnames, credentials) to external callers, sanitizing it is a security fix, not a behavioral regression.

4. **Use targeted edits.** When modifying existing files, apply targeted changes (diffs) rather than rewriting entire files. Full-file rewrites risk omitting code outside the AI's immediate focus. In Claude Code, prefer the Edit tool over the Write tool.

5. **Run tests after every change.** Do not claim a fix is complete without running the test suite. If tests fail, investigate whether the code or the test is wrong. The default assumption is that the code is wrong. But if the test asserts on a spec that changed, has a bug in its setup, or is over-specified on implementation details, fix the test and document why.

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
- Do not delete a function, method, class, or export unless you have verified it has zero references across the entire codebase (not just the current file), or the user explicitly approves the removal
- For true public APIs (published packages, REST endpoints), the bar is higher: deprecation before removal
- If a function looks unused but has a docstring or is exported, leave it alone and ask

## Unnecessary Rewrites

AI rewrites working code "for clarity" or "for consistency" during a bug fix. The rewrite introduces subtle behavior changes.

**Rules:**
- Do not refactor code that is not part of the current task (when the task IS a refactor, the scope of allowed changes expands to match the request)
- Do not change variable names, formatting, or code style in files being modified for a bug fix
- Do not convert callbacks to async/await (or vice versa) unless that was the request
- Do not change import styles (require vs import) unless that was the request
- If the AI finds unrelated issues while fixing a bug, note them separately; do not fix them in the same change

## Context Loss and Compaction

AI loses track of earlier decisions as the context window fills. After compaction, rules, constraints, and file states may be lost.

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
- The default assumption is that the code is wrong, not the test. Exceptions: the test has a bug in its own logic, asserts on a changed spec, or is over-specified on implementation details. In those cases, fix the test and document why the old assertion was incorrect.

A documented pattern: an AI changed `expect(total).toBe(90)` to `expect(total).toBe(0)` to match buggy 100%-off discount logic instead of fixing the discount calculation. The test passed, the bug deployed. (Source: dev.to/kensave, "Your AI Agent Says All Tests Pass")

## Silent Behavioral Regressions

Changes that produce no errors but alter behavior in ways nothing catches until production.

### Error Messages and Status Codes

Monitoring, alerting, and client code depend on exact error strings and HTTP status codes.

- Do not change error message text used by monitoring (monitoring rules match on substrings)
- Do not change error codes or exception types
- Do not change HTTP status codes (404 vs 200 with empty body, 400 vs 422, 201 vs 200)
- Do not change response envelope structure (wrapping/unwrapping `{ data: [...] }`)
- Do not change response field names or casing
- Exception: if an error message leaks internal details (stack traces, hostnames, database names, credentials, PII) to external callers, sanitizing it is a security fix. Update monitoring rules in the same change.

### Default Values and Timing

- Do not change numeric defaults (page sizes, timeouts, retry counts, debounce intervals)
- Do not change boolean defaults (feature toggles, display options)
- Do not change fallback values. Be especially careful with `||` vs `??`: they behave differently for `0`, `""`, and `false`. Swapping one for the other is a behavioral change.
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

## Security Regressions

Code changes that silently remove or weaken security controls. These are the highest-severity regressions because functional tests do not catch them.

**Rules:**
- Before moving or refactoring a route/endpoint, verify all middleware (auth, rate limiting, CSRF, input validation) is preserved on the new path
- Before changing a default value, check whether it is a security boundary (deny-by-default, least-privilege)
- Before modifying input validation logic, verify no validation rules are weakened or removed
- Before changing server/infrastructure configuration, verify security headers (CORS, CSP, HSTS) are preserved
- Never widen CORS origins, relax CSP directives, or lower TLS requirements without explicit security review
- Never remove rate limiting, CSRF protection, or authentication checks during refactoring

## API and Type Contract Breaks

AI changes function signatures, type definitions, or API response shapes without updating all consumers.

**Rules:**
- Before changing a function signature, grep for all call sites and update them in the same change
- Before changing a TypeScript interface or type, check all files that reference it
- Before changing an API response shape, check all frontend consumers
- Never add required fields to existing interfaces without providing defaults
- Never remove fields from API responses (they may be consumed by external clients)
- Never change parameter order in functions with positional arguments

## Dependency and Migration Drift

AI updates a package version or migrates imports without updating all consumers.

**Rules:**
- After any dependency version change, check the changelog for breaking changes
- When migrating imports or APIs, grep for ALL import sites, not just the file being edited
- Run the full test suite after dependency changes, not just the file-level tests
- Never run a different package manager than the one the project uses (check which lock file exists)

## Deployment and Infrastructure Configuration

AI modifying deployment configs causes production outages that are invisible until deploy time.

**Rules:**
- Never change Dockerfiles, docker-compose, or Kubernetes manifests unless that was the specific request
- Never change CI/CD pipeline files (.github/workflows/, .gitlab-ci.yml, Jenkinsfile) unless that was the specific request
- Never loosen tsconfig strictness flags (strict, noImplicitAny, skipLibCheck) to suppress errors; fix the code
- Never remove lint, typecheck, test, or security scan steps from CI pipelines
- Never change deployment triggers, branch filters, or approval gates
- If adding a new required environment variable, document it in .env.example

## File and Project Integrity

- Never rewrite an entire file when a targeted edit suffices
- Never create duplicate files (check if the functionality already exists before creating new files)
- Never execute destructive git commands (`git reset --hard`, `git clean -f`, `git checkout --` on modified files) without explicit user approval
- Never force-push to shared branches
- Never commit generated or compiled artifacts (dist/, build/, node_modules/) unless the project's .gitignore is configured for it
- Never modify lock files (package-lock.json, yarn.lock, pnpm-lock.yaml, Cargo.lock) manually; use the package manager
- Never change build configuration (webpack, vite, tsconfig, next.config) unless that was the specific request

## The Blast Radius Principle

Before making any change, estimate its blast radius:

- **Low risk**: change is contained within one function, no callers affected. Proceed with normal care.
- **Medium risk**: change affects a function called by other functions in the same file. Read callers in the same file; run the file's tests.
- **High risk**: change affects an exported function, shared type, or configuration used across multiple files. Grep all importers; run the full test suite.
- **Critical risk**: change affects database schema, API contracts, authentication, deployment, or infrastructure configuration. Flag to the user before proceeding; consider a separate PR.

## Self-Check: Regression Prevention

For the canonical regression checklist, see `self-check.md` under "Regression Prevention (if modifying existing code)."
