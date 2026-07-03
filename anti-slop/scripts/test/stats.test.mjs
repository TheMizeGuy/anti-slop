import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { scanContent, calculateScore } from "../lib/scan.mjs";
import { computeRuleStats } from "../lib/stats.mjs";

const named = (vs, name) => vs.some((v) => v.name === name);
const active = (vs) => vs.filter((v) => !v.suppressed);
const suppressedOnly = (vs) => vs.filter((v) => v.suppressed === true);

// ── D6: computeRuleStats shapes ──

test("computeRuleStats: splits active vs suppressed per rule, tracks worst severity and lastSeen", () => {
  const log = [
    { word: "delve", severity: "medium", timestamp: "2026-07-01T00:00:00.000Z" },
    { word: "delve", severity: "medium", timestamp: "2026-07-02T00:00:00.000Z" },
    { word: "delve", severity: "medium", suppressed: true, suppressedBy: "escape-hatch", timestamp: "2026-07-03T00:00:00.000Z" },
    { name: "eval-usage", severity: "high", timestamp: "2026-07-01T12:00:00.000Z" },
  ];
  const { rules, totals } = computeRuleStats(log);

  const delve = rules.find((r) => r.rule === "delve");
  assert.ok(delve, JSON.stringify(rules));
  assert.equal(delve.active, 2);
  assert.equal(delve.suppressed, 1);
  assert.equal(delve.worstSeverity, "medium");
  assert.equal(delve.lastSeen, "2026-07-03T00:00:00.000Z", "lastSeen should be the max timestamp across active AND suppressed");

  const evalRule = rules.find((r) => r.rule === "eval-usage");
  assert.equal(evalRule.active, 1);
  assert.equal(evalRule.suppressed, 0);

  assert.equal(totals.active, 3);
  assert.equal(totals.suppressed, 1);
});

test("computeRuleStats: rule key falls back name || word || phrase || type, and worstSeverity beats a lower one regardless of order", () => {
  const log = [
    { phrase: "great question", severity: "medium", timestamp: "t1" },
    { type: "emoji", severity: "low", timestamp: "t2" },
    { word: "delve", severity: "low", timestamp: "t3" },
    { word: "delve", severity: "medium", suppressed: true, timestamp: "t4" },
    { word: "delve", severity: "high", timestamp: "t5" },
  ];
  const { rules } = computeRuleStats(log);
  assert.ok(rules.some((r) => r.rule === "great question"));
  assert.ok(rules.some((r) => r.rule === "emoji"));
  const delve = rules.find((r) => r.rule === "delve");
  assert.equal(delve.worstSeverity, "high", "high beats medium/low regardless of position in the log");
});

test("computeRuleStats: sorted by active+suppressed descending", () => {
  const log = [
    { word: "a", severity: "low", timestamp: "t1" },
    { word: "b", severity: "low", timestamp: "t2" },
    { word: "b", severity: "low", timestamp: "t3" },
    { word: "b", severity: "low", suppressed: true, timestamp: "t4" },
    { word: "c", severity: "low", timestamp: "t5" },
    { word: "c", severity: "low", timestamp: "t6" },
  ];
  const { rules } = computeRuleStats(log);
  const order = rules.map((r) => r.rule);
  assert.deepEqual(order, ["b", "c", "a"], `expected b(3) > c(2) > a(1), got ${order.join(",")}`);
});

test("computeRuleStats: empty log returns empty rules and zero totals", () => {
  const result = computeRuleStats([]);
  assert.deepEqual(result, { rules: [], totals: { active: 0, suppressed: 0 } });
});

test("computeRuleStats: entry with no severity defaults worstSeverity to low, no timestamp leaves lastSeen null", () => {
  const { rules } = computeRuleStats([{ word: "x" }]);
  assert.equal(rules[0].worstSeverity, "low");
  assert.equal(rules[0].lastSeen, null);
});

// ── D6: collectSuppressed default-off parity (A1) ──

test("collectSuppressed default-off: scanContent(content, filePath) and the same call with an empty/false opts object are byte-identical", () => {
  const samples = [
    ["We delve into it. We delve deeper. <!-- anti-slop-allow: kept for tone -->", "a.md"],
    ["// eval(userInput) -- anti-slop-allow: sandboxed\nfunction f() { return 1; }", "a.ts"],
    ['<span class="rounded-full h-8 w-8"></span> <!-- unslop-ignore -->', "a.tsx"],
    ["Clean technical prose about the migration with no tells at all.", "clean.md"],
  ];
  for (const [content, filePath] of samples) {
    const noArg = scanContent(content, filePath);
    const emptyOpts = scanContent(content, filePath, {});
    const explicitFalse = scanContent(content, filePath, { collectSuppressed: false });
    assert.deepEqual(emptyOpts, noArg, `opts={} must be byte-identical to no 3rd arg for ${filePath}`);
    assert.deepEqual(explicitFalse, noArg, `collectSuppressed:false must be byte-identical to no 3rd arg for ${filePath}`);
  }
});

test("collectSuppressed:true never changes the non-suppressed entries vs the 2-arg call", () => {
  const content = "We delve into it. We delve deeper. <!-- anti-slop-allow: kept for tone -->";
  const baseline = scanContent(content, "a.md");
  const withOpt = scanContent(content, "a.md", { collectSuppressed: true });
  assert.deepEqual(active(withOpt), baseline, "active entries must match the default-off scan exactly");
});

// ── D6 (a): escape-hatch suppression across word/phrase/design/code ──

test("escape-hatch: a banned word on a hatched line yields a suppressed banned-word entry", () => {
  const content = "This report is clean. We delve into detail here. <!-- anti-slop-allow: intentional -->";
  const vs = scanContent(content, "a.md", { collectSuppressed: true });
  assert.ok(!named(active(vs), "delve") && !active(vs).some((v) => v.word === "delve"), "delve must not be active (the line is escape-hatched)");
  const hit = suppressedOnly(vs).find((v) => v.type === "banned-word" && v.word === "delve");
  assert.ok(hit, JSON.stringify(vs));
  assert.equal(hit.suppressedBy, "escape-hatch");
  assert.equal(hit.count, 1);
});

test("escape-hatch: a banned phrase on a hatched line yields a suppressed banned-phrase entry", () => {
  const content = "Filler line.\nThat's a great question! <!-- anti-slop-allow: kept as written -->";
  const vs = scanContent(content, "a.md", { collectSuppressed: true });
  assert.ok(!active(vs).some((v) => v.type === "banned-phrase"), "phrase must not be active on an escape-hatched line");
  const hit = suppressedOnly(vs).find((v) => v.type === "banned-phrase" && v.phrase === "great question");
  assert.ok(hit, JSON.stringify(vs));
  assert.equal(hit.suppressedBy, "escape-hatch");
});

test("escape-hatch: a design-tell on a hatched line yields a suppressed design-tell entry, but the suppress-regex guard is NOT counted", () => {
  const pill = '<button class="rounded-full px-6 py-3">Go</button> <!-- anti-slop-allow: brand pill -->';
  const vsPill = scanContent(pill, "a.tsx", { collectSuppressed: true });
  assert.ok(!active(vsPill).some((v) => v.name === "rounded-everything"), "must not be active on the hatched line");
  const pillHit = suppressedOnly(vsPill).find((v) => v.name === "rounded-everything");
  assert.ok(pillHit, JSON.stringify(vsPill));
  assert.equal(pillHit.suppressedBy, "escape-hatch");

  // small avatar box would not have tripped rounded-everything even without the escape
  // hatch (its own suppress regex excludes h-8/w-8) -- so no suppressed entry either.
  const avatar = '<span class="rounded-full h-8 w-8 bg-slate-200"></span> <!-- anti-slop-allow: small icon -->';
  const vsAvatar = scanContent(avatar, "a.tsx", { collectSuppressed: true });
  assert.ok(!suppressedOnly(vsAvatar).some((v) => v.name === "rounded-everything"), "a suppress-regex guard must not be reported as a suppressed finding");
});

test("escape-hatch: a code-pattern on a hatched line yields a suppressed code-pattern entry", () => {
  const content = "function f() {\n  return eval(userInput); // anti-slop-allow: sandboxed context\n}";
  const vs = scanContent(content, "a.ts", { collectSuppressed: true });
  assert.ok(!active(vs).some((v) => v.name === "eval-usage"), "must not be active on the hatched line");
  const hit = suppressedOnly(vs).find((v) => v.name === "eval-usage");
  assert.ok(hit, JSON.stringify(vs));
  assert.equal(hit.suppressedBy, "escape-hatch");
  assert.equal(hit.type, "code-pattern");
});

test("escape-hatch: text-construct and emoji rules are out of scope for suppressed capture", () => {
  const content = "This is not just X, it's Y. <!-- anti-slop-allow: deliberate rhetorical antithesis -->";
  const vs = scanContent(content, "a.md", { collectSuppressed: true });
  assert.ok(!suppressedOnly(vs).some((v) => v.type === "text-construct"), "text-construct is intentionally out of scope this round");
});

test("escape-hatch: low-confidence words still require clustering (>=2) within the hatched lines to count as suppressed", () => {
  const oneHit = "A comprehensive plan. <!-- anti-slop-allow: kept -->";
  const vsOne = scanContent(oneHit, "a.md", { collectSuppressed: true });
  assert.ok(!suppressedOnly(vsOne).some((v) => v.word === "comprehensive"), "a lone low-confidence hit on a hatched line should not count as suppressed");

  const twoHits = "A comprehensive plan. <!-- anti-slop-allow: kept -->\nA comprehensive review. <!-- anti-slop-allow: kept -->";
  const vsTwo = scanContent(twoHits, "a.md", { collectSuppressed: true });
  const hit = suppressedOnly(vsTwo).find((v) => v.word === "comprehensive");
  assert.ok(hit, JSON.stringify(vsTwo));
  assert.equal(hit.count, 2);
});

// ── D6 (b): allowedWords suppression ──

test("allowedWords: a banned word allowed by config yields a suppressed banned-word entry, not an active one", async () => {
  const dir = mkdtempSync(join(tmpdir(), "anti-slop-stats-allowedwords-"));
  try {
    mkdirSync(join(dir, ".anti-slop"), { recursive: true });
    writeFileSync(
      join(dir, ".anti-slop", "config.json"),
      JSON.stringify({ allowedWords: ["leverage"] }),
    );
    const scanMjsUrl = pathToFileURL(
      join(dirname(fileURLToPath(import.meta.url)), "..", "lib", "scan.mjs"),
    ).href;
    const script = [
      `import { scanContent } from ${JSON.stringify(scanMjsUrl)};`,
      `const vs = scanContent("We leverage A. We leverage B. We leverage C.", "b.md", { collectSuppressed: true });`,
      `console.log(JSON.stringify(vs));`,
    ].join("\n");
    const result = spawnSync(process.execPath, ["--input-type=module", "-e", script], {
      cwd: dir,
      encoding: "utf8",
    });
    assert.equal(result.status, 0, result.stderr);
    const vs = JSON.parse(result.stdout.trim());
    assert.ok(!active(vs).some((v) => v.word === "leverage"), "must not be active once allowed");
    const hit = suppressedOnly(vs).find((v) => v.word === "leverage");
    assert.ok(hit, JSON.stringify(vs));
    assert.equal(hit.suppressedBy, "allowed-words");
    assert.equal(hit.count, 3);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("allowedWords: concentration rule still applies -- a lone allowed low-confidence word does not yield a suppressed entry", async () => {
  const dir = mkdtempSync(join(tmpdir(), "anti-slop-stats-allowedwords-lone-"));
  try {
    mkdirSync(join(dir, ".anti-slop"), { recursive: true });
    writeFileSync(
      join(dir, ".anti-slop", "config.json"),
      JSON.stringify({ allowedWords: ["comprehensive"] }),
    );
    const scanMjsUrl = pathToFileURL(
      join(dirname(fileURLToPath(import.meta.url)), "..", "lib", "scan.mjs"),
    ).href;
    const script = [
      `import { scanContent } from ${JSON.stringify(scanMjsUrl)};`,
      `const vs = scanContent("A comprehensive plan for Q3.", "b.md", { collectSuppressed: true });`,
      `console.log(JSON.stringify(vs));`,
    ].join("\n");
    const result = spawnSync(process.execPath, ["--input-type=module", "-e", script], {
      cwd: dir,
      encoding: "utf8",
    });
    assert.equal(result.status, 0, result.stderr);
    const vs = JSON.parse(result.stdout.trim());
    assert.equal(vs.length, 0, JSON.stringify(vs));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ── D6: suppressed entries never affect calculateScore ──

test("suppressed entries must never affect calculateScore -- callers filter on v.suppressed first", () => {
  const content = "We delve into it. We delve deeper. <!-- anti-slop-allow: intentional -->";
  const withSuppressed = scanContent(content, "a.md", { collectSuppressed: true });
  assert.ok(suppressedOnly(withSuppressed).length > 0, "sanity: this sample must produce a suppressed entry");
  const scoreFilteredActive = calculateScore(active(withSuppressed));
  const scoreBaseline = calculateScore(scanContent(content, "a.md"));
  assert.equal(scoreFilteredActive, scoreBaseline, "score computed from filtered-active entries must match the default-off scan's score");
});
