---
last-refreshed: 2026-07-03
next-due: 2026-10
method: docs/rankings-refresh.md
---

# Empirical Rankings

Which AI tells real people actually name, ranked by data instead of intuition. This file grounds the rest of the plugin: it tells you which rules to weight heavily, which to apply only when they cluster, and which popular "AI tells" the evidence does not support.

## Where the data comes from

Three independent corpus studies mined public Reddit discussion (2020-2026, via the Arctic Shift archive) for the patterns people cite when they say something "looks AI-generated," then hand-audited a sample to separate what humans actually *flag* from what a keyword search merely *matches*.

| Domain | Posts scanned | On-topic set | Verification |
|--------|--------------|--------------|--------------|
| Writing/prose | 89,239 | 7,984 posts + 604 hand-read | 20 readers + 5 adversarial auditors |
| Code | ~23,000 | 11,906 posts + 11,306 comments | LLM-classified into 19 tells, adversarially re-audited |
| UI/design | 3,214,533 | 46,971 posts + 3,033 comments | each tell verified by an independent agent |

Source: the `vibecoded-design-tells` project by JCarterJohnson (MIT-licensed analysis code; Reddit text not redistributed). The numbers below are reproduced from the committed result tables. Treat the **relative ordering and gap sizes** as the signal, not the absolute percentages: this is a proxy for vocal, online developers and writers, not a representative sample of all output.

## Four findings that shape every rule in this plugin

1. **Flag the unspecified default, not the value.** A tell is an unchosen default, not a banned token. Purple is a tell when the model reached for it because nothing else was specified; it is fine as a stated brand decision. The same logic covers serif fonts, em dashes, the word "comprehensive," and a broad `try/except`. The escape hatch (`anti-slop-allow` / `unslop-ignore` on the line) exists so a deliberate choice never gets nagged. Swapping one default for another ("delve" to "dive," purple to cream-and-serif) is not a fix; it resets the clock.

2. **Concentration is the signal, not lone hits.** One "delve," one "however," one em dash, one `rounded-lg` card is almost never a tell. Across the full corpus, `however/thus/hence` is the single highest-frequency keyword (6.3% of all 7,984 on-topic posts), yet the 604-post hand-audit cited it 0% of the time. Weight by density (hits per 1,000 words, or repeated identical treatment), and let a single low-confidence hit read as clean.

3. **The loudest tells are structural and a regex cannot see them.** In every domain the top-cited tells are invisible to keyword matching. Writing: uniform sentence rhythm, sycophancy, fluent-but-empty paragraphs, hallucinated citations. Code: tutorial-shaped boilerplate, hallucinated APIs, over-engineering, ignoring the surrounding codebase. A clean scanner pass means the lexical layer is clean, not that the output reads human. The scanner is the cheap second pass; the semantic read (the `slop-detector` agent, or a careful human) is the first.

4. **Banning the old tells creates the new tell (the moving target).** As people learned the 2024 markers, a second default appeared: prose straining not to sound like AI (staccato fragments, forced lowercase, em-dash-dodging contortions, fake typos) and "tasteful" UI (cream background, serif display, sage accent) that now reads as AI just as fast. Apply the rules with judgment; mechanical over-correction is itself detectable.

## Writing: verified ranking

`cite%` = share of 604 hand-read posts that name it as a tell. `regex%` = keyword-match share over the same sample. The gap is the point.

| Tell | cite% | regex% | Reliability |
|------|------:|------:|-------------|
| Em dash overuse (—) | 7.1 | 6.0 | **High**: top tell on both passes; judged by density (a lone correct dash is clean) |
| Uniform / robotic sentence rhythm | 4.0 | n/a | **High, regex-blind**: 2nd most cited, no keyword can see it |
| "It's not just X, it's Y" / "not X, but Y" antithesis | 2.8 | 0.8 | **High**: the #1 *sentence* tell; regex under-counts |
| Sycophancy / yes-man tone | 2.5 | n/a | **High, regex-blind** |
| Perfectly-structured / formulaic essay shape | 2.5 | 0.5 | High, mostly regex-blind |
| "Dive in" / "deep dive" | 2.0 | 2.3 | Medium |
| Everything as bullet lists / "5 ways to…" listicles | 1.7 | 1.7 | Medium |
| Diction cluster (`delve`, `tapestry`, `unleash`, `game-changer`…) | 1.3 | 1.3 | **Inflated**: counts come from listicle/word-list copying, not independent observation |
| "As an AI language model" / leftover boilerplate | 1.2 | 0.3 | High when present; the sole single-instance tell; aging out |
| Rule of three / triads | 1.2 | n/a | Medium, regex-blind |
| Empty, fluent, hollow paragraph | 0.7 | n/a | High, regex-blind |
| Emoji as bullets / headers | 0.8 | 0.0 | Real; regex under-counts the wording |
| Bolded lead-in labels (`**Word:**` + sentence) | 0.3 | 0.8 | Real but **presence ≠ citation**; weight by clustering |
| "In conclusion" / "In summary" closer | 0.2 | 0.2 | Real, low-frequency, easy to delete |

Only leftover assistant boilerplate is **absolute** (fires on a single instance, even inside quotes). The em dash is the top-cited tell but is judged by density: a lone, correctly used dash is clean, and the scanner flags only sustained overuse. Everything else is judged by clustering.

### Writing: do NOT flag on a lone hit

These regex shares are the full-corpus keyword rate (all 7,984 posts, where over-matching is most visible); the cite% is from the 604-post hand-audit. They match often but are almost never what readers actually cite. They are usually the writer's own prose. Keep them as "prefer the plain word" guidance; never escalate a single occurrence.

| Word / phrase | regex% (full corpus) | cite% (sample) | Verdict |
|------|------:|------:|---------|
| however / thus / hence | 6.3 | 0.0 | **Noise**: highest keyword share corpus-wide, never cited |
| nuanced / nuance | 2.3 | 0.0 | **Noise** |
| when it comes to | 1.9 | 0.0 | **Noise** |
| utilize | 1.3 | 0.0 | Over-counts ("use" is better, not a smoking gun) |
| navigate / navigating | 1.5 | 0.0 | Over-counts |
| moreover / furthermore / additionally | 1.7 | 0.2 | Over-counts (one is just a connective) |
| `robust`, `embark`, `ever-evolving` | <1 | ~0 | Over-counts |

The broader low-confidence set (match the lexicon but humans use them normally): `realm, navigate, elevate, seamless, leverage, robust, intricate, comprehensive, crucial, harness, unlock, showcase, facilitate, foster, vibrant, holistic, synergy, streamline, empower, profound, nuanced, cutting-edge, multifaceted, paramount, pivotal, myriad, plethora, meticulous, utilize, captivating`. These stay in `banned-words.md` as plain-word guidance, but the scanner treats them as low-confidence: one occurrence is clean.

## Code: verified ranking (precision-adjusted)

Verified share = raw share discounted by how often the cited quote really meant that tell. The loudest four are structural and regex-blind.

| Tell | Verified share | Class | Regex-visible? |
|------|------:|-------|----------------|
| Boilerplate / tutorial-shaped "sample app" code | 18.6% | substance | No |
| Hallucinated APIs / made-up libraries, plausible-but-wrong logic | 11.2% | **bug** | No (build/type-check/run catches it) |
| Over-commenting (a comment narrating each line) | 8.5% | cosmetic | Partly |
| Over-engineering (abstraction/layers for a simple task) | 7.8% | substance | No |
| Emoji in code, comments, logs, commits | 3.9% | cosmetic | Yes |
| Style ignores the surrounding codebase | 3.5% | substance | No |
| try/except around everything / swallowed errors | 3.1% | **bug** | Partly |
| Suspiciously clean, no human mess | 2.3% | meta | No |
| Mixed skill (advanced beside beginner; can't explain it) | 1.9% | substance | No |
| Generic placeholder names (`process_data`, `doStuff`) | 1.9% | cosmetic | Yes |
| Placeholder comments left in (`// rest of your code`) | 1.6% | **bug** | Yes |
| Leftover chat artifacts (` ``` ` fences, "As an AI", "Note:") | 1.2% | cosmetic | Yes |

**Two axes, kept independent.** *Severity* = how loudly it reads as AI. *Class* = whether the code is actually wrong: **bug** (broken; fix it regardless of severity), **substance** (wrong-for-the-job, needs a human reading the diff against its neighbors), **cosmetic** (the chat voice leaking in, the light pass). A swallowed error is medium-severity but a bug; an emoji is the highest-precision cosmetic tell but harmless. The rule: never polish cosmetics while a swallowed error or hallucinated call ships.

### Code: do NOT flag

| Tell | Verdict |
|------|---------|
| Left-in debug logging (`print`/`console.log` everywhere) | **Rejected, precision ~0%**: every cited case was a workflow opinion, not real left-in logging. Do not flag bare logging. |
| Reinventing the wheel (re-implementing stdlib) | Inflated; mostly misattributed to duplication or hallucinated libs |
| Over-defensive validation (null checks for impossible cases) | Inflated, ~40%. **Asymmetry:** do NOT flag it when reviewing (half the complaints are the opposite, no validation at all), but DO avoid producing it when generating. It is the over-correction trap. |
| Type hints everywhere, docstring on every trivial function | Verified ~0.8% / 0.0%; barely registers |

## UI/design: verified ranking

Trust comment share over post share when they diverge (comments are 100% on-topic; post bodies inflate generic words like "cards" and "dark mode"). The stereotypical "AI design" memes (bento, mesh gradients) sit near the bottom or were rejected.

| Tell | Comment share | FP risk | Verdict |
|------|------:|---------|---------|
| "All looks the same" / cookie-cutter (umbrella) | 6.1% | low | Top finding |
| Default shadcn / Tailwind kit, un-themed | 2.5% | medium | #1 concrete cause |
| AI purple (indigo/violet primary) | 2.3% | low | Top color tell |
| Gradients / gradient hero text | 2.0% | low | Confirmed (share understates it) |
| Too many animations / Framer fade-ins | 1.1% | high | Minor, noisy signal |
| Rounded corners / pill buttons everywhere | 0.8% | medium | Confirmed |
| Dark mode + unprompted neon glow | 0.7% | low | Confirmed (the glow, not dark mode) |
| Emoji as icons / sparkles / rockets | 0.5% | medium | Confirmed (emoji *as UI*, not in copy) |
| Generic sans (Inter / Geist) | 0.4% | low | Confirmed (share understates it) |
| Symmetric hero + 3 feature cards + CTA | 0.4% | medium | Confirmed, thin |
| **Cream + serif + sage "tasteful default"** | rising | n/a | The current top emerging tell; see `design-patterns.md` |

### UI: cleared by the data (do NOT flag)

| Pattern | Verdict |
|---------|---------|
| Mesh / blob / aurora backgrounds | **Rejected**: keyword artifact (most matches were GitHub `/blob/` URLs) |
| Bento grid | Dead last (0.1%); people defend it. Not a tell. |
| Glassmorphism / frosted glass | 0.2%, contested. Low signal. Flag only "everywhere, without purpose," not its presence. |
| shadcn / Tailwind / dark mode themselves | The *un-themed defaults* are the tell, not the tools. A themed shadcn site is invisible to the complaint. |

## How to use this file

- **Severity follows the data.** Top-ranked, low-FP tells (em dash, "not just X," AI purple, shadcn defaults, swallowed errors, hallucinated APIs, chat artifacts) carry weight. Inflated/low-confidence tells (the diction cluster, lone connectives, glassmorphism) only count when they cluster.
- **Route regex-blind tells to a semantic read.** Rhythm, sycophancy, emptiness, formulaic shape, hallucinated APIs/citations, over-engineering, and codebase-fit need the `slop-detector` agent or a human, not the scanner.
- **Honor the escape hatch.** A flagged construct on a line marked `anti-slop-allow:` / `unslop-ignore` is a deliberate choice. Skip it.
- **A clean scan is not the finish line.** It clears the cheap layer. The structural read is where the real signal lives.

## 2026-07 spot-check

Bounded drift check of this file's top claims against public discussion from mid-2025 through mid-2026 (method and cadence: `docs/rankings-refresh.md`). This section records status only; any rule change goes through the measure harness first (`npm run measure` from `scripts/`).

| Claim (as ranked above) | Status | Evidence |
|-------------------------|--------|----------|
| Em dash is the top writing tell | Confirmed; drifting down at the source | Still the most-named tell in press and detection guides through 2026-02 (vrid), but GPT-5.1 (2025-11) now obeys "no em dashes" custom instructions per Altman (via Mowshowitz, 2025-11-18) and vendors cut the default rate, so fresh model output carries fewer. Keep density scoring; re-measure before any promotion. |
| `not just X, it's Y` antithesis | Confirmed; strengthening | Wikipedia's living "Signs of AI writing" page calls negative parallelism "stereotypically an AI sign"; Barron's counted the construction in Fortune 500 filings rising from ~50 (2023) to 200+ (2025) (via Hassid). |
| Cream + serif + sage as the emerging design tell | Confirmed as now-mainstream; accent detail drifting | Chayka (2026-06-29) describes beige and cream backgrounds with large italicized serif display as the recognizable generic AI web style, with rusty-orange accents named where this file says sage. FP risk rising: human 2026 design trends converge on the same palette. |
| AI purple / un-themed shadcn as the #1 concrete cause | Confirmed; NOT superseded by cream/serif | Still the leading concrete complaint for vibe-coded app UI; Adam Wathan's 2025-08 apology for `bg-indigo-500` drew 1M+ views (via prg.sh). Cream/serif is a second parallel default rather than a replacement. |
| Sycophancy / yes-man tone (regex-blind) | Confirmed; worse | Claude Code's "You're absolutely right!" became a reported product complaint (The Register 2025-08-13; claude-code issue #3382); GPT-5.1 reviewers report increased glazing and automatic "Good question" openers (Mowshowitz). The catchphrases themselves are already in the scanner's banned-phrase list; the tone in flowing prose stays agent territory. |
| Chat-artifact and cosmetic code tells (fences, emoji, placeholder comments) | Confirmed | Emoji-dense output is used operationally as a detection signal (Netcraft 2025); complaints about cleaning emoji-riddled AI comments persist on HN into 2026; 2026 AI-code-review checklists still lead with leftover artifacts. |
| Diction cluster (`delve` etc.) as low-confidence only | Confirmed direction; aging out faster | Wikipedia notes `delve` dropped sharply in 2025 as models updated; PubMed-corpus work tracks the vocabulary receding in medical writing. Low-confidence treatment stays right; these are demotion candidates, never promotion. |
| Loudest tells are structural and regex-blind | Confirmed with new evidence | arXiv 2601.21276 (2026-01) measures AI pull requests ignoring reuse opportunities while reviewers rate them positively: surface plausibility masks exactly the defects a regex cannot see. |

New tells named in current sources that this file does not yet cover:

- First-word fingerprints: model-specific openers ("Certainly!", "Good question", "I'd be happy to") treated as a distinct tell class (vrid 2026-02). Several are already banned phrases here; the class is broader than the current list.
- Participial sentence openers (`-ing` phrase first) at 2-5x the human rate (vrid 2026-02). Regex-visible; high FP risk; needs corpus measurement before any rule.
- `From X to Y` sweep construction (vrid 2026-02). Regex-visible; likely high FP.
- Personification of tools and data ("the data tells a story") (vrid 2026-02). Regex-blind; agent territory.
- Title case forced onto every heading (Wikipedia). High FP risk against legitimate house styles.
- Em-dash-avoidance contortions are now themselves cited as a tell, which is finding 4 (the moving target) playing out on schedule.

Sources (accessed 2026-07-03): Wikipedia "Signs of AI writing" (en.wikipedia.org/wiki/Wikipedia:Signs_of_AI_writing); Kyle Chayka, "The generic style of AI web design", 2026-06-29 (kylechayka.substack.com); Zvi Mowshowitz, "GPT-5.1 Follows Custom Instructions and Glazes", 2025-11-18 (thezvi.wordpress.com); vrid.ai "Signs of AI Writing", 2026-02-11; Ruben Hassid, "It's not [X], it's [Y]" (ruben.substack.com); Milind Nair, dev.to (why-does-ai-keep-saying-its-not-x-its-y); The Register, 2025-08-13 (claude_codes_copious_coddling_confounds); github.com/anthropics/claude-code issue 3382; prg.sh "Why Your AI Keeps Building the Same Purple Gradient Website"; Netcraft, "Excessive Emojis as an AI Indicator"; arXiv 2601.21276 "More Code, Less Reuse", 2026-01-29; PMC12679996 "Delving Into PubMed Records"; github.com/JCarterJohnson/vibecoded-design-tells (upstream corpus, still the original snapshot).
