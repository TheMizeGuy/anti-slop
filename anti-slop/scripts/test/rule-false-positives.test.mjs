import { test } from "node:test";
import assert from "node:assert/strict";
import { scanContent } from "../lib/scan.mjs";
import { CONTEXT_EXCEPTION_REGEXES } from "../lib/rules.mjs";

// ── The false-positive direction ──────────────────────────────────────────────
// The corpus measures whether a rule FIRES on a planted tell. It says almost nothing about
// whether a rule stays quiet on the legitimate content that resembles one: 31 of 49 rules
// had no negative fixture and no negative unit assertion, which is how a table of rules can
// report 100% precision while several of them break on a one-line realistic input.
//
// Every rule narrowed in 2.1.0 gets BOTH directions here -- the input that used to fire and
// must not, and the input that must still fire, so a narrowing cannot quietly become a
// deletion. The remaining rules are the highest-risk unguarded ones from the same audit.

const names = (content, path) => scanContent(content, path).map((v) => v.name || v.word || v.phrase || v.type);
const fires = (rule, content, path) => names(content, path).includes(rule);

// ── hardcoded-secret: the value must be secret-SHAPED, not merely 8+ characters ──

test("hardcoded-secret: an i18n copy string is not a credential", () => {
  assert.ok(!fires("hardcoded-secret", 'const en = { password: "Please enter your password" };', "i18n/en.ts"));
});

test("hardcoded-secret: a lexer token KIND is not a credential", () => {
  const lexer = 'const t = { token: "punctuation" };\nconst u = { token: "identifier" };';
  assert.ok(!fires("hardcoded-secret", lexer, "src/lexer.ts"));
});

test("hardcoded-secret: a validation message is not a credential", () => {
  assert.ok(!fires("hardcoded-secret", 'password: "must be at least 8 characters"', "src/schema.ts"));
});

test("hardcoded-secret: an env-indirection string is not a credential", () => {
  assert.ok(!fires("hardcoded-secret", 'api_key = "os.environ[API_KEY]"', "src/config.py"));
});

test("hardcoded-secret: real credentials still fire, by every shape the rule accepts", () => {
  assert.ok(fires("hardcoded-secret", 'const API_KEY = "sk-live-9f2a7bd4c1e8";', "src/config.ts"), "vendor prefix");
  assert.ok(fires("hardcoded-secret", 'const apiKey = "sk_live_abcdef123456"', "src/config.ts"), "3+ digits");
  assert.ok(fires("hardcoded-secret", 'fetch({ token: "csrf-tok12xyz" })', "src/api.ts"), "separator joining letters and digits");
  assert.ok(fires("hardcoded-secret", 'const secret = "YWJjZGVmZ2hpamtsbW5vcHFy"', "src/config.ts"), "20+ chars of base64");
});

// ── listicle-scaffold: the tell is a HEADLINE or a list announcement ──

test("listicle-scaffold: ordinary technical prose counting steps or reasons is not a listicle", () => {
  assert.ok(!fires("listicle-scaffold", "The migration runs in 3 steps and takes about ten minutes.", "runbook.md"));
  assert.ok(!fires("listicle-scaffold", "There are 4 reasons the cache misses on cold start.", "notes.md"));
});

test("listicle-scaffold: a headline and an announced list still fire", () => {
  assert.ok(fires("listicle-scaffold", "# 7 Ways to Speed Up Your Build", "post.md"));
  assert.ok(fires("listicle-scaffold", "Here are 5 ways to speed up first response time.", "post.md"));
});

// ── hr-divider: a Setext underline is a heading, not a divider ──

test("hr-divider: a Setext H2 underline is not a divider", () => {
  assert.ok(!fires("hr-divider", "Release process\n---\n\nRun the deploy script.", "doc.md"));
});

test("hr-divider: a real section divider still fires", () => {
  assert.ok(fires("hr-divider", "Some text.\n\n---\n\nMore text.", "doc.md"));
});

// ── narrating-comment: documenting a procedure is not restating the code ──

test("narrating-comment: a numbered runbook step in a shell script is documentation", () => {
  assert.ok(!fires("narrating-comment", "# Step 1: install the toolchain\nbrew install node", "setup.sh"));
});

test("narrating-comment: an ordered algorithm description in JSDoc is documentation", () => {
  assert.ok(!fires("narrating-comment", "/**\n * First, the parser normalises input.\n */", "src/parse.ts"));
});

test("narrating-comment: a comment that restates the line under it still fires, lead-in or not", () => {
  assert.ok(fires("narrating-comment", "// increment the counter\ni++;", "src/count.ts"));
  assert.ok(fires("narrating-comment", "# first, we loop through the rows\nfor row in rows:", "src/report.py"));
});

// ── boilerplate-marker: RFC 2606 reserves example.com for production use ──

test("boilerplate-marker: example.com in a CORS allowlist is correct, not dummy data", () => {
  assert.ok(!fires("boilerplate-marker", 'const ORIGINS = ["https://app.example.com"];', "src/cors.ts"));
});

test("boilerplate-marker: the precise dummy-data markers still fire", () => {
  assert.ok(fires("boilerplate-marker", 'const k = "sk-xxx-placeholder";', "src/config.ts"));
  assert.ok(fires("boilerplate-marker", "const key = YOUR_API_KEY;", "src/config.ts"));
});

// ── The escape hatch reaches every rule family on every surface ──

test("escape hatch: a banned phrase on a hatched line is suppressed in code as well as prose", () => {
  const line = "// let me walk you through the retry loop  anti-slop-allow: quoting the ticket";
  assert.ok(!fires("let me walk you through", line, "src/retry.ts"));
  assert.ok(!fires("let me walk you through", "Let me walk you through it. <!-- anti-slop-allow: quoting -->", "doc.md"));
});

test("escape hatch: the same phrase without the marker still fires on both surfaces", () => {
  assert.ok(fires("let me walk you through", "// let me walk you through the retry loop", "src/retry.ts"));
  assert.ok(fires("let me walk you through", "Let me walk you through it.", "doc.md"));
});

// Deliberate, and pinned here so it stops being an accident of one ternary: in CODE the
// phrase family scans the WHOLE file, not only comments. Assistant boilerplate leaks into
// UI copy and identifiers as readily as into comments, and a string constant reading
// "Great question" ships to a user. Banned WORDS remain comment-only, because a single
// inflated adjective inside a string is the writer's product copy, not a tell.
test("banned phrases scan code string literals; banned words stay comment-only", () => {
  assert.ok(fires("great question", 'const COPY = { greeting: "Great question" };', "src/copy.ts"));
  assert.ok(!fires("delve", 'const COPY = { intro: "We delve into the details" };', "src/copy.ts"));
  assert.ok(fires("delve", "// we delve into the cache here\nconst n = 1;", "src/cache.ts"));
});

// ── Banned words see trailing comments, but a URL inside a string is not a comment ──

test("banned words: a trailing comment is a comment", () => {
  assert.ok(fires("delve", "const n = 1; // we delve into the cache here", "src/cache.ts"));
});

test("banned words: `//` inside a string literal does not open a comment", () => {
  assert.ok(!fires("delve", 'const url = "http://delve.example"; const y = 1;', "src/net.ts"));
});

// ── CONTEXT_EXCEPTIONS: an over-broad suppressor is a silent recall hole ──
// Common English words that must never be read as domain context. `expiration` is
// deliberately absent -- "expir" is a stem the ephemeral exception is meant to reach.
const DECOYS = [
  "important", "importantly", "support", "supports", "reports", "portion", "portions",
  "deportment", "imported", "exports", "transport", "transported", "settings", "setting",
  "asset", "assets", "subset", "offset", "method", "methods", "whether", "together",
  "register", "registry", "logistics", "mapping", "remapped", "cachet", "seamstress",
];

test("no context exception matches a common English word it was never meant to excuse", () => {
  const collisions = [];
  for (const [word, regexes] of CONTEXT_EXCEPTION_REGEXES) {
    for (const re of regexes) {
      for (const decoy of DECOYS) {
        if (re.test(decoy)) collisions.push(`${word}: /${re.source}/ matches "${decoy}"`);
      }
    }
  }
  assert.deepEqual(
    collisions,
    [],
    "an exception entry that matches ordinary English silently disables the banned word it " +
      "guards in almost every document. Anchor the entry, add it to WHOLE_WORD_EXCEPTIONS, " +
      "or reword it -- never widen the decoy list to make this pass.",
  );
});

test("context exceptions still excuse their real domain word, stems and plurals included", () => {
  const twice = "Welcome to the realm. In this realm, everything is possible.";
  assert.ok(fires("realm", twice, "a.md"), "clustered realm flags without domain context");
  assert.ok(!fires("realm", `${twice} The servers handle each request.`, "a.md"), "plural 'servers'");
  const eph = "The value is ephemeral. Everything here is ephemeral.";
  assert.ok(fires("ephemeral", eph, "a.md"));
  assert.ok(!fires("ephemeral", `${eph} Its expiration is 30 seconds.`, "a.md"), "stem 'expir' -> 'expiration'");
  assert.ok(!fires("ephemeral", `${eph} Bind an ephemeral port on startup.`, "a.md"), "whole word 'port'");
  assert.ok(fires("ephemeral", `${eph} This is important, and exports matter.`, "a.md"), "'important' is not a port");
});

// ── Highest-risk previously unguarded rules ──────────────────────────────────

test("img-no-dimensions: an <img> carrying width and height is not a CLS defect", () => {
  assert.ok(!fires("img-no-dimensions", '<img src="/hero.png" width="800" height="400" alt="Q3 revenue">', "page.html"));
  assert.ok(fires("img-no-dimensions", '<img src="/hero.png" alt="Q3 revenue">', "page.html"));
});

test("generic-naming: a real domain function name is not a placeholder", () => {
  assert.ok(!fires("generic-naming", "function processInvoiceBatch(rows) {}", "src/billing.ts"));
  assert.ok(!fires("generic-naming", "def process_payment(order):\n    pass", "src/billing.py"));
  assert.ok(fires("generic-naming", "function processData(rows) {}", "src/billing.ts"));
});

test("z-index-escalation: an ordinary stacking value is not escalation", () => {
  assert.ok(!fires("z-index-escalation", ".modal { z-index: 40; }", "app.css"));
  assert.ok(!fires("z-index-escalation", "const s = { zIndex: 10 };", "Modal.tsx"));
  assert.ok(fires("z-index-escalation", ".modal { z-index: 9999; }", "app.css"));
  assert.ok(fires("z-index-escalation", "const s = { zIndex: 9999 };", "Modal.tsx"));
});

test("neon-glow: a normal offset shadow is not a neon glow", () => {
  assert.ok(!fires("neon-glow", ".card { box-shadow: 0 1px 3px rgba(0,0,0,.12); }", "app.css"));
  assert.ok(fires("neon-glow", ".card { box-shadow: 0 0 24px var(--accent); }", "app.css"));
});

// ── The three class-attribute fingerprints ───────────────────────────────────
// Both documented orders must fire, and a fingerprint SPLIT ACROSS TWO ELEMENTS must not:
// attribute scoping is the whole reason these are token-set rules rather than a line-wide
// AND. The firing strings are copied from references/design-patterns.md verbatim.

test("frosted-glass-nav: the catalogue's canonical string and the reverse order both fire", () => {
  assert.ok(fires("frosted-glass-nav", '<nav class="bg-white/80 backdrop-blur-md border-b sticky top-0 z-50">', "nav.html"));
  assert.ok(fires("frosted-glass-nav", '<nav class="backdrop-blur-md bg-white/80 border-b sticky top-0">', "nav.html"));
});

test("frosted-glass-nav: an opaque nav and a split-across-elements near-miss stay silent", () => {
  assert.ok(!fires("frosted-glass-nav", '<nav class="bg-white border-b sticky top-0">', "nav.html"));
  assert.ok(!fires("frosted-glass-nav", '<div class="backdrop-blur-md"></div><nav class="bg-white/80 border-b"></nav>', "nav.html"));
});

test("shadow-border-rounded-combo: Strongest-10 entry 1 fires in either order", () => {
  assert.ok(fires("shadow-border-rounded-combo", '<div class="rounded-xl shadow-sm border p-6">', "card.html"));
  assert.ok(fires("shadow-border-rounded-combo", '<div class="shadow-sm border rounded-xl p-6">', "card.html"));
});

test("shadow-border-rounded-combo: two of the three tokens, or a cross-element split, stay silent", () => {
  assert.ok(!fires("shadow-border-rounded-combo", '<div class="rounded-xl border p-6">', "card.html"));
  assert.ok(!fires("shadow-border-rounded-combo", '<div class="rounded-xl"></div><div class="shadow-sm border"></div>', "card.html"));
});

test("icon-in-colored-circle: the catalogue's documented order fires; a plain avatar does not", () => {
  assert.ok(fires("icon-in-colored-circle", '<div class="bg-indigo-100 rounded-full p-3">', "card.html"));
  assert.ok(fires("icon-in-colored-circle", '<div class="rounded-full bg-indigo-100 p-3">', "card.html"));
  assert.ok(!fires("icon-in-colored-circle", '<span class="rounded-full h-8 w-8 bg-slate-200"></span>', "card.html"));
  assert.ok(!fires("icon-in-colored-circle", '<div class="rounded-full p-3"></div><div class="bg-indigo-100"></div>', "card.html"));
});

// ── Emoji ────────────────────────────────────────────────────────────────────

test("emoji: a prose file that DISCUSSES emoji is documenting the tell, not committing it", () => {
  const doc = "The emoji tell: a status shipped as \u{1F680} is a WCAG 1.4.1 problem too.";
  assert.ok(!fires("emoji", doc, "references/writing-patterns.md"));
  assert.ok(fires("emoji", "A status shipped as \u{1F680} is a problem.", "references/other.md"));
});

test("emoji: naming a CSS class or a constant `emoji` does not silence a source file", () => {
  assert.ok(fires("emoji", '<span class="emoji">\u{1F680}</span>', "page.html"));
  assert.ok(fires("emoji", 'const EMOJI_MAP = { rocket: "\u{1F680}" };', "src/icons.ts"));
});
