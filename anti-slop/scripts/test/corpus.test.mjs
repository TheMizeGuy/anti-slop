import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { measure } from "../measure.mjs";

// Deterministic regression gate: scanContent + the committed corpus/labels are pure and
// hermetic (no network, no randomness, no wall-clock dependence), so re-running measure()
// here reproduces the exact numbers `npm run measure` would print.

const BASELINE_PATH = join(dirname(fileURLToPath(import.meta.url)), "corpus", "baseline.json");
const baseline = JSON.parse(readFileSync(BASELINE_PATH, "utf8"));

// Small tolerance for noise (a single corpus file's worth of drift), not a license to let
// precision/recall creep downward release over release.
const TOLERANCE = 0.02;

function explain(label, current, base) {
  return (
    `${label} precision/recall regressed vs the committed baseline ` +
    `(current ${JSON.stringify(current)}, baseline ${JSON.stringify(base)}, tolerance ${TOLERANCE}).\n` +
    "If this is an ACTUAL scanner regression: investigate the rule change that caused it " +
    "(run `npm run measure` for the per-rule/per-file breakdown) and fix the rule, not the test.\n" +
    "If this is an INTENTIONAL, reviewed change (a rule was deliberately tightened/loosened, " +
    "or corpus samples were deliberately added/changed): regenerate the baseline honestly with " +
    "`node measure.mjs --format json` (see test/corpus/README.md) -- never hand-edit numbers to " +
    "make this test pass."
  );
}

test("corpus regression gate is deterministic (repeat measurement matches itself)", () => {
  const a = measure();
  const b = measure();
  assert.deepEqual(a, b, "measure() must be pure -- no network, no randomness, no clock dependence");
});

test("overall precision/recall have not regressed below baseline - tolerance", () => {
  const result = measure();
  assert.ok(
    result.overall.precision >= baseline.overall.precision - TOLERANCE,
    explain("Overall precision", result.overall.precision, baseline.overall.precision),
  );
  assert.ok(
    result.overall.recall >= baseline.overall.recall - TOLERANCE,
    explain("Overall recall", result.overall.recall, baseline.overall.recall),
  );
});

test("per-modality precision/recall have not regressed below baseline - tolerance", () => {
  const result = measure();
  const currentByModality = new Map(result.modalities.map((m) => [m.modality, m]));
  for (const baseModality of baseline.modalities) {
    const current = currentByModality.get(baseModality.modality);
    assert.ok(current, `modality "${baseModality.modality}" present in baseline is missing from the current corpus`);
    assert.ok(
      current.precision >= baseModality.precision - TOLERANCE,
      explain(`Modality "${baseModality.modality}" precision`, current.precision, baseModality.precision),
    );
    assert.ok(
      current.recall >= baseModality.recall - TOLERANCE,
      explain(`Modality "${baseModality.modality}" recall`, current.recall, baseModality.recall),
    );
  }
});
