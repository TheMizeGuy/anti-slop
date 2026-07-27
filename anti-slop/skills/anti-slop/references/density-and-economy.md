# Density and Economy

The dimension that catches WASTE rather than BREAKAGE.

## Why this file exists

Every other rule in this plugin is a rule against excess: too many buzzwords, too many em
dashes, too much gradient, too many `!important`s, shadows on everything. All of them
describe output doing too much of something.

None of them describes an interface doing too little with what it was given. A page can
pass every rule in `design-patterns.md` and `frontend-patterns.md` and still waste half the
display, take three screens to say what fits on one, and put a button two thousand pixels
from the row it acts on. Nothing overlaps. Nothing clips. Nothing scrolls sideways. Every
check is green and the interface is still bad.

That gap is not hypothetical. It shipped: an admin dashboard cleared eight parallel
specialist reviews and 121 pull-request findings, and then its owner opened it and asked,
in order, why it did not use the window, why there were walls of text, why the pages were
endless with nothing collapsible, and why the buttons were where they were. The
measurements below are from that page.

**A review that only looks for breakage will approve any amount of waste.**

## The rule that makes it actionable

> Waste with no measurement attached is a taste note. With a measurement it is MEDIUM or
> HIGH.

This is the whole discipline, and skipping it is why the pattern went un-actioned for eight
releases in the toolkit it came from: it was listed as an anti-pattern with no number, so
no reviewer could rank a well-rendered page as broken. The severity scale everywhere else
is anchored on breakage -- CRITICAL is "blocks use", HIGH is overlapping controls -- and a
defect that renders perfectly cannot climb that ladder on its own. A reviewer applying it
honestly lands on "taste", which does not survive triage.

Rank waste by **how much of the operator's screen or time it costs**, and carry the number:

- Over a third of the viewport, a page more than twice as long as it needs to be, or an
  action a person cannot associate with its object: **HIGH**.
- A bounded cost, such as a section that should be folded or a paragraph that should be two
  sentences: **MEDIUM**.
- "I would have laid this out differently", with no measurement: **genuinely a taste note**,
  and it belongs in that bucket. That boundary is what keeps the rest credible.

Confidence class: waste with a measurement is a **Quality defect**; without one it is a
**Taste note**. See `confidence-and-evidence.md`.

## Thresholds

Review thresholds, not design law. Each is a finding when exceeded AND the exemption does
not apply.

### Viewport utilisation

Measure at the widest viewport reviewed, and at 1920px.

| Condition | Severity |
|---|---|
| Content occupies < 60% of viewport width, with no second column, sidebar, or reading-measure reason | HIGH |
| 60-75% with no justification | MEDIUM |
| Capped at a reading measure (~65-75ch) and the content IS prose | Not a finding. Correct |
| Capped at a reading measure, but the content is tabular or a dashboard | HIGH |

The prose exception is the whole subtlety. A reading measure is right for an article and
wrong for a table, and the failure above happened because one `--measure` token served
both: a value sized like prose was capping a ledger. When a page holds both, they need
separate measures.

**Centring is not a fix.** Splitting 1008px of dead space into two 504px gutters is the
same waste, symmetrically arranged. If the recommendation for dead space is
`margin-inline: auto`, the finding was misdiagnosed.

### Internal distribution

| Condition | Severity |
|---|---|
| One column or child absorbs > 40% of a container's width without needing it | HIGH |
| Any element sized by the LEFTOVER whose content has a known maximum | HIGH. Flag the mechanism, not just the pixels |

The second row generalises. `margin-right: auto` on a field and an unsized column in a
`table-layout: fixed` are the same bug: a box whose size is whatever is left over. It looks
deliberate at the width it was authored against and grows without limit at every larger
one. **Grep for the mechanism**: `margin-*: auto`, `flex: 1` beside fixed siblings, unsized
columns in a fixed table, `1fr` with no `minmax`. The SwiftUI form is `Spacer()`; see
`native-ui-patterns.md`.

### Page economy

| Condition | Severity |
|---|---|
| Same entity list rendered more than twice on one screen | HIGH |
| Any single section > 40% of total page height and not the primary read | HIGH |
| Page > 2x viewport height with zero collapsed or disclosed sections | MEDIUM |
| Reference or administrative content expanded by default above the primary task | MEDIUM |

Ask what the operator came for and whether it is above the fold. On the page above they
came for the channel figures, and 45% of the document was a registry listing the same
channels a third time.

**A collapse must never hide an alert.** Fault warnings, destructive-action confirmations
and anything time-critical stay outside the fold. A disclosure that hides a fault is worse
than the scroll it saved.

### Copy economy

| Condition | Severity |
|---|---|
| Any visible paragraph > 30 words in a control surface (dashboard, settings, form) | MEDIUM, or HIGH at three or more |
| Explanatory prose above the primary data on first paint | MEDIUM |
| A qualifying clause that could sit behind a disclosure without loss | LOW each, MEDIUM as a pattern |

30 words is about three lines at a 35em measure. Marketing and documentation surfaces are
exempt; this is about interfaces where the words sit between an operator and their task.

**Long UI copy is accretion, not one bad writer.** Each review round that found a figure
potentially misleading answered by ADDING a clause, and no round ever removed one, because
no reviewer was scored on the total. The fix is lead-plus-disclosure, not deletion: the
qualifications were correct and hard-won, they just do not belong in front of the control.

### Action placement

| Condition | Severity |
|---|---|
| Row action > 800px from its row's identity at the review viewport | HIGH |
| Controls scoping the same object separated by > 400px of empty space | HIGH |
| Action controls inside a `<nav>` landmark that do not navigate | MEDIUM (also an accessibility finding) |
| Primary and destructive actions with no visual rank | MEDIUM |

The distances are viewport-relative in spirit: what matters is whether a person can hold
the association without tracking across the screen. Report the measured distance, always.

## How to measure

Do not eyeball this. Run it, and quote the numbers in the finding. A density claim without
geometry is exactly the "the layout feels empty" note that gets dismissed as taste, which
is how this class survived review in the first place. A screenshot is never geometry
evidence (`confidence-and-evidence.md`).

```js
// Viewport utilisation and page economy
const main = document.querySelector('main') || document.body;
const used = main.getBoundingClientRect().width;
({
  utilisation: `${Math.round((used / innerWidth) * 100)}%`,
  unused: innerWidth - used,
  pageHeight: document.documentElement.scrollHeight,
  screens: +(document.documentElement.scrollHeight / innerHeight).toFixed(1),
  disclosures: document.querySelectorAll('details').length,
});
```

```js
// Action distance: every row action against its row's identity
[...document.querySelectorAll('tr')].flatMap((tr) => {
  const id = tr.querySelector('th, td:first-child');
  const act = tr.querySelector('button, a.btn, [type=submit]');
  if (!id || !act) return [];
  return [{
    row: id.textContent.trim().slice(0, 20),
    gap: Math.round(act.getBoundingClientRect().x - id.getBoundingClientRect().x),
  }];
});
```

```js
// Copy economy: visible paragraphs by word count, disclosures excluded
[...document.querySelectorAll('p')]
  .filter((p) => !p.closest('details') && p.offsetParent !== null)
  .map((p) => ({ words: p.textContent.trim().split(/\s+/).length }))
  .filter((p) => p.words > 30)
  .sort((a, b) => b.words - a.words);
```

None of these run inside the deterministic scanner, which reads one file as text and has no
layout engine. Density is an agent dimension with a runtime evidence requirement, and per
the not-assessed rule a static scan reports it as not assessed rather than clean.

## The check that generalises

For every rule here, ask the inverse of a rule you already have. The catalogue had "lines
longer than 75ch" and no minimum density; "text clipped" and no "space unused"; "controls
overlapping" and no "controls too far apart".

**A one-directional rule catches one direction of failure.** When adding a threshold to any
rubric, write the opposite one at the same time, or record why it does not apply.
