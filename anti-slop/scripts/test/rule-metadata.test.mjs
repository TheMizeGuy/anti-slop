import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  CONFIDENCE,
  CONFIDENCE_CLASSES,
  PRESENCE,
  CONCENTRATION,
  DESIGN_PATTERNS,
  CODE_PATTERNS,
  TEXT_CONSTRUCTS,
  NATIVE_PATTERNS,
} from "../lib/rules.mjs";
import { scanContent } from "../lib/scan.mjs";

const REPO = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const DOCTRINE = join(REPO, "skills", "anti-slop", "references", "confidence-and-evidence.md");

const ALL_TABLE_RULES = [...DESIGN_PATTERNS, ...CODE_PATTERNS, ...TEXT_CONSTRUCTS, ...NATIVE_PATTERNS];

test("the confidence enum carries exactly the four classes", () => {
  assert.deepEqual(CONFIDENCE_CLASSES, [
    "Hard defect",
    "Quality defect",
    "Pattern smell",
    "Taste note",
  ]);
});

// The enum's doctrinal home is the reference file; rules.mjs is its machine mirror. This
// is what keeps "defined in exactly one file" true rather than aspirational -- renaming a
// class in either place without the other fails here.
test("the code enum mirrors the doctrine file, which is its single definition", () => {
  const doctrine = readFileSync(DOCTRINE, "utf8");
  for (const cls of CONFIDENCE_CLASSES) {
    assert.ok(
      doctrine.includes(cls),
      `confidence class "${cls}" is in rules.mjs but not defined in references/confidence-and-evidence.md`,
    );
  }
  // And nothing extra: a class defined in the doc but absent from the enum is the same drift.
  const declared = [...doctrine.matchAll(/^\|\s*\*\*(.+?)\*\*\s*\|/gm)].map((m) => m[1].trim());
  assert.deepEqual(
    declared.filter((d) => CONFIDENCE_CLASSES.includes(d)).sort(),
    [...CONFIDENCE_CLASSES].sort(),
    `doctrine table declares ${JSON.stringify(declared)}, enum carries ${JSON.stringify(CONFIDENCE_CLASSES)}`,
  );
});

test("every table-driven rule declares a valid confidence class", () => {
  for (const rule of ALL_TABLE_RULES) {
    assert.ok(
      CONFIDENCE_CLASSES.includes(rule.confidence),
      `rule "${rule.name}" has confidence ${JSON.stringify(rule.confidence)}, which is not one of the four classes`,
    );
  }
});

test("every design and native tell declares presence or concentration", () => {
  for (const rule of [...DESIGN_PATTERNS, ...NATIVE_PATTERNS]) {
    assert.ok(
      rule.mode === PRESENCE || rule.mode === CONCENTRATION,
      `tell "${rule.name}" declares mode ${JSON.stringify(rule.mode)}; expected "presence" or "concentration"`,
    );
    if (rule.mode === CONCENTRATION) {
      assert.ok(
        Number.isInteger(rule.minCount) && rule.minCount >= 2,
        `concentration tell "${rule.name}" needs an integer minCount >= 2, got ${JSON.stringify(rule.minCount)}`,
      );
    } else {
      assert.equal(rule.minCount, undefined, `presence tell "${rule.name}" must not carry a minCount`);
    }
  }
});

// Severity and confidence are independent axes. If every high-severity rule were also a
// Hard defect the enum would be a second name for severity and would carry no information.
test("severity and confidence are independent axes", () => {
  const highSmell = ALL_TABLE_RULES.filter(
    (r) => r.severity === "high" && r.confidence === CONFIDENCE.SMELL,
  );
  assert.ok(
    highSmell.length > 0,
    "expected at least one high-severity Pattern smell (a costly finding the scanner cannot prove)",
  );
});

test("every emitted violation carries a confidence class", () => {
  const samples = [
    ["Let's dive in. In today's fast-paced world, we delve into the tapestry.", "post.md"],
    ["const password = \"hunter2hunter2\";\neval(userInput);\n", "src/auth.js"],
    ['<div class="bg-gradient-to-r from-purple-500 to-blue-500 bg-clip-text text-transparent">Hi</div>', "page.html"],
    [".frame(width: 320)\nlet w = UIScreen.main.bounds.width\n", "View.swift"],
  ];
  for (const [content, path] of samples) {
    const violations = scanContent(content, path);
    assert.ok(violations.length > 0, `expected findings for ${path}`);
    for (const v of violations) {
      assert.ok(
        CONFIDENCE_CLASSES.includes(v.confidence),
        `violation ${JSON.stringify(v)} from ${path} is missing a valid confidence`,
      );
    }
  }
});

// A rule firing on the wrong platform is worse than no rule: it teaches the user the
// scanner does not understand their file.
test("web design tells never fire on native sources", () => {
  const swift = `
    Text("Build Better Faster")
      .font(.system(size: 34))
      .background(Color(hex: "#6366f1"))
    // text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight
  `;
  const names = scanContent(swift, "HeroView.swift").map((v) => v.name);
  for (const design of DESIGN_PATTERNS) {
    assert.ok(!names.includes(design.name), `web tell "${design.name}" fired on a .swift file`);
  }
});

test("native tells never fire on web sources", () => {
  const html = `
    <div style="width: 320px">.frame(width: 320) UIScreen.main.bounds</div>
  `;
  const names = scanContent(html, "page.html").map((v) => v.name);
  for (const native of NATIVE_PATTERNS) {
    assert.ok(!names.includes(native.name), `native tell "${native.name}" fired on an .html file`);
  }
});
