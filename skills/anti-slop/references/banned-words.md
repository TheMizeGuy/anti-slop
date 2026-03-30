# Banned Words

Words statistically overrepresented in AI-generated text. Corpus analyses ("delve" in particular at ~25-48x in post-2023 academic text per a 2024 Max Planck/Stanford study) show some appear 10-50x more often in AI output than in human writing. Avoid these in general prose. Do not always pick the first alternative listed; vary replacements across outputs to avoid creating a new detectable pattern.

**Technical context caveat:** Many words below are standard terms in their technical domains. "Validate" in code, "aggregate" in SQL/pandas/Spark, "benchmark" in testing and ML, "framework" in software, "calibrate" in ML and instrumentation, "robust" in statistics and testing, "optimize" in ML and performance, "enhance" in image processing and data augmentation, "differentiate" in calculus, "reconcile" in accounting, "align" in CSS/memory, "converge" in ML and numerical methods, "ecosystem" in npm/platform discussions, "diverse" when referring to demographic or cultural diversity. When these are the precise technical term, use them. These bans target the inflated, metaphorical, or generic use of these words in prose.

**Register note:** Frequency data is based primarily on American English corpora. In British English formal prose, some words on this list (renowned, featuring) may be standard. Apply judgment for non-American registers. In academic and formal writing contexts, consult the Context Exceptions in SKILL.md before applying these bans.

## Abstract Verbs

These verbs sound impressive but add nothing in general prose. Replace with their plain equivalents. The principle to internalize: when you reach for an impressive-sounding verb, ask whether a plainer word says the same thing. This principle extends beyond this list.

| Banned | Use Instead |
|--------|-------------|
| delve / delving | dig into, examine, look at |
| leverage | use |
| utilize | use |
| harness | use, apply |
| streamline | simplify, speed up |
| underscore | stress, highlight |
| navigate (metaphorical) | handle, deal with, work through |
| unpack | explain, break down |
| embark | start, begin |
| elevate | raise, improve |
| unveil / unveiling | show, reveal, announce |
| facilitate | help, enable |
| cultivate | build, grow, develop |
| elucidate | explain, clarify |
| orchestrate | arrange, coordinate, run |
| synthesize | combine, merge |
| expedite | speed up |
| augment | add to, increase |
| galvanize | motivate, push, spark |
| transcend | go beyond, surpass |
| exemplify | show, demonstrate |
| consolidate | combine, merge |
| extrapolate | guess, predict, extend |
| substantiate | prove, back up, support |
| juxtapose | compare, contrast, set against |
| encompass | include, cover |
| assimilate | absorb, take in |
| fortify | strengthen |
| calibrate | adjust, tune |
| emulate | copy, imitate |
| permeate | spread through, fill |
| conceptualize | imagine, picture |
| manifest | show, appear |
| scrutinize | examine, inspect |
| elicit | draw out, get |
| enumerate | list, count |
| empower | enable, give power to |
| disseminate | spread, share |
| culminate | end in, lead to |
| actualize | achieve, make real |
| harmonize | align, match |
| accentuate | highlight, stress |
| illuminate | clarify, light up |
| reiterate | repeat, restate |
| mitigate | reduce, lessen |
| advocate | support, push for |
| validate (prose only; fine in code) | confirm, check |
| ensure (prose only; fine in technical docs) | make sure, confirm |
| enhance | improve, add to |
| optimize (prose only; fine in code and ML) | improve, tune, speed up |
| tailor | adjust, customize, fit |
| mediate | step in, settle |
| conjecture | guess, speculate |
| ascertain | find out, determine |
| contextualize | put in context, explain |
| amplify | increase, boost |
| elaborate | expand, explain further |
| correlate | relate, connect |
| quantify | measure, count |
| deconstruct | break down, analyze |
| envision | imagine, picture |
| speculate | guess |
| expound | explain |
| interpret | explain, read |
| revitalize | refresh, renew |
| deliberate | consider, think over |
| aggregate | combine, total |
| differentiate | distinguish, separate |
| reconcile | settle, resolve |
| decipher | figure out, decode |
| theorize | guess, suppose |
| align | match, fit |
| dissect | analyze, break apart |
| formulate | create, develop, plan |
| converge | meet, join, come together |
| introspect | reflect, think |
| reconfigure | rearrange, reset |
| incubate | develop, grow |
| benchmark | measure, compare |
| recapitulate | summarize |
| retrofit | update |
| transmute | change, transform |
| bolster | support, strengthen |
| foster | encourage, support |
| garner | get, earn, collect |
| pioneer | lead, start |
| showcase | show, display, present |
| spearhead | lead |
| burgeon | grow, expand |
| demystify | explain, clarify |

## Inflated Adjectives

These adjectives signal AI immediately. Replace with specific descriptions or drop entirely.

| Banned | Use Instead |
|--------|-------------|
| pivotal | important, key (or say why it matters) |
| robust (prose only; fine in statistics/testing) | strong, solid, reliable |
| crucial | important, key (or say why) |
| impactful | effective, strong (or describe the impact) |
| overarching | broad, main, overall |
| innovative | new (or describe the innovation) |
| seamless | smooth, easy |
| cutting-edge | new, modern, latest |
| groundbreaking | new (or describe what it broke) |
| transformative | big, major (or describe the change) |
| unprecedented | new, first, rare |
| unparalleled | best, top, unique |
| multifaceted | complex, varied (or name the facets) |
| comprehensive (fine in technical: "comprehensive test coverage") | full, complete, thorough |
| meticulous | careful, precise, detailed |
| intricate | complex, detailed |
| vibrant | lively, active, bright |
| profound | deep, serious, major |
| indispensable | essential, needed, required |
| unwavering | steady, firm, constant |
| invaluable | very useful, essential |
| noteworthy | notable, worth mentioning |
| commendable | good, solid, well-done |
| imperative | necessary, urgent, required |
| paramount | most important, top priority |
| holistic | whole, complete, full |
| diverse (fine for demographic/cultural diversity) | varied, mixed, different |
| dynamic | active, changing, energetic |
| compelling | strong, convincing, interesting |
| nuanced | subtle, complex, layered |
| formidable | tough, powerful, serious |
| indelible | lasting, permanent |
| ubiquitous | everywhere, common, widespread |
| burgeoning | growing, expanding |

## Filler Nouns

Abstract nouns that sound meaningful but say nothing. Name the specific thing instead.

| Banned | Use Instead |
|--------|-------------|
| landscape | (name the specific field, market, or area) |
| realm | field, area, domain |
| tapestry | mix, combination (or describe specifically) |
| synergy | cooperation, combined effect (or describe it) |
| testament | proof, evidence, sign |
| underpinnings | basis, foundation |
| interplay | interaction, relationship, connection |
| endeavor | project, effort, work, attempt |
| paradigm | model, approach, pattern |
| intersection | overlap, meeting point |
| ecosystem | system, community, network |
| framework | structure, system, plan |
| cornerstone | foundation, basis, key part |
| linchpin | key part, core, center |
| bedrock | foundation, base |
| nexus | connection, link, center |
| crucible | test, challenge |
| catalyst | trigger, spark, cause |
| enigma | puzzle, mystery |

## Adverbs (Almost Always Delete)

These adverbs add nothing in polished prose. Delete them; the sentence is stronger without them. In conversational or informal contexts, "just" and "actually" are fine.

| Delete in polished prose |
|-------------|
| really |
| just |
| literally |
| genuinely |
| honestly |
| simply |
| actually |
| deeply |
| truly |
| fundamentally |
| inherently |
| inevitably |
| interestingly |
| importantly |
| crucially |
| impressively |
| effectively |
| strategically |
| comprehensively |
| intricately |
| essentially |
| significantly |
| remarkably |
| notably |
| undeniably |
| undoubtedly |
| arguably |
| admittedly |
| increasingly |

## Promotional Language

Words that read like a press release or travel brochure. Drop or replace.

| Banned | Use Instead |
|--------|-------------|
| nestled | located, sits |
| thriving | active, growing, busy |
| renowned | known, well-known, famous |
| featuring | with, including, has |
| bustling | busy, active |
| timeless | lasting, classic |
| captivating | interesting, engaging |
| enchanting | appealing, attractive |
| awe-inspiring | impressive |
| breathtaking | impressive, striking |
| exquisite | fine, beautiful, detailed |
| uncharted | new, unexplored |
| boundless | vast, unlimited, wide |
| marveling | impressed by, surprised by |

## Compound Modifiers

Hyphenated compounds that scream AI. Avoid or replace.

| Banned | Use Instead |
|--------|-------------|
| ever-evolving | changing |
| ever-changing | changing |
| ever-expanding | growing |
| ever-competitive | competitive |
| hyper-connected | connected |
| fast-paced | quick, busy |
| game-changing | big, important (or say what changed) |
| thought-provoking | interesting (or say what it provokes) |
| forward-thinking | modern, progressive |
| results-driven | effective, focused |
| data-driven | based on data |

## Copula Avoidance (Fancy Substitutes for "is" and "has")

AI avoids simple linking verbs. Use "is" and "has" when they're the right words.

| Banned Pattern | Use Instead |
|---------------|-------------|
| serves as | is |
| stands as | is |
| represents | is (when it means "is") |
| marks | is (when it means "is") |
| features | has |
| offers | has, gives |
| boasts | has |
| constitutes | is |
| functions as | is |
| operates as | is |

## Creative Writing / Fiction Words

Words AI overuses in narrative and descriptive writing. Replace with specific, surprising details.

| Banned | Use Instead |
|--------|-------------|
| gossamer | thin, delicate, fine |
| iridescent | shimmering (or describe the specific colors) |
| luminous | bright, glowing, lit |
| ephemeral | brief, short-lived, fleeting |
| ethereal | light, airy, delicate |
| enigmatic | mysterious, puzzling |
| palpable | strong, obvious, thick |
| resplendent | bright, dazzling, colorful |
| visceral | gut-level, raw, physical |
| ineffable | (usually deletable -- name the thing) |
| whimsical | playful, odd, quirky |
| poignant | sad, touching, sharp |
| evocative | suggestive, reminiscent |
| riveting | gripping, absorbing |
| spellbinding | gripping, absorbing |
| tantalizing | tempting, teasing |

Also avoid: characters sighing, taking deep breaths, or staring out windows as default emotional beats. Eyes should not constantly "glisten," "sparkle," or "widen." Find specific, unexpected actions instead.
