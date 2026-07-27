# Handoff: integrating the UI toolkits' anti-AI work into anti-slop

**Written 2026-07-27. For a fresh session with no prior context.**

Two sibling plugins, `ui-craft` and `apple-ui-craft`, both shipped major
releases on 2026-07-27 (0.3.0 and 0.3.1 respectively). Both are downstream of
this plugin's UI research. In the course of those releases they produced
material that belongs here, including **one correction to a rule this repo
currently ships**, and several methods this repo has no equivalent of.

This document is the work order. It assumes you know nothing about those
releases.

---

## 0. Read this before touching anything

### The direction-of-truth problem, which is the whole risk

`docs/rankings-refresh.md` § "Downstream sync: ui-craft catalogue" declares:

> anti-slop remains the source of truth for corpus evidence; ui-craft is a
> downstream distillation.

That is still correct **for the empirical rankings and the corpus evidence**. It
is **not** correct for everything in this document. Some of the work below flows
backward, from the distillation to the source, and one item is a defect in this
repo that the distillation found and fixed first.

Before writing any code, decide per item which repo owns the result, and write
that decision down in the sync contract. **A file that both repos edit
independently is a fork, and it will drift within one quarter.** The most likely
failure mode of this whole task is producing two catalogues that disagree and
nobody noticing for three months.

Per-item direction is stated in every work item below. Do not skip it.

### Verified state at handoff

Everything in this section was checked on 2026-07-27, not assumed. Re-verify
before relying on it; these are moving repos.

| Repo | Path | Version | HEAD at handoff |
|---|---|---|---|
| anti-slop (this one) | `~/Dev/anti-slop` | 1.6.0 | `443576a` |
| ui-craft | `~/Dev/ui-craft` | 0.3.0 | see its `git log`; branch `chore/ts7-ga-doctrine` merged to main |
| apple-ui-craft | `~/Dev/apple-ui-craft` | 0.3.1 | `e6b3c33` |

Both UI toolkits have public mirrors (`ui-craft-public`, `apple-ui-craft-public`)
that are regenerated, never hand-edited. anti-slop's relationship to its own
mirror is out of scope here.

Relevant anti-slop surface, measured:

| File | Lines | Role |
|---|--:|---|
| `skills/anti-slop/references/design-patterns.md` | 476 | UI/design tells. **The file with the defect in item 1** |
| `skills/anti-slop/references/frontend-patterns.md` | 332 | Framework-level frontend tells |
| `skills/anti-slop/references/empirical-rankings.md` | 160 | The ranking table ui-craft mirrors |
| `scripts/lib/rules.mjs` | 160 | The machine scanner's rule set |
| `scripts/test/corpus/design/` | 5 fixtures | ui-craft copied these verbatim |
| `scripts/test/corpus/labels.json` | flat | `{file, modality, expected: [ruleId]}` |
| `agents/slop-detector.md` | -- | The deep-analysis agent |

Relevant ui-craft surface:

| File | Lines | Role |
|---|--:|---|
| `references/catalogue/01-ai-tells.md` | 601 | The merged catalogue: 150+ tells, IDs, Strongest-10, remediations |
| `references/catalogue/02-empirical-evidence.md` | 83 | Mirrors this repo's ranking table |
| `references/review/01-universal-rubric.md` | 230 | Finding format, severity, **confidence enum**, dimension registry |
| `references/review/02-evidence-pipeline.md` | 163 | Review modes, geometry evidence rule |
| `references/review/05-density-and-economy.md` | 208 | The waste dimension |
| `tests/corpus/fixtures/` | 15 | Grew from the 5 copied from here |
| `tests/harness/score-review.mjs` | -- | Recall/precision gate with clean-control accounting |

Relevant apple-ui-craft surface:

| File | Role |
|---|---|
| `references/review/01-finding-format.md` | Same contract, iOS dimension registry |
| `references/review/02-evidence-pipeline.md` | Evidence modes for a platform with no DOM |
| `references/review/03-density-and-economy.md` | Waste, measured on native windows |
| `references/review/04-run-artifacts.md` | Ledger + CI artifact contracts |
| `references/usability/01`..`05` | Flow, forms, IA, states, adaptive method |
| `ci/gate.mjs`, `ci/selftest.mjs` | A verdict gate that fails closed |
| `tests/check-references.mjs` | Link-integrity gate |

---

## 1. HIGHEST PRIORITY: a rule in this repo is over-broad, and it is actively harmful

**Direction: ui-craft → anti-slop. This repo is wrong and the distillation is right.**

`skills/anti-slop/references/design-patterns.md:448` carries, as entry 9 of a
ranked list:

```
9. `text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight` hero heading scale
```

ui-craft shipped the same rule as Strongest-10 tell #9, flagged **HIGH on
presence, with no remediation**. Its 0.3.0 audit found the consequence:

> The catalogue told designers to strip responsive typography. Strongest-10
> entry #9 flagged any responsive type scale as a presence-flaggable HIGH tell
> with no remediation.

A designer or agent obeying that rule deletes fluid type scaling to clear the
finding, which makes the page **worse** and breaks WCAG 1.4.4. The rule was
supposed to catch *the verbatim Tailwind default triplet as a genericness
signal*, not responsive typography as a category.

ui-craft's fix, which you should port:

- Narrow the match to the **verbatim** default triplet, not any responsive scale.
- Add a remediation pointing at a fluid `clamp()`-based scale.
- Re-grade it as a genericness signal rather than a presence-flaggable HIGH.

ui-craft verified the narrowing with a blind reviewer: it declined to fire on a
hero carrying `text-5xl font-bold` without the verbatim triplet.

**Acceptance:** a fixture with a non-default responsive scale produces no
finding; a fixture with the verbatim triplet still does. Both belong in
`scripts/test/corpus/design/`. Re-run `npm test` and re-commit the baseline.

**Also check for siblings.** That rule was not the only over-broad one in the
family; ui-craft found four inverted or over-broad rules in one audit. Grep
`design-patterns.md` and `frontend-patterns.md` for any rule that flags a
technique whose *correct* use is indistinguishable from its lazy use, and ask
for each: does this have a remediation, and does the remediation make the page
better? A tell with no remediation is a tell that will be "fixed" by deletion.

---

## 2. Port the confidence enum

**Direction: ui-craft → anti-slop, then anti-slop owns it.**

This repo grades findings by rule ID and severity. It has no way to say **"this
is correlated with AI output but I have not proven it is wrong here"** — which
is what most design tells actually are.

ui-craft's four-class enum (`references/review/01-universal-rubric.md`):

| Class | Meaning |
|---|---|
| Hard defect | Objective, should be fixed |
| Quality defect | Strongly justified, alternatives exist |
| **Pattern smell** | Correlated with poor output, not proven here |
| Taste note | Advisory only |

**Pattern smell is the class nearly every design tell in this repo belongs to,**
and its absence is why tells read as accusations. `slop-detector.md` and the
scanner output should both carry it.

Severity and confidence are independent: a Hard defect can be LOW, a Quality
defect can be HIGH. Do not collapse them into one axis.

**Acceptance:** `slop-detector.md` emits a confidence class per finding; the
enum is defined in exactly one file; the scanner's JSON output carries the field.

---

## 3. Port the presence-versus-concentration distinction and the floor rule

**Direction: ui-craft → anti-slop.**

ui-craft's catalogue distinguishes a tell that fires **on presence** (one
occurrence is the finding) from one that fires **on concentration** (the finding
is the density, not the instance). It also carries a floor rule:

> a lone utility-class hit is not a finding

That rule is why ui-craft removed two labels from its own corpus in 0.2.4: a
single `rounded-full` on a non-interactive icon wrapper is not "the same radius
on every interactive control", and a reviewer obeying its own no-double-counting
rule could never have reached the label count.

This repo's scanner is a regex engine; it fires on presence by default. Any tell
whose real signal is density needs an explicit threshold, or it produces a
finding on every file that ever used the technique once.

**Acceptance:** each design tell in `design-patterns.md` is marked presence or
concentration; concentration tells carry a numeric threshold; `rules.mjs`
implements the threshold rather than firing on the first match.

---

## 4. Merge the corpus, and reconcile the two label schemas

**Direction: bidirectional. Decide the owner FIRST — this is the fork risk.**

ui-craft's corpus started as a verbatim copy of the 5 fixtures in
`scripts/test/corpus/design/` and grew to 15. The 10 new ones are authored, not
copied, and several test things this repo cannot currently express:

| ui-craft fixture | Tests |
|---|---|
| `clean-intentional.html` | Clean control: must produce ZERO findings |
| `small-avatar-clean.html` | Clean control (already here) |
| `fluid-adaptive-clean.html` | Clean control for responsive doctrine — the guard against item 1 |
| `presence-single.html` | Presence-vs-concentration |
| `uncommitted-radius.html` | The D1 tell, isolated |
| `token-drift.html` | Hardcoded off-token values |
| `missing-states.html` | Happy-path-only UI |
| `cream-serif-sage.html` | The emerging cream/serif/sage combo |
| `fixed-desktop-shell.html`, `viewport-query-card.html`, `vh-bottom-bar.html` | Responsive failures |

The label schemas differ and cannot be merged mechanically:

```jsonc
// anti-slop: flat, rule-ID keyed, no severity or confidence
{ "file": "design/gradient-hero.html", "modality": "design", "expected": ["purple-blue-gradient"] }

// ui-craft: per-fixture object, tell-ID keyed, carries severity + confidence,
// plus a cleanControlRule with maxIncidentalFindings
{ "file": "gradient-hero.html",
  "expected": [ { "id": "...", "dimension": "anti-ai", "severity": "HIGH",
                  "confidence": "Pattern smell", "title": "...", "tellRef": "V5" } ] }
```

**Recommendation, not a decision — confirm with the operator:** anti-slop keeps
ownership of the corpus and its labels (it is declared the evidence source of
truth and its scoring is more mature: it already gates precision AND recall
against a committed baseline with tolerance, which ui-craft does not). Widen
anti-slop's label schema to carry severity and confidence, import ui-craft's 10
new fixtures, and make ui-craft's `tests/corpus/` a generated view rather than a
second hand-maintained set.

**Do not** import the fixtures without resolving ownership. Two hand-maintained
corpora that started identical is exactly how the drift begins.

**Acceptance:** one corpus; both plugins' gates read from it; `npm test` green;
the baseline re-committed with the new fixtures accounted for.

---

## 5. Port the clean-control discipline

**Direction: ui-craft → anti-slop.**

A clean control is a fixture that must produce **zero** findings. anti-slop has
some (`clean-utility.ts`, `small-avatar-clean.html`, the `context-exception-*`
prose fixtures) but no stated contract around them.

ui-craft formalised it, and learned the hard way why it matters. Twice:

- `clean-intentional.html` was itself a T13 violation (it applied a mono face to
  labels and stats, exactly the tell it was supposed to be clean of), so any
  auditor faithful to the mono directive **failed the gate on the control**.
- `fluid-adaptive-clean.html` used a bare `minmax(16rem, 1fr)` while the
  reference it demonstrates states that the `min(100%, …)` guard "is not
  decoration". A control that violates the doctrine it exists to demonstrate
  teaches the gate to accept the violation.

**The rule to port:** a clean control is not "a file with no tells". It is a file
that *uses the prescribed technique correctly*, so it catches the mirror failure
— a scanner that has learned to match constructs rather than defects. Give it an
explicit `maxIncidentalFindings` tolerance rather than a hard zero, so one
incidental note does not fail the suite.

**And audit the existing controls against current doctrine before trusting
them.** Both of ui-craft's control defects were latent for releases.

---

## 6. Port the evidence rule

**Direction: ui-craft + apple-ui-craft → anti-slop. New capability here.**

Both toolkits now require every review to declare its **evidence mode** and to
return `NOT ASSESSED` rather than a clean verdict on anything the evidence could
not reach.

Two rules matter for this repo:

**The geometry evidence rule.** A claim asserting spatial or numeric precision —
spacing values, target sizes, contrast ratios — needs real geometry: DOM bounding
boxes, element frames, or arithmetic from literals in the source. **A screenshot
is never geometry evidence**, and a contrast claim needs resolved colour values
plus a computed ratio, never a colour sampled from an image. `slop-detector.md`
can currently make a spacing or contrast claim from a screenshot with nothing
stopping it.

**The not-assessed rule.** Dimensions that need a sequence, a configuration
change, or a measurement cannot be judged from one static artifact. Reporting
them clean from static evidence is a false negative on exactly the class static
evidence cannot contain. For this repo the analogue is narrower but real: the
scanner sees one file at a time and cannot judge cross-file consistency,
component coherence, or state completeness. It should say so rather than imply a
clean bill.

**Acceptance:** `slop-detector.md` states its evidence mode and coverage as the
first line of its report; unmeasured spatial claims are downgraded rather than
asserted.

---

## 7. Import the iOS and native tells

**Direction: apple-ui-craft → anti-slop. New coverage here.**

`design-patterns.md` and `frontend-patterns.md` are web-centric: Tailwind,
shadcn, CSS, React. anti-slop's own corpus has Swift and Go fixtures for *code*
tells, but no native **design** tells at all.

apple-ui-craft carries native equivalents worth importing as a new reference
(suggest `skills/anti-slop/references/native-ui-patterns.md`):

- `references/patterns/01-gotchas-anti-patterns.md` — the SwiftUI anti-pattern set
- `references/usability/05-adaptive-review-method.md` — fixed geometry as the
  native analogue of a fixed-pixel shell (`.frame(width:)` on content,
  `UIScreen.main.bounds`, `UIDevice.current.userInterfaceIdiom` branching)
- `references/review/03-density-and-economy.md` — the stretched-phone-on-iPad
  pattern, which is the native form of "template layout ignoring the viewport"

Keep them in a separate file from the web tells. A scanner rule that fires
`.frame(width:` on a CSS file, or `text-4xl` on a Swift file, is worse than no
rule.

---

## 8. Port the density and economy dimension

**Direction: either toolkit → anti-slop. New capability here.**

Every rule in this repo is a rule against **excess**: too many buzzwords, too
many em dashes, too much gradient. Neither this repo nor either toolkit had a
rule against **waste** until 2026-07-27, and a page can pass every anti-slop rule
while using half the window and three times the scroll it needs.

`references/review/05-density-and-economy.md` (ui-craft) and
`references/review/03-density-and-economy.md` (apple-ui-craft) carry thresholds
and measurement recipes. The key discipline to preserve:

> Waste with no measurement attached is a taste note. With a measurement it is
> MEDIUM or HIGH.

That is why the pattern went un-actioned for eight releases in apple-ui-craft: it
was listed as an anti-pattern with no number, so no reviewer could rank a
well-rendered page as broken. Do not import the prose without the thresholds.

---

## 9. Port the two infrastructure gates

**Direction: apple-ui-craft → anti-slop. Cheap, high value.**

**Link integrity** (`tests/check-references.mjs`, ~120 lines, zero deps). Verifies
every `references/<path>.md#anchor` citation resolves to a real file and a real
heading, and warns about reference files nothing cites. It caught two broken
citations on its first run in apple-ui-craft, one pre-existing.

This repo has 10 reference files that cite each other and a skill that points at
all of them. A citation that does not resolve is a **silent** capability loss:
the agent follows the pointer, finds nothing, and degrades without reporting it.
This is a ~20-minute port and it should be in `npm test`.

**A scorer selftest.** apple-ui-craft's `tests/harness/selftest.mjs` (46 cases)
and `ci/selftest.mjs` (30 cases) exist because a gate nobody tests can silently
pass everything. `scripts/test/corpus.test.mjs` gates precision and recall
against a baseline but nothing verifies the scorer's own logic — that one finding
cannot claim two labels, that a substanceless finding is not a hit, that a clean
control failure is counted. Worth adding.

---

## What NOT to port, and why

Checked and rejected. Do not spend time re-deriving these.

| Item | Why not |
|---|---|
| ui-craft's finding **format** wholesale | This repo's scanner emits machine JSON consumed by a dashboard; the toolkits' format is a human-readable report shape. Port the **fields** that add signal (confidence, evidence) and not the layout |
| The CI verdict gate (`ci/gate.mjs`) | Built for a plugin that produces a per-PR verdict artifact. This repo already gates in `npm test`, which is the right shape for a scanner |
| The review ledger | Delta-between-runs is meaningful for a multi-dimension review. The scanner already has `stats.mjs` and a dashboard with score history, which covers the same need natively |
| The dimension registry | Both toolkits need it because five agents merge output. This repo has one scanner and one agent |
| The WCAG 2.2 mapping | Accessibility auditing is not this plugin's job. `ios-code-review` and both UI toolkits own it |
| apple-ui-craft's vault-degradation rule | This repo has no external-vault dependency. Verified: zero `~/Claude/vault` references |

---

## Verification and ship checklist

```bash
cd ~/Dev/anti-slop/anti-slop/scripts && npm test          # the existing gate; must stay green
```

Then, per this repo's own doctrine in `docs/rankings-refresh.md`:

1. Run the full suite even for docs-only changes.
2. Keep the em-dash delta at zero; add none of your own.
3. Avoid banned vocabulary in your own voice — the scanner will tell you.
4. Re-commit `scripts/test/corpus/baseline.json` if fixtures or rules changed,
   and say in the commit message which direction precision/recall moved.
5. **Update `docs/rankings-refresh.md` § Downstream sync** with the per-item
   ownership decisions from section 0. That section currently describes a
   one-way flow that this work makes untrue.
6. Version bump: this repo is at 1.6.0. Items 1 and 3 change what the scanner
   reports, so they are a minor bump, not a patch.

**Commit convention:** this fleet uses plain commit messages. Note that
`443576a` in this repo carries a `Co-Authored-By` trailer; that is historical and
not the convention to follow.

---

## Open questions for the operator

Do not guess these. They change the shape of the work.

1. **Corpus ownership (item 4).** One corpus owned here with the toolkits reading
   it, or three corpora with a documented sync? The recommendation above is one
   corpus owned here, but it is the operator's call and it is irreversible in
   practice.
2. **Does the scanner gain a confidence field, or only the agent?** Adding it to
   `rules.mjs` output changes the dashboard's data shape and any consumer of it.
3. **Native tells (item 7): new reference file, or a section in the existing
   design-patterns?** A separate file keeps web and native rules from firing on
   each other's files, at the cost of one more file to keep in sync.
4. **Is item 1 urgent enough to ship on its own?** It is a live rule telling
   people to delete responsive typography. It could go out as a patch today,
   ahead of everything else here.

---

## Provenance

Both toolkit releases were produced in a single session on 2026-07-27 and their
CHANGELOGs are the detailed record: `~/Dev/ui-craft/CHANGELOG.md` (0.3.0) and
`~/Dev/apple-ui-craft/CHANGELOG.md` (0.3.0 and 0.3.1).

Three cross-project learnings from that session are in goodmem Learnings
(`019d5c1b-2aaa-716b-aefa-1ca63d0716d1`), and the third is the one that produced
most of this document:

- `019fa45c-f373-70e3-9bad-f6e05e3f858e` — a rubric whose every dimension is
  judgeable from one static frame cannot see flow defects; and waste needs a
  number or it dies in triage.
- `019fa45c-f373-70e3-9bad-f6e05e3f858d` — scrub and publish gates must scan the
  tracked tree, not the working directory.
- `019fa45c-f373-70e3-9bad-f6e05e3f858c` — bash `${VAR:+flag}` fires when
  `VAR=0`, which silently turned an rsync into a permanent dry run.

**One caveat on this document's own reliability.** The file counts, versions and
line numbers were measured on 2026-07-27. The claim in item 1 about
`design-patterns.md:448` was verified by grep against this repo at `443576a`. The
claim that ui-craft's blind reviewer confirmed the narrowing is taken from that
repo's 0.3.0 CHANGELOG and was not independently re-run. Everything in section 0's
"verified state" table was measured; everything attributed to a CHANGELOG is
reported, not re-verified.
