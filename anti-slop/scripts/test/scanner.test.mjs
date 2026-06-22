import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  scanContent,
  calculateScore,
  verdict,
  BANNED_WORDS,
  LOW_CONFIDENCE_WORDS,
  TEXT_CONSTRUCTS,
  DESIGN_PATTERNS,
  CODE_PATTERNS,
} from "../slop-scanner.mjs";

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), "fixtures");

const has = (vs, pred) => vs.some(pred);
const named = (vs, name) => vs.some((v) => v.name === name);

test("module imports without starting the MCP server", () => {
  assert.ok(Array.isArray(BANNED_WORDS) && BANNED_WORDS.length > 10);
  assert.ok(LOW_CONFIDENCE_WORDS.has("utilize"));
  assert.ok(TEXT_CONSTRUCTS.length > 5 && DESIGN_PATTERNS.length > 5 && CODE_PATTERNS.length > 5);
});

test("clean prose produces no violations", () => {
  const clean =
    "The migration moved 4,200 rows in under a second. We tested it on the staging copy first, " +
    "then ran it against production during the Tuesday maintenance window. Nothing broke. The old " +
    "import path still works for the two services that have not switched yet.";
  const vs = scanContent(clean, "note.md");
  assert.equal(vs.length, 0, JSON.stringify(vs));
});

test("slop prose: antithesis, boilerplate, closer, opener, em-dash density", () => {
  const slop = [
    "Honestly, this is not just a feature — it's a paradigm shift.",
    "In today's fast-paced world, we delve into a tapestry — a seamless synergy — leveraging cutting-edge tools — to unlock your full potential.",
    "As an AI language model, I cannot help — but reach out anytime.",
    "This — right here — is the moment. In conclusion, it's a game-changer.",
  ].join("\n");
  const vs = scanContent(slop, "post.md");
  assert.ok(named(vs, "antithesis-not-just-x-y"), "antithesis");
  assert.ok(named(vs, "assistant-boilerplate"), "assistant boilerplate");
  assert.ok(named(vs, "in-conclusion"), "in-conclusion closer");
  assert.ok(named(vs, "fast-paced-opener"), "fast-paced opener");
  assert.ok(named(vs, "unlock-potential"), "unlock potential");
  assert.ok(named(vs, "em-dash-density"), "em-dash density");
});

test("escape hatch suppresses a flagged line", () => {
  const withHatch =
    "This is not just X, it's Y. <!-- anti-slop-allow: deliberate rhetorical antithesis -->";
  const vs = scanContent(withHatch, "post.md");
  assert.ok(!named(vs, "antithesis-not-just-x-y"), JSON.stringify(vs));
});

test("low-confidence word: lone hit is clean, a cluster flags low", () => {
  const one = scanContent("We will leverage the new API for this report.", "a.md");
  assert.ok(!has(one, (v) => v.word === "leverage"), "single leverage should be clean");
  const many = scanContent("We leverage A. We leverage B. We leverage C.", "b.md");
  assert.ok(
    has(many, (v) => v.word === "leverage" && v.severity === "low"),
    "clustered leverage flags at low severity",
  );
});

test("noise-stripping: quoted and code-spanned tells are not flagged", () => {
  const doc = "The phrase `as an AI language model` is a tell. So is \"it's not just X, it's Y\".";
  const vs = scanContent(doc, "ref.md");
  assert.ok(!named(vs, "assistant-boilerplate"), "code-spanned boilerplate skipped");
  assert.ok(!named(vs, "antithesis-not-just-x-y"), "quoted antithesis skipped");
});

test("slop code: chat artifact, placeholder stub, swallowed error, eval, generic name", () => {
  const code = [
    "// Here's the updated code you requested",
    "function processData(data) {",
    "  try { return JSON.parse(data) } catch {}",
    "  // ... rest of your code here",
    "  return eval(userInput)",
    "}",
  ].join("\n");
  const vs = scanContent(code, "x.ts");
  assert.ok(named(vs, "chat-artifact"), "chat artifact");
  assert.ok(named(vs, "placeholder-comment"), "placeholder stub");
  assert.ok(named(vs, "swallowed-error"), "swallowed error");
  assert.ok(named(vs, "generic-naming"), "generic naming");
  assert.ok(has(vs, (v) => v.name === "eval-usage" && v.severity === "high"), "eval is high severity");
});

test("design tells: gradient text, purple-blue gradient, cream/serif, AI purple", () => {
  const css = [
    '<h1 class="bg-clip-text text-transparent bg-gradient-to-r from-purple-500 to-blue-500">Hi</h1>',
    "body { background: #faf8f5; font-family: 'Instrument Serif'; }",
    "a { color: #6366f1; }",
  ].join("\n");
  const vs = scanContent(css, "page.css");
  assert.ok(named(vs, "gradient-text"), "gradient text");
  assert.ok(named(vs, "purple-blue-gradient"), "purple-blue gradient");
  assert.ok(named(vs, "cream-serif-default"), "cream/serif default");
  assert.ok(named(vs, "ai-purple-hex"), "AI purple hex");
});

test("rounded-everything: pill flagged, small avatar/dot suppressed", () => {
  const pill = scanContent('<button class="rounded-full px-6 py-3">Go</button>', "a.tsx");
  assert.ok(named(pill, "rounded-everything"), "pill button flagged");
  const avatar = scanContent('<span class="rounded-full h-8 w-8 bg-slate-200"></span>', "b.tsx");
  assert.ok(!named(avatar, "rounded-everything"), "small box (h-8 w-8) suppressed");
});

test("calculateScore clamps to [0,50] and decreases by severity", () => {
  assert.equal(calculateScore([]), 50);
  assert.equal(
    calculateScore([{ severity: "high" }, { severity: "medium" }, { severity: "low" }]),
    50 - 5 - 2 - 1,
  );
  const overflow = Array.from({ length: 40 }, () => ({ severity: "high" }));
  assert.equal(calculateScore(overflow), 0);
});

// ── Regression tests for the completeness-audit port-fidelity fixes ──

test("AI purple is detected as a Tailwind class, not only as hex", () => {
  assert.ok(named(scanContent('<button class="bg-indigo-600 text-white">Go</button>', "a.tsx"), "ai-purple-class"));
  assert.ok(named(scanContent('<a class="text-violet-500">x</a>', "a.tsx"), "ai-purple-class"));
  // purple-only scoping: blue / slate / below-band shades must NOT fire it
  assert.ok(!named(scanContent('<button class="bg-blue-600">Go</button>', "a.tsx"), "ai-purple-class"));
  assert.ok(!named(scanContent('<div class="bg-indigo-100">x</div>', "a.tsx"), "ai-purple-class"));
});

test("raw-CSS linear-gradient purple is detected (the before.html slop control)", () => {
  assert.ok(named(scanContent(".hero{ background: linear-gradient(135deg,#7c3aed,#2563eb) }", "p.css"), "purple-blue-gradient"));
  assert.ok(!named(scanContent(".x{ background: linear-gradient(90deg,#16a34a,#15803d) }", "p.css"), "purple-blue-gradient"));
});

test("gradient-text catches unprefixed background-clip; shadcn --radius; Spectral serif", () => {
  assert.ok(named(scanContent("h1{ background-clip:text; color:transparent }", "p.css"), "gradient-text"));
  assert.ok(named(scanContent(":root{ --radius: 0.5rem }", "p.css"), "shadcn-default-card"));
  assert.ok(named(scanContent("h1{ font-family:'Spectral' }", "p.css"), "cream-serif-default"));
});

test("swallowed-error covers Go and Swift; a Python handler on the next line is clean", () => {
  assert.ok(named(scanContent("if err != nil {}", "a.go"), "swallowed-error"));
  assert.ok(named(scanContent("do { try x() } catch {}", "a.swift"), "swallowed-error"));
  // C17 fix: except with a real handler on the next line is NOT a swallow
  assert.ok(!named(scanContent("try:\n    risky()\nexcept Exception:\n    log.error('boom')\n    raise", "a.py"), "swallowed-error"));
  // bare except: still fires
  assert.ok(named(scanContent("try:\n    x()\nexcept:\n    pass", "a.py"), "swallowed-error"));
});

test("language coverage: Swift/Kotlin are scanned for code patterns", () => {
  assert.ok(named(scanContent("func processData(x) {}", "a.swift"), "generic-naming"));
  assert.ok(named(scanContent("// rest of your code here", "a.kt"), "placeholder-comment"));
});

test("low-confidence comprehensive: lone hit clean, cluster flags low", () => {
  assert.ok(!scanContent("A comprehensive plan for Q3.", "a.md").some((v) => v.word === "comprehensive"));
  assert.ok(scanContent("A comprehensive plan. A comprehensive review. A comprehensive audit.", "b.md").some((v) => v.word === "comprehensive" && v.severity === "low"));
  assert.ok(BANNED_WORDS.includes("comprehensive"));
});

test("restored markers: sk- key, existing-code stub, knowledge cutoff, star emoji", () => {
  assert.ok(named(scanContent('const k = "sk-xxx-placeholder";', "a.ts"), "boilerplate-marker"));
  assert.ok(named(scanContent("function f(){\n  // existing code unchanged\n}", "a.ts"), "placeholder-comment"));
  assert.ok(named(scanContent("As of my last knowledge cut-off I cannot verify that.", "a.md"), "assistant-boilerplate"));
  assert.ok(scanContent("const label = 'rating " + String.fromCodePoint(0x2b50) + "'", "a.ts").some((v) => v.type === "emoji"));
});

test("verdict ladder: CLEAN/MINOR/SOME/STRONG with the long-doc guard", () => {
  assert.equal(verdict([]), "CLEAN");
  assert.equal(verdict([{ severity: "low" }]), "MINOR");
  assert.equal(verdict([{ severity: "high" }]), "SOME");
  assert.equal(verdict([{ severity: "high" }, { severity: "high" }, { severity: "high" }]), "STRONG");
  // 3 medium (weighted 6) -> SOME in a short doc, demoted to MINOR in a long sparse one
  assert.equal(verdict([{ severity: "medium" }, { severity: "medium" }, { severity: "medium" }], 100), "SOME");
  assert.equal(verdict([{ severity: "medium" }, { severity: "medium" }, { severity: "medium" }], 5000), "MINOR");
});

test("fixture: before.html (slop control) flags a full AI-default page", () => {
  const vs = scanContent(readFileSync(join(FIXTURES, "before.html"), "utf8"), "before.html");
  const designNames = [...new Set(vs.filter((v) => v.type === "design-tell").map((v) => v.name))];
  assert.ok(designNames.length >= 4, `expected >=4 design tells, got ${designNames.join(",")}`);
  assert.ok(named(vs, "gradient-text"));
  assert.ok(vs.some((v) => v.type === "emoji"));
});

test("fixture: the four 'after' designs carry no AI-aesthetic tells (escape hatch end-to-end)", () => {
  for (const f of ["editorial-bold.html", "technical-mono.html", "utilitarian-fintech.html", "warm-consumer.html"]) {
    const vs = scanContent(readFileSync(join(FIXTURES, f), "utf8"), f);
    const aiTells = vs.filter((v) => v.type === "design-tell" && v.name !== "important-overuse");
    assert.equal(aiTells.length, 0, `${f} should have no AI-aesthetic design tells, got ${aiTells.map((v) => v.name).join(",")}`);
  }
});

// ── Final-review false-positive fixes ──

test("swallowed-error: a comment-catch with real recovery on the next line is NOT a swallow", () => {
  assert.ok(!named(scanContent("try { x() } catch (e) {  // expected sometimes\n  retry()\n}", "a.ts"), "swallowed-error"));
  assert.ok(!named(scanContent("if err != nil {  // log upstream\n  return fallback\n}", "a.go"), "swallowed-error"));
  // a one-line commented-empty catch IS still a swallow
  assert.ok(named(scanContent("try { x() } catch (e) { // ignore }", "a.ts"), "swallowed-error"));
  assert.ok(named(scanContent("if err != nil { // ignore }", "a.go"), "swallowed-error"));
});

test("placeholder-comment: a real why-comment containing 'here' is not a stub", () => {
  assert.ok(!named(scanContent("function f(){\n  // implementation here is naive but fine for now\n  return 1\n}", "a.ts"), "placeholder-comment"));
  // the genuine stub still fires
  assert.ok(named(scanContent("function f(){\n  // implementation goes here\n}", "a.ts"), "placeholder-comment"));
});
