import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, relative, sep } from "node:path";
import { scanContent } from "../lib/scan.mjs";
import { ruleName } from "../measure.mjs";

// ── The plugin scanned by its own scanner ────────────────────────────────────
// The repo has always required a dogfood scan of any edited markdown, compared against
// the counts before the edit. That is a manual step, which means it is a step that gets
// skipped. This turns it into a gate: every shipped .md file, one committed count each.
//
// The snapshot is deliberately NOT asserted as "all zero". The reference files document
// the vocabulary they ban, and a file that has to quote a tell in running prose to explain
// it is allowed to carry the finding -- as long as the number is written down here and
// changes on purpose. Today every shipped file is at 0; the shape below survives the day
// one of them is not.

const PLUGIN_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const SHIPPED_DIRS = ["skills", "agents", "commands", "docs"];

const EXPECTED_FINDINGS = {
  "agents/slop-detector.md": 0,
  "commands/slop-check.md": 0,
  "docs/rankings-refresh.md": 0,
  "skills/anti-slop/SKILL.md": 0,
  "skills/anti-slop/references/banned-phrases.md": 0,
  "skills/anti-slop/references/banned-words.md": 0,
  "skills/anti-slop/references/choosing-with-intent.md": 0,
  "skills/anti-slop/references/code-patterns.md": 0,
  "skills/anti-slop/references/confidence-and-evidence.md": 0,
  "skills/anti-slop/references/density-and-economy.md": 0,
  "skills/anti-slop/references/design-patterns.md": 0,
  "skills/anti-slop/references/empirical-rankings.md": 0,
  "skills/anti-slop/references/frontend-patterns.md": 0,
  "skills/anti-slop/references/native-ui-patterns.md": 0,
  "skills/anti-slop/references/regression-patterns.md": 0,
  "skills/anti-slop/references/self-check.md": 0,
  "skills/anti-slop/references/writing-patterns.md": 0,
};

function shippedMarkdown() {
  const found = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (entry.name.endsWith(".md")) found.push(relative(PLUGIN_ROOT, path).split(sep).join("/"));
    }
  };
  for (const dir of SHIPPED_DIRS) walk(join(PLUGIN_ROOT, dir));
  return found.sort();
}

test("the snapshot covers exactly the markdown this plugin ships", () => {
  // Without this, adding a reference file would silently escape the gate: the loop below
  // only checks files the snapshot already names.
  assert.deepEqual(
    shippedMarkdown(),
    Object.keys(EXPECTED_FINDINGS).sort(),
    "a shipped .md file was added or removed -- scan it and record its count in EXPECTED_FINDINGS",
  );
});

test("every shipped markdown file matches its recorded finding count", () => {
  for (const file of shippedMarkdown()) {
    const violations = scanContent(readFileSync(join(PLUGIN_ROOT, file), "utf8"), file);
    assert.equal(
      violations.length,
      EXPECTED_FINDINGS[file],
      `${file} now scans ${violations.length} findings, snapshot says ${EXPECTED_FINDINGS[file]}: ` +
        `${JSON.stringify(violations.map(ruleName))}.\n` +
        "If the edit was deliberate and the finding is correct (a reference file quoting a tell " +
        "in running prose), update the number here. Otherwise fix the prose -- never the snapshot.",
    );
  }
});

// A snapshot of zeros passes just as well when the scan is broken, the path is wrong, or
// the walker found nothing. Prove the same code path still reports on the same surface.
test("the dogfood path has teeth: slop in a shipped-shaped file is still found", () => {
  const slop = "# Overview\n\nIt's not just fast, it's transformative. Let's dive in and delve " +
    "into the tapestry of options :contentReference[oaicite:1]{index=1}.\n";
  const violations = scanContent(slop, "skills/anti-slop/references/probe.md");
  assert.ok(violations.length >= 4, `expected the scanner to report on a shipped-shaped path, got ${violations.length}`);
  assert.ok(violations.map(ruleName).includes("model-tooling-artifact"));
});
