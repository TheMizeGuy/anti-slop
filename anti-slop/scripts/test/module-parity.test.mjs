import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { ruleName } from "../measure.mjs";
import { computeRuleStats } from "../lib/stats.mjs";
import { classifyVerdict } from "../lib/cli.mjs";
import { PROSE_EXTENSIONS, CODE_EXTENSIONS, CODE_SURFACE_EXTENSIONS, WEB_SURFACE_EXTENSIONS } from "../lib/rules.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const SCRIPTS_DIR = dirname(HERE);
const DASHBOARD_HTML = readFileSync(join(SCRIPTS_DIR, "lib", "dashboard.html"), "utf8");

// ── One convention, several copies ───────────────────────────────────────────
// The rule-key convention lives in three places (measure.mjs ruleName, stats.mjs ruleKey,
// dashboard.html ruleName), the severity ordering in two, and SEVERITY_RANK in three. They
// cannot be collapsed -- dashboard.html is browser source with no module system -- so they
// are pinned against a shared input table instead. Drift here means the dashboard, the
// `stats` subcommand and the measurement harness disagree on what counts as one rule.

// Evaluate the dashboard client's helpers in this process, straight from the shipped file,
// so the test exercises the same bytes the browser gets rather than a copy of them.
function dashboardFn(name) {
  const start = DASHBOARD_HTML.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `dashboard.html no longer defines ${name}()`);
  const source = DASHBOARD_HTML.slice(start, DASHBOARD_HTML.indexOf("\n}", start) + 2);
  // eslint-disable-next-line no-new-func -- the input is a slice of a file in this repo
  return new Function(`${source}; return ${name};`)();
}

const KEY_CASES = [
  [{ type: "banned-word", word: "delve" }, "delve"],
  [{ type: "banned-phrase", phrase: "great question" }, "great question"],
  [{ type: "design-tell", name: "gradient-text" }, "gradient-text"],
  [{ type: "code-pattern", name: "eval-usage" }, "eval-usage"],
  [{ type: "text-construct", name: "hr-divider" }, "hr-divider"],
  [{ type: "emoji", count: 3 }, "emoji"],
  [{}, "unknown"],
  // The precedence matters when more than one field is present: name wins over word.
  [{ type: "banned-word", name: "em-dash-density", word: "delve" }, "em-dash-density"],
];

test("all three copies of the rule-key convention agree on the same inputs", () => {
  const dashboardRuleName = dashboardFn("ruleName");
  for (const [violation, expected] of KEY_CASES) {
    assert.equal(ruleName(violation), expected, `measure.mjs ruleName(${JSON.stringify(violation)})`);
    assert.equal(dashboardRuleName(violation), expected, `dashboard.html ruleName(${JSON.stringify(violation)})`);
    // stats.mjs keeps its ruleKey private; computeRuleStats exposes it as the row key.
    const { rules } = computeRuleStats([violation]);
    assert.equal(rules[0].rule, expected, `stats.mjs ruleKey(${JSON.stringify(violation)})`);
  }
});

const SEVERITY_CASES = [
  [["low", "high"], "high"],
  [["high", "low"], "high"],
  [["medium", "low"], "medium"],
  [["low", "medium"], "medium"],
  [["high", "medium"], "high"],
  // An unknown severity ranks 0, so it never displaces a known one.
  [["low", "bogus"], "low"],
];

test("both copies of the severity ordering agree, unknown severities included", () => {
  const dashboardWorst = dashboardFn("worstSeverity");
  for (const [[a, b], expected] of SEVERITY_CASES) {
    assert.equal(dashboardWorst(a, b), expected, `dashboard.html worstSeverity(${a}, ${b})`);
    // stats.mjs folds the same ordering across a log; two entries reproduce one comparison.
    const { rules } = computeRuleStats([
      { type: "code-pattern", name: "r", severity: a },
      { type: "code-pattern", name: "r", severity: b },
    ]);
    assert.equal(rules[0].worstSeverity, expected, `stats.mjs worseSeverity(${a}, ${b})`);
  }
});

test("all three SEVERITY_RANK tables carry the same three levels in the same order", () => {
  const ranks = [
    ["lib/cli.mjs", readFileSync(join(SCRIPTS_DIR, "lib", "cli.mjs"), "utf8")],
    ["lib/stats.mjs", readFileSync(join(SCRIPTS_DIR, "lib", "stats.mjs"), "utf8")],
    ["lib/dashboard.html", DASHBOARD_HTML],
  ].map(([file, src]) => {
    const m = src.match(/(?:SEVERITY_RANK|rank)\s*=\s*\{([^}]*)\}/);
    assert.ok(m, `${file} no longer declares a severity rank table`);
    return [file, Object.fromEntries(
      m[1].split(",").map((pair) => pair.split(":").map((s) => s.trim())).filter((p) => p[0]),
    )];
  });
  const [, reference] = ranks[0];
  assert.deepEqual(reference, { high: "3", medium: "2", low: "1" });
  for (const [file, table] of ranks) {
    assert.deepEqual(table, reference, `${file} severity rank drifted from lib/cli.mjs`);
  }
});

// ── Extension sets ───────────────────────────────────────────────────────────
// The CLI used to keep its own copy of the prose extension list, so adding an extension to
// rules.mjs gave it prose RULES but not prose verdict weighting.

test("the CLI weights exactly the extensions rules.mjs calls prose", () => {
  // Three medium findings weigh 6, which is SOME in a short document and demotes to MINOR
  // in a long sparse one -- but only when the file is weighted by word count, i.e. prose.
  const three = [{ severity: "medium" }, { severity: "medium" }, { severity: "medium" }];
  const longDoc = "word ".repeat(5000);
  for (const ext of PROSE_EXTENSIONS) {
    assert.equal(classifyVerdict(longDoc, `doc${ext}`, three), "MINOR", `${ext} must be weighted as prose`);
  }
  for (const ext of [".ts", ".html", ".css", ".swift", ".py"]) {
    assert.equal(classifyVerdict(longDoc, `src${ext}`, three), "SOME", `${ext} must not be weighted as prose`);
  }
});

test("the code surface set is the code extension set plus markup-with-script, and nothing else", () => {
  const markup = [".html", ".htm", ".vue", ".svelte", ".astro"];
  assert.deepEqual(
    [...CODE_SURFACE_EXTENSIONS].sort(),
    [...new Set([...CODE_EXTENSIONS, ...markup])].sort(),
  );
  for (const ext of markup) {
    assert.ok(WEB_SURFACE_EXTENSIONS.has(ext), `${ext} must stay a web surface as well as a code surface`);
    assert.ok(!CODE_EXTENSIONS.has(ext), `${ext} belongs in CODE_SURFACE_EXTENSIONS, not CODE_EXTENSIONS`);
  }
  for (const ext of PROSE_EXTENSIONS) {
    assert.ok(!CODE_SURFACE_EXTENSIONS.has(ext), `${ext} is prose and must not route to code rules`);
  }
});

// ── The test invocation ──────────────────────────────────────────────────────
// `npm test` names its files explicitly rather than relying on shell glob expansion (which
// is POSIX-only, and the documented reason for avoiding a bare `node --test` -- corpus
// recursion -- makes this the load-bearing invocation). An explicit list only stays honest
// if adding a test file to the directory fails until the list is updated.

test("npm test names every test file in the directory", () => {
  const pkg = JSON.parse(readFileSync(join(SCRIPTS_DIR, "package.json"), "utf8"));
  const listed = new Set(pkg.scripts.test.split(/\s+/).filter((a) => a.endsWith(".test.mjs")));
  const onDisk = readdirSync(HERE).filter((f) => f.endsWith(".test.mjs")).map((f) => `test/${f}`);
  assert.ok(!pkg.scripts.test.includes("*"), "npm test must not depend on shell glob expansion");
  assert.deepEqual([...listed].sort(), onDisk.sort());
});
