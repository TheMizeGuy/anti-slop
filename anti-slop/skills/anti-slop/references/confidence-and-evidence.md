# Confidence and Evidence

How sure a finding is, and what has to be true before it can claim a number.

Two rules live here, and nothing else restates them. The scanner's rule table
(`scripts/lib/rules.mjs`) mirrors the confidence enum below in code, and
`test/rule-metadata.test.mjs` fails if the two ever carry different classes.

## Confidence classes

Severity says what a finding costs if it is real. Confidence says how sure we
are that it is real *here*. They are independent axes and must never be
collapsed into one.

| Class | Meaning | Typical source |
|---|---|---|
| **Hard defect** | Objective, should be fixed | Swallowed exception, `eval()`, unfinished `// rest of your code` stub, an `<img>` with no dimensions |
| **Quality defect** | Strongly justified, alternatives exist | `!important` instead of fixing specificity, a narrating comment, a fixed content frame |
| **Pattern smell** | Correlated with generated output, **not proven wrong here** | Almost every design tell, every banned word, the AI purple palette |
| **Taste note** | Advisory only | A horizontal-rule divider between sections |

**Pattern smell is the class most design tells belong to,** and its absence is
why a tell reads as an accusation. "This gradient is the Tailwind default" is a
true statement about correlation. "This gradient is wrong" is a claim the
scanner cannot support. The class is what keeps the first from being read as the
second.

The pairing that proves the axes are independent: `hardcoded-secret` is
**severity high, confidence Pattern smell**. If the match is a live credential
it is the worst finding in the file; a regex cannot prove it is not a fixture, a
variable name, or a placeholder. Downgrading the severity would understate the
risk and upgrading the confidence would be a lie, so it carries both.

## Presence and concentration

A regex fires on presence by default. Most property-level tells are only tells
when repeated, so each one declares which it is:

- **Presence** -- one occurrence is the finding. Reserved for specific, high-signal
  compositions: a verbatim default string, a named component fingerprint.
- **Concentration** -- the finding is the density. Carries a numeric threshold, and
  says nothing below it.

**The floor rule: a lone utility-class hit is not a finding.** One
`rounded-full` on an icon wrapper is not "the same radius on every interactive
control". One cream background is not the cream-serif-sage combination. The
signal is a default reached for repeatedly and without a point of view, never
the presence of any single class.

## The remediation floor

Several tells describe the *default expression* of something the interface
genuinely needs: a responsive type scale, container padding, a focus ring, a
loading state, a reduced-motion block. For every one of these the cheapest way
to make the tell stop matching is to delete the behaviour, and that is always
the wrong answer.

1. **Every finding names its remediation.** A finding that only names the offence
   is incomplete, and an incomplete finding gets closed by deletion.
2. **A remediation may never reduce responsiveness, keyboard reachability,
   screen-reader output, contrast, hit-target size, or motion-preference
   handling.** If the only way to clear a tell is to make one of those worse, the
   remediation is wrong -- and so, usually, is the match.

Concretely: the fix for a stepped `text-4xl sm:text-5xl lg:text-6xl` ramp is a
fluid `clamp()` ramp, never a fixed size. The fix for a default focus ring is a
better focus ring, never `outline: none`. The fix for `* { transition: none
!important }` inside a `prefers-reduced-motion` block is nothing at all -- that is
the correct implementation of WCAG 2.3.3, and a scanner that flags it is asking
for an accessibility regression.

When adding a rule, ask: *does this have a remediation, and does the remediation
make the page better?* If a technique's correct use is indistinguishable from
its lazy use, the rule is too wide. Narrow the match until it is not.

## Evidence modes

Every review states which mode produced it, as the first line of the report.

| Mode | Available | Can support |
|---|---|---|
| Static single-file | One file's source | Vocabulary, constructs, per-file patterns |
| Static multi-file | The tree or the diff | The above, plus cross-file consistency and component coherence |
| Screenshot | A rendered image | Composition and content; **no geometry** |
| Runtime | A running app with tooling | Everything, including measured geometry |

## The geometry evidence rule

A claim asserting spatial or numeric precision -- spacing values, alignment
offsets, target sizes, contrast ratios, layout-shift distances -- needs real
geometry:

| Surface | Acceptable evidence |
|---|---|
| Web | DOM bounding boxes, computed styles, layout metrics |
| Apple | Element frames from a hierarchy snapshot |
| Any | Arithmetic from numeric literals quoted out of the source |

**A screenshot is never geometry evidence.** Estimating distances from pixels is
unreliable. A contrast claim needs resolved colour values and a computed ratio,
never a colour sampled from an image.

Without geometry, the claim is capped at "possible issue, measurement needed"
and must be stated that way rather than asserted.

## The not-assessed rule

Report `NOT ASSESSED` rather than a clean verdict on anything the evidence could
not reach. Reporting a dimension clean from evidence that cannot contain it is a
false negative on exactly the class that evidence is blind to.

For the deterministic scanner this is narrow but real. It reads one file at a
time and therefore cannot judge:

- cross-file consistency (the same component styled three ways in three files)
- component coherence against a design system defined elsewhere
- state completeness (the empty, error, and loading states may live in sibling files)
- task flow, navigation, and error recovery, which need a sequence, not a file
- anything requiring a rendered frame or a measurement

A clean scan means "no rule matched in this file", which is a smaller claim than
"this file is good". Say the smaller thing.
