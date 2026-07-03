# Labeled corpus + precision/recall harness

A small, hand-labeled set of prose/code/design samples with ground-truth expected findings,
used as a test harness to measure the scanner's precision and recall instead of just checking
that a handful of individual rules fire on individual inputs (that is what `scanner.test.mjs`
already does).

## Layout

- `prose/`, `code/`, `design/` -- sample files. Design samples may live here OR reference the
  shared UI fixtures in `../fixtures/*.html` (do not duplicate or edit those files -- they are
  owned by `scanner.test.mjs`).
- `labels.json` -- an array of `{ file, modality, expected }` records. `file` is a path
  relative to this directory (so `../fixtures/before.html` is valid). `expected` is the list
  of rule names a correct scan of that file should produce -- `[]` means "must scan clean".
  Rule names use the same key convention as the dashboard: `v.name || v.word || v.phrase ||
  v.type` (e.g. a banned word's name IS the word itself, a banned phrase's name IS the phrase,
  everything else uses its rule `name`).
- `baseline.json` -- a committed snapshot of `node measure.mjs --format json`'s `rules`,
  `modalities`, and `overall` fields, captured against the scanner at the time the baseline was
  last regenerated. This is an honest MEASUREMENT, not a target: if the scanner has false
  positives or false negatives against this corpus, the baseline records them as-is.

## Running the harness

```bash
cd anti-slop/scripts
npm run measure                    # human-readable table: per-rule, per-modality, overall
npm run measure -- --format json   # machine-readable, same shape as baseline.json plus `misses`
```

`measure.mjs` always exits 0 -- it is a measurement tool, not a CI gate. The gate lives in
`corpus.test.mjs` (run by `npm test` like every other suite; bare `node --test` breaks because Node's recursive discovery executes the corpus code samples as bogus suites): it re-measures and
asserts precision and recall have not dropped by more than 0.02 below the committed baseline,
overall and per modality.

## Adding a sample

1. Write the file under `prose/`, `code/`, or `design/` (or point at `../fixtures/*.html` for
   design). Use realistic, self-authored, or rule-derived content -- never copy real
   third-party text or a real secret.
2. Add an entry to `labels.json` with the modality and your best honest guess at
   `expected` -- the rule names a careful human reviewer would say this file legitimately
   trips (or `[]` for a clean file).
3. Run `npm run measure -- --format json` and check the `misses` array for your new file. If
   the actual scan differs from your guess, decide which is right:
   - If your `expected` was wrong (you mis-predicted a regex, or missed an interaction like
     `skipInTests` or a `suppress` guard) -- fix `labels.json`, not the scanner.
   - If the scanner is genuinely wrong (a real false positive/negative) -- leave `expected` at
     the correct ground truth and let it register as a miss. That is the point of this harness:
     surfacing rule-tuning candidates, not hiding them. Do not tune scanner rules from this
     package (they belong to `lib/rules.mjs`/`lib/scan.mjs`) -- write the finding down for
     whoever owns that follow-up work instead.
4. Run the full suite (`npm test`). `corpus.test.mjs` will only fail if your change moved
   overall or per-modality precision/recall down by more than the 0.02 tolerance -- a single
   added clean negative or a new true positive should not trip it.

Two path traps worth knowing:
- Code samples are scanned under the exact path you put in `labels.json`. Positives that rely
  on `skipInTests`-gated rules (`innerHTML`, hardcoded secrets, boilerplate markers) need a
  **non**-test-looking path (e.g. `code/auth-handler.js`) to actually fire; a deliberately
  test-shaped path (e.g. `code/auth.test.js`) is how you build a *tricky-clean negative* that
  proves the skip works.
- The design/code pattern rules match **per line**, not across the whole file. A realistic
  multi-line construct (e.g. a `useEffect` whose body sets state a few lines down) can be a
  genuine miss for that reason -- see `code/user-profile-widget.jsx` in `labels.json`, which is
  exactly such a case and is recorded as a known false negative in `baseline.json`.

## Regenerating the baseline

Only regenerate when a rule change to `lib/rules.mjs`/`lib/scan.mjs` was an intentional,
reviewed change to detection behavior (not to make this test pass). Regenerate honestly:

```bash
cd anti-slop/scripts
node --input-type=module -e '
import { measure } from "./measure.mjs";
import { writeFileSync } from "fs";
const result = measure();
const baseline = { rules: result.rules, modalities: result.modalities, overall: result.overall };
writeFileSync("test/corpus/baseline.json", JSON.stringify(baseline, null, 2) + "\n");
'
```

Then diff `git diff test/corpus/baseline.json` and read every rule/modality that moved before
committing -- a baseline regeneration should be reviewed exactly like a scanner rule change,
because it is one: it changes what "no regression" means going forward.
