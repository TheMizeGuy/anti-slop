# Self-Check Checklists

Run through the relevant checklist before finalizing output. These catch the most common AI tells. The Quick Pass at the bottom covers the minimum; use the full checklist for thorough review. Not every item applies to every output. Applying all rules mechanically creates its own detectable pattern.

## Text/Prose Checklist

### Vocabulary

- [ ] No words from the banned words list? (Check `banned-words.md`. Highest priority: delve, leverage, utilize, pivotal, seamless, multifaceted, landscape, tapestry, testament, showcase, foster, harness, ensure, crucial, enhance)
- [ ] No promotional adjectives? (vibrant, groundbreaking, cutting-edge, transformative, unprecedented)
- [ ] No unnecessary adverbs? (really, just, literally, fundamentally, inherently, crucially)
- [ ] No fancy verb substitutes for "is" or "has"? (serves as, stands as, features, boasts)

### Phrases

- [ ] No sycophantic opener? (Great question, Absolutely, Certainly, I'd be happy to)
- [ ] No sycophantic closer? (Hope this helps, Feel free to, Let me know if you have questions)
- [ ] No throat-clearing? (Here's the thing, The truth is, Let me be clear)
- [ ] No filler phrases? (It's worth noting, At the end of the day, When it comes to, In today's)
- [ ] No meta-commentary? (Let me walk you through, In this section, As we'll see, Key takeaways)
- [ ] No emphasis crutches? (Let that sink in, Full stop, Make no mistake)
- [ ] No journey metaphors? (embark on, navigate the landscape, pave the way)
- [ ] No significance inflation? (pivotal moment, watershed moment, paradigm shift)
- [ ] No vague declaratives? (The implications are significant, The stakes are high)

### Structure

- [ ] Not forcing lists to exactly three items? (If every list has three items, something is wrong.)
- [ ] No binary contrasts? (Not X. Y. / The problem isn't X. It's Y.)
- [ ] No hedging seesaw? (Presenting both sides, then hedging, then hedging again)
- [ ] No dramatic fragmentation? (One. Word. Sentences. For. Drama.)
- [ ] No rhetorical questions answered immediately?
- [ ] No topic-explanation-example-transition template in every paragraph?
- [ ] No summary/recap at the end that restates what was just said?
- [ ] No recapping the user's question before answering?

### Rhythm

- [ ] Sentence lengths vary? (No three consecutive similar-length sentences)
- [ ] Some short sentences mixed with longer ones?
- [ ] Paragraph lengths vary? (Not all the same size)
- [ ] Some paragraphs end abruptly without transitions?

### Punctuation

- [ ] Em dashes used sparingly? (Count them. High density is the top AI tell.)
- [ ] Exclamation marks rare? (Max one per 1000 words)
- [ ] No ellipsis abuse?
- [ ] Semicolons and colons used naturally where appropriate?

### Voice

- [ ] Active voice throughout? (Every sentence has a concrete subject doing something)
- [ ] No false agency? (Decisions don't "emerge," data doesn't "tell us")
- [ ] No passive voice hiding actors? ("Was implemented"; by whom?)
- [ ] Specific rather than vague? (Real numbers, named things, concrete details)
- [ ] No performative enthusiasm? (Exclamation marks that don't match the content)
- [ ] Direct and trusting of the reader? (No hand-holding, softening, or justifying)

### Formatting

- [ ] No unnecessary markdown headers? (Short responses don't need them)
- [ ] No bold used for emphasis in running prose?
- [ ] No emoji anywhere (prose, code, commits, logs, UI strings, headings)?
- [ ] Bullet points only for list-like content?
- [ ] Formatting is minimal and functional?

## Code Checklist

### Comments

- [ ] No comments that restate the code?
- [ ] No "// Constructor" or "// Initialize X" type comments?
- [ ] No trivial JSDoc/docstrings on obvious functions?
- [ ] Comments only explain *why*, not *what*?
- [ ] No TODO comments without real plans (linked issues, specific dates)?
- [ ] No apologetic comments ("simplified implementation, may need enhancement")?
- [ ] No emoji in comments, variable names, or log output?
- [ ] No banner/divider comments (ASCII-art section separators)?
- [ ] No language-feature explanations ("Use a dict comprehension to...")?

### Architecture

- [ ] No abstraction layers for single implementations?
- [ ] No factory/builder/strategy with only one concrete case?
- [ ] No helper functions used exactly once?
- [ ] No configuration objects for trivial fixed values?
- [ ] Code matches the codebase's existing patterns and conventions?
- [ ] No premature generalization?

### Error Handling

- [ ] No try-catch that swallows errors silently?
- [ ] No null checks for values guaranteed by the type system? (But do check at trust boundaries.)
- [ ] Error handling at boundaries, not at every layer?
- [ ] Specific exception types, not bare `except` or `catch(e)`?

### Hygiene

- [ ] No unused imports?
- [ ] No unused variables?
- [ ] No commented-out code?
- [ ] No debugging residue files?
- [ ] No redundant type annotations the compiler infers?
- [ ] Concise where possible without sacrificing readability?

### Verification

- [ ] All API methods verified to exist?
- [ ] All packages verified to exist in the registry?
- [ ] No deprecated APIs used unknowingly?
- [ ] Framework conventions followed?
- [ ] No mixed patterns from different frameworks?

### Security

- [ ] No SQL string concatenation? (Use parameterized queries)
- [ ] No innerHTML with unsanitized user input? (XSS)
- [ ] No eval() with user input?
- [ ] No hardcoded credentials or API keys?
- [ ] No shell=True with user-supplied input? (Command injection)
- [ ] No unsanitized file paths from user input? (Path traversal)
- [ ] Inputs checked at system boundaries?
- [ ] Secure random generation for security purposes?
- [ ] No sensitive data (passwords, tokens, PII) in log messages?

### Backend (if applicable)

- [ ] No N+1 query patterns?
- [ ] List endpoints paginated?
- [ ] HTTP calls have timeouts configured?
- [ ] Retry logic uses backoff (not immediate retries)?
- [ ] No unbounded queries without LIMIT?
- [ ] No shallow copies where deep copies are needed (nested mutations)?
- [ ] Decimal/integer arithmetic for money (not floating-point)?
- [ ] No race conditions in concurrent/async code?

### Testing (if writing tests)

- [ ] Tests verify behavior, not implementation details?
- [ ] Tests would survive internal refactoring?
- [ ] No trivial tests (testing that true is true)?
- [ ] Edge cases covered?
- [ ] Mocks used only where necessary, not as a default?

### Regression Prevention (if modifying existing code)

- [ ] Changed only what was asked? No unrelated refactoring or cleanup?
- [ ] Read modified files AND their dependents before editing?
- [ ] Used Edit (targeted diff) not Write (full file rewrite)?
- [ ] All callers updated if function signature changed?
- [ ] All consumers updated if type definition changed?
- [ ] Error messages, status codes, response shapes preserved exactly?
- [ ] Default values, timeouts, rate limits, cache TTLs preserved?
- [ ] Log levels, metric names, log field names preserved?
- [ ] Feature flags and conditional logic not removed?
- [ ] Tests fixed the code, not weakened the assertions?
- [ ] No `--no-verify`, `@ts-ignore`, `eslint-disable` to suppress real errors?
- [ ] No destructive git commands without user approval?

### Frontend (if writing React/Next.js/CSS)

- [ ] No useEffect for derived state (compute during render or useMemo)?
- [ ] useEffect has cleanup function for timers, listeners, subscriptions?
- [ ] No "use client" on components that could be server components?
- [ ] No full library imports (lodash, moment) when tree-shakeable imports exist?
- [ ] Images have width/height attributes, loading="lazy", srcset?
- [ ] No z-index escalation (use a defined scale)?
- [ ] No animating layout properties (width, height, top, left)?
- [ ] Font loading uses font-display: swap and preload?
- [ ] Semantic HTML used (`<button>`, `<nav>`, `<dialog>`, `<details>`) not div soup?
- [ ] Headings follow hierarchy (h1 > h2 > h3, no skipped levels)?
- [ ] Link for navigation, button for actions (not reversed)?
- [ ] Empty, error, and loading states designed (not just the populated view)?
- [ ] Interactive elements actually function (not just styled)?
- [ ] Design tokens/CSS variables used instead of hardcoded values?
- [ ] No styled-components created inside render functions?
- [ ] No Tailwind dynamic class construction (`bg-${color}-500`)?
- [ ] No hydration mismatches (Date, Math.random, typeof window in render)?
- [ ] Search inputs debounced (not firing on every keystroke)?

## Design/UI Checklist

### Visual Design

- [ ] No purple-to-blue gradient as default?
- [ ] Font choice is intentional, not default Inter/Roboto?
- [ ] Color palette matches the project's brand/purpose?
- [ ] Layout responds to content, not a template?
- [ ] No three-column icon grid as default feature display?
- [ ] No glassmorphism without purpose?
- [ ] Shadow values vary by elevation need?
- [ ] Border radius is consistent and appropriate for the design?
- [ ] No gratuitous animations?
- [ ] Component library defaults customized to match the project?

### CSS

- [ ] No magic number pixel values?
- [ ] Design tokens or CSS variables used?
- [ ] No !important overrides?
- [ ] No excessive selector nesting?
- [ ] No duplicate styles?
- [ ] No `outline: none` without a replacement focus indicator?
- [ ] Font sizes in rem/em, not px?
- [ ] All animations wrapped in @media (prefers-reduced-motion: reduce)?

### Accessibility

- [ ] Text contrast meets WCAG AA? (4.5:1 normal text, 3:1 large text 18pt+/14pt bold+)
- [ ] UI component contrast meets 3:1? (borders, icons, focus indicators)
- [ ] Color not used as the sole indicator of meaning?
- [ ] Informative images have descriptive alt text? Decorative images have alt=""?
- [ ] Keyboard navigation works for all interactive elements?
- [ ] Visible focus indicators on all interactive elements?
- [ ] Focus trapped in modals? Returned to trigger on close?
- [ ] Dynamic updates (toasts, errors, loading) announced via aria-live?
- [ ] Semantic HTML used? (`<button>`, `<nav>`, `<main>`, not div-for-everything)
- [ ] Heading hierarchy correct? (h1 > h2 > h3, no skipped levels)
- [ ] Touch targets at least 24x24px with spacing (WCAG 2.5.8 AA)?
- [ ] No hover-only interactions without touch alternatives?
- [ ] Skip navigation link present?
- [ ] HTML element has lang attribute?

### States and Content

- [ ] Empty states designed? (What shows with zero data?)
- [ ] Error states designed? (What shows when API fails?)
- [ ] Loading states designed?
- [ ] No generic microcopy? ("Welcome back!", "Get started today!")
- [ ] No marketing language in functional UI?
- [ ] No placeholder content in final output?
- [ ] Microcopy is specific to the product and context?

## Quick Pass (Minimum Check)

If pressed for time, check at minimum:

- [ ] First word of the response: is it sycophantic? ("Great", "Absolutely", "Certainly")
- [ ] Count em dashes: more than two in the response?
- [ ] Scan for "delve", "leverage", "utilize", "pivotal", "landscape", "ensure", "crucial"
- [ ] Any lists forced to exactly three items?
- [ ] Summary at the end that restates the content?
- [ ] In code: comments that restate the code?
- [ ] In code: unnecessary abstractions for single-use cases?
- [ ] In code: SQL injection, XSS, hardcoded secrets?
- [ ] In UI: missing focus states, missing alt text, poor contrast?
- [ ] Any emoji in output (prose, code, commits, logs)?
