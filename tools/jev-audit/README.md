# Jev audit of the plugin's instruction surfaces

A maintainer tool, not shipped: everything under `anti-slop/` is distribution, and this
directory sits outside it on purpose. It scores every area of the plugin with TypeSafe's
Jev model (typed judgments with calibrated probabilities; it never generates text) to find
weak sections, gaps, and instructions that would push a model toward worse output or fence
off a legitimate choice. First run 2026-09-22 for 2.4.0; the changelog entry for that
release records what it found and what changed.

## What it scores

| Battery | Unit | Questions |
|---|---|---|
| `sections` | every heading-delimited chunk of SKILL.md, the agent, the command, and the 13 references (about 350) | eleven yes/no conditions (forbids a legitimate choice, worse if followed literally, names no alternative, unclear boundary, no reason, internal conflict, padding, cosmetic graded as a defect, needs an input it does not supply, absolute rule with an unstated exception, gives a method) plus a three-level action score: leave, edit, rewrite |
| `words` | every row of `banned-words.md` | is it ordinary English; does the suggested replacement lose meaning |
| `phrases` | every entry of `banned-phrases.md` | is it ordinary English; does deleting it change the sentence |
| `rules` | every scanner rule in `rules.mjs` | does the description name a fix; is every match a defect; what it costs if real; would a reader understand it from the description alone |
| `pairs` | hand-picked passages in two files that might disagree (`pairs.mjs`) | do they conflict in the named situation; does the reader need a tiebreak sentence |
| `gaps` | a roster of failures agentic development commonly ships (`candidates.mjs`) against a summary of every section | does any section address it; is it inside the stated scope |

The questions live in `questions.mjs` as named constants, per the Jev design notes: one
narrow condition per question, literal wording, criteria that agree with the instruction,
score levels that describe situations, and thresholds kept in one place. Read the results
as a screen, not a verdict: Jev is mid-tier accuracy at near-zero cost, the section battery
reads each chunk in isolation (a file's one-line preamble scores badly on its own), and
every flagged item was checked by hand before it became an edit.

## Running it

```bash
export TYPESAFE_API_KEY=...        # never commit it; the repo's .gitignore excludes out/ and cache/
cd tools/jev-audit
node audit.mjs before              # all six batteries; writes out/before/report.md
# edit the plugin
node audit.mjs after               # unchanged chunks come from cache/, so only edits re-bill
node audit.mjs after rules         # one battery
JEV_FRESH=1 node audit.mjs after   # bypass the cache to measure jitter
```

A full run is about 450 requests and 600,000 input tokens on `jev-1.13.0`, which costs a
few cents and takes under two minutes at four concurrent requests. The model id is pinned in
`questions.mjs`; the script warns if the API resolves a different version, because tuned
thresholds drift across releases. Probabilities move about 0.03 between identical calls, so
the report keeps a review band (0.45 to 0.65) around the 0.65 flag line and a before/after
comparison should only read a change larger than that.

When a passage named in `pairs.mjs` is rewritten, its `locate` string has to be repointed
at the new paragraph; the script fails loudly on a stale locator rather than skipping it.
