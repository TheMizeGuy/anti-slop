import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { scanContent } from "../lib/scan.mjs";
import { countOffScaleSpacing } from "../lib/rules.mjs";
import { CORPUS_DIR } from "../measure.mjs";

// Every rule added in 2.1.0, asserted in BOTH directions: the shape it is meant to catch,
// and the named counter-example it must stay silent on. A one-directional test passes just
// as well on a rule that matches everything, which is the failure mode these guard.

const names = (content, path) => scanContent(content, path).map((v) => v.name || v.type);
const fires = (rule, content, path) => names(content, path).includes(rule);
const corpus = (file) => readFileSync(join(CORPUS_DIR, file), "utf8");

// ── media-control-glyph (design + native): a text glyph standing in for a control ──
// The 2.1.0 incident: a pause/play toggle shipped as the bare text glyph. Since 2.3.1 the
// emoji rule follows Unicode and no longer sees a bare ▶ or ⏸, so the incident gets its
// own tell, scoped to UI surfaces: markup, components, and SwiftUI. In prose a ▶ is a
// symbol in a sentence, and the emoji-presentation form (▶️) is the emoji rule's.

test("media-control-glyph: a bare play/pause glyph in a component or a SwiftUI view is a finding", () => {
  const tsx = '<button onClick={toggle} aria-label="Play">{playing ? "⏸" : "▶"}</button>';
  assert.ok(fires("media-control-glyph", tsx, "Player.tsx"));
  assert.ok(fires("media-control-glyph", 'Text("▶").font(.title)', "PlayerView.swift"));
});

test("media-control-glyph: SF Symbols, an icon component, and prose are NOT findings", () => {
  assert.ok(!fires("media-control-glyph", 'Image(systemName: "play.fill")', "PlayerView.swift"));
  assert.ok(!fires("media-control-glyph", '<PlayIcon aria-hidden="true" />', "Player.tsx"));
  assert.ok(!fires("media-control-glyph", "Press ▶ to start the recording.", "guide.md"));
  // The emoji-presentation form is the emoji rule's finding, not this one's.
  const vs = names('<span>{"▶️"}</span>', "Player.tsx");
  assert.ok(vs.includes("emoji") && !vs.includes("media-control-glyph"), JSON.stringify(vs));
});

// ── Fixed geometry (design, web) ─────────────────────────────────────────────

test("fixed-page-shell: a fixed-pixel content shell is a finding", () => {
  assert.ok(fires("fixed-page-shell", ".shell { width: 1200px; }", "app.css"));
  assert.ok(fires("fixed-page-shell", ".lede { min-width: 960px; }", "app.css"));
});

test("fixed-page-shell: max-width is the correct idiom and is NOT a finding", () => {
  assert.ok(!fires("fixed-page-shell", ".shell { max-width: 1200px; }", "app.css"));
});

test("fixed-page-shell: a width inside a breakpoint is NOT a finding", () => {
  assert.ok(!fires("fixed-page-shell", "@media (min-width: 900px) { .shell { width: 720px; } }", "app.css"));
});

test("fixed-page-shell: a control-sized width is below the shell threshold", () => {
  assert.ok(!fires("fixed-page-shell", ".avatar { width: 44px; } .card { width: 320px; }", "app.css"));
});

test("fixed-grid-tracks: a pixel track list is a finding", () => {
  assert.ok(fires("fixed-grid-tracks", ".board { grid-template-columns: repeat(3, 360px); }", "app.css"));
});

test("fixed-grid-tracks: fractional and auto-fit track lists are NOT findings", () => {
  const css = ".a { grid-template-columns: repeat(2, 1fr); }\n" +
    ".b { grid-template-columns: repeat(auto-fit, minmax(20rem, 1fr)); }\n" +
    ".c { grid-template-columns: repeat(3, minmax(0, 1fr)); }";
  assert.ok(!fires("fixed-grid-tracks", css, "app.css"));
});

test("vh-viewport-shell: a bare 100vh shell is a finding", () => {
  assert.ok(fires("vh-viewport-shell", ".app { min-height: 100vh; }", "app.css"));
});

test("vh-viewport-shell: the progressive-enhancement pair is NOT a finding", () => {
  // The fallback is on the NEXT line, which is why this rule is file-scoped.
  assert.ok(!fires("vh-viewport-shell", ".app {\n  height: 100vh;\n  height: 100dvh;\n}", "app.css"));
  assert.ok(!fires("vh-viewport-shell", ".app {\n  height: 100vh;\n  height: 100svh;\n}", "app.css"));
});

// ── token-drift-spacing: the file-scope guard is the whole rule ───────────────

test("countOffScaleSpacing counts values off the 4px grid and nothing else", () => {
  assert.equal(countOffScaleSpacing("  padding: 11px 17px;"), 2);
  assert.equal(countOffScaleSpacing("  margin-top: 9px;"), 1);
  assert.equal(countOffScaleSpacing("  padding: 16px 24px;"), 0, "on-grid values are not drift");
  assert.equal(countOffScaleSpacing("  border: 1px solid red;"), 0, "border is not a spacing property");
  assert.equal(countOffScaleSpacing("  padding: 1px 2px;"), 0, "hairlines are not spacing decisions");
  assert.equal(countOffScaleSpacing("  gap: var(--space-3);"), 0, "a token is the correct idiom");
  assert.equal(countOffScaleSpacing("  padding: clamp(9px, 2vw, 21px);"), 0);
  assert.equal(countOffScaleSpacing("  margin-inline-start: calc(13px + 2px);"), 0);
});

test("token-drift-spacing: two off-scale values in a file with a scale is a finding", () => {
  const css = ":root { --space-1: 4px; --space-2: 8px; }\n.a { padding: 11px 17px; }\n.b { margin-top: 9px; }";
  assert.ok(fires("token-drift-spacing", css, "app.css"));
});

test("token-drift-spacing: a file with no --space scale is NOT drifting from one", () => {
  const css = ".a { padding: 11px 17px; }\n.b { margin-top: 9px; }\n.c { gap: 13px; }";
  assert.ok(!fires("token-drift-spacing", css, "app.css"));
});

test("token-drift-spacing: one declared token is below the file-scope threshold", () => {
  const css = ":root { --space-1: 4px; }\n.a { padding: 11px 17px; }\n.b { margin-top: 9px; }";
  assert.ok(!fires("token-drift-spacing", css, "app.css"));
});

test("token-drift-spacing: a scale used correctly is NOT a finding", () => {
  const css = ":root { --space-1: 4px; --space-2: 8px; }\n.a { padding: var(--space-2); }\n.b { gap: var(--space-1); }";
  assert.ok(!fires("token-drift-spacing", css, "app.css"));
});

// ── uniform-literal-radius ───────────────────────────────────────────────────

test("uniform-literal-radius: three literal radii with no radius token is a finding", () => {
  const css = ".a { border-radius: 8px; }\n.b { border-radius: 8px; }\n.c { border-radius: 8px; }";
  assert.ok(fires("uniform-literal-radius", css, "app.css"));
});

test("uniform-literal-radius: two literals are below the concentration threshold", () => {
  const css = ".a { border-radius: 8px; }\n.b { border-radius: 12px; }";
  assert.ok(!fires("uniform-literal-radius", css, "app.css"));
});

test("uniform-literal-radius: a file that states a radius identity is silenced", () => {
  // warm-consumer.html is a clean control carrying FIVE literal radii; the file-scope
  // guard is the only thing protecting it, so both guard legs are asserted here.
  const declared = ":root { --radius: 8px; }\n.a { border-radius: 8px; }\n.b { border-radius: 8px; }\n.c { border-radius: 8px; }";
  const referenced = ".a { border-radius: var(--radius); }\n.b { border-radius: 6px; }\n.c { border-radius: 6px; }\n.d { border-radius: 6px; }";
  assert.ok(!fires("uniform-literal-radius", declared, "app.css"));
  assert.ok(!fires("uniform-literal-radius", referenced, "app.css"));
  assert.ok(!fires("uniform-literal-radius", corpus("../fixtures/warm-consumer.html"), "../fixtures/warm-consumer.html"));
});

// ── dead-control ─────────────────────────────────────────────────────────────

test("dead-control: empty and comment-only handlers are findings", () => {
  assert.ok(fires("dead-control", '<button onclick="">Refresh</button>', "page.html"));
  assert.ok(fires("dead-control", '<button onclick="/* TODO: wire refresh */">Refresh</button>', "page.html"));
  assert.ok(fires("dead-control", "<button onClick={() => {}}>Save</button>", "Page.jsx"));
  assert.ok(fires("dead-control", "<button onClick={() => null}>Save</button>", "Page.jsx"));
});

test("dead-control: a wired handler is NOT a finding", () => {
  assert.ok(!fires("dead-control", "<button onClick={handleSave}>Save</button>", "Page.jsx"));
  assert.ok(!fires("dead-control", "<button onClick={() => setOpen(true)}>Open</button>", "Page.jsx"));
});

test("dead-control: a deliberate no-op with a real body is NOT a finding", () => {
  const jsx = "<button onClick={() => {/* deliberately inert, see #221 */ log()}}>Preview</button>";
  assert.ok(!fires("dead-control", jsx, "Page.jsx"));
});

test("dead-control: an ordinary assignment whose name starts with 'on' is NOT a finding", () => {
  // The handler list is explicit rather than /on[a-zA-Z]+/ for exactly this reason.
  assert.ok(!fires("dead-control", 'const only = "";\nlet once = "";', "util.js"));
});

// ── outline-none / missing-alt ───────────────────────────────────────────────

test("outline-none: killing the outline with no focus-visible ring is a finding", () => {
  assert.ok(fires("outline-none", "a:focus { outline: none; }", "app.css"));
  assert.ok(fires("outline-none", "button:focus { outline: 0; }", "app.css"));
});

test("outline-none: a file that defines a :focus-visible ring is silenced", () => {
  const css = "a:focus { outline: none; }\na:focus-visible { outline: 2px solid var(--ring); outline-offset: 2px; }";
  assert.ok(!fires("outline-none", css, "app.css"));
  assert.ok(!fires("outline-none", 'a:focus { outline: none; }\n.btn { --tw: focus-visible:ring-2; }', "app.css"));
});

test("missing-alt: a missing alt and a placeholder alt are both findings", () => {
  assert.ok(fires("missing-alt", '<img src="/a.jpg" width="4" height="4">', "page.html"));
  assert.ok(fires("missing-alt", '<img src="/a.jpg" alt="image" width="4" height="4">', "page.html"));
  assert.ok(fires("missing-alt", '<img src="/a.jpg" alt="icon" width="4" height="4">', "page.html"));
});

test("missing-alt: a decorative alt=\"\" and real alt text are NOT findings", () => {
  assert.ok(!fires("missing-alt", '<img src="/a.jpg" alt="" width="4" height="4">', "page.html"));
  assert.ok(!fires("missing-alt", '<img src="/a.jpg" alt="Q3 revenue by region" width="4" height="4">', "page.html"));
});

// ── Documented fingerprints ──────────────────────────────────────────────────

test("uppercase-overline: the verbatim three-class run is a finding, in any order", () => {
  assert.ok(fires("uppercase-overline", '<p class="text-xs uppercase tracking-wider">Now in beta</p>', "page.html"));
  assert.ok(fires("uppercase-overline", '<p class="tracking-widest text-slate-500 uppercase text-xs">Beta</p>', "page.html"));
});

test("uppercase-overline: a tuned tracking value is a decision and is NOT a finding", () => {
  assert.ok(!fires("uppercase-overline", '<p class="text-xs uppercase tracking-tight">Now in beta</p>', "page.html"));
});

test("uppercase-overline: the tokens must share one class attribute", () => {
  const html = '<p class="text-xs uppercase">Beta</p><p class="tracking-wider">Ships Tuesday</p>';
  assert.ok(!fires("uppercase-overline", html, "page.html"));
});

test("blur-blob: a blurred rounded-full decoration is a finding", () => {
  assert.ok(fires("blur-blob", '<div class="absolute -z-10 h-72 w-72 rounded-full bg-sky-300 blur-3xl"></div>', "page.html"));
});

test("blur-blob: a blur with no rounded-full sibling is NOT a finding", () => {
  assert.ok(!fires("blur-blob", '<div class="absolute -z-10 h-64 w-96 bg-cover blur-3xl"></div>', "page.html"));
});

test("shadcn-stats-magic: the docs literals are findings", () => {
  assert.ok(fires("shadcn-stats-magic", "<p>$45,231.89</p>", "page.html"));
  assert.ok(fires("shadcn-stats-magic", "<p>+20.1% from last month</p>", "page.html"));
});

test("shadcn-stats-magic: any real currency figure is NOT a finding", () => {
  assert.ok(!fires("shadcn-stats-magic", "<p>$12,480.00</p><p>+4.6% from last month</p>", "page.html"));
});

test("generic-microcopy: the recurring literals are findings", () => {
  assert.ok(fires("generic-microcopy", "<p>Welcome back! Here is your dashboard.</p>", "page.html"));
  assert.ok(fires("generic-microcopy", "<p>Join thousands of teams shipping faster.</p>", "page.html"));
});

test("generic-microcopy: product-specific copy is NOT a finding", () => {
  const html = "<p>Your last report ran 3 hours ago.</p><p>Import your first realm to start.</p>";
  assert.ok(!fires("generic-microcopy", html, "page.html"));
});

test("purple-gradient-default: the Tailwind indigo/violet default run is a finding", () => {
  // No test file mentioned this rule before 2.1.0, and no fixture exercised it, so a
  // mutation of its pattern survived every gate. Both directions, plus the boundary.
  assert.ok(fires("purple-gradient-default", '<a class="bg-gradient-to-r from-indigo-500 to-violet-600">Go</a>', "page.html"));
  assert.ok(fires("purple-gradient-default", '<a class="bg-gradient-to-br from-purple-400 to-purple-600">Go</a>', "page.html"));
});

test("purple-gradient-default: a non-purple gradient is NOT a finding", () => {
  assert.ok(!fires("purple-gradient-default", '<a class="bg-gradient-to-r from-emerald-500 to-teal-600">Go</a>', "page.html"));
  assert.ok(!fires("purple-gradient-default", '<a class="bg-gradient-to-r from-indigo-700 to-violet-900">Go</a>', "page.html"));
});

// ── Motion and rhythm ────────────────────────────────────────────────────────

test("transition-all: two occurrences are a finding, one is not", () => {
  assert.ok(fires("transition-all", '<a class="transition-all">A</a>\n<b class="transition-all">B</b>', "page.html"));
  assert.ok(fires("transition-all", ".a { transition: all 200ms ease; }\n.b { transition: all 150ms; }", "app.css"));
  assert.ok(!fires("transition-all", '<a class="transition-all duration-150">A</a>', "page.html"));
});

test("transition-all: named properties are NOT a finding", () => {
  const html = '<a class="transition-colors duration-150">A</a>\n<b class="transition-[transform,opacity]">B</b>';
  assert.ok(!fires("transition-all", html, "page.html"));
});

test("uniform-section-padding: three uniform sections are a finding, two are not", () => {
  const three = '<section class="py-20">a</section>\n<section class="py-20">b</section>\n<section class="py-24">c</section>';
  const varied = '<section class="py-20">a</section>\n<section class="py-12">b</section>\n<section class="py-32">c</section>';
  assert.ok(fires("uniform-section-padding", three, "page.html"));
  assert.ok(!fires("uniform-section-padding", varied, "page.html"));
});

// ── Security / bug class (code) ──────────────────────────────────────────────

test("dangerous-inner-html: the unsanitised React form is a finding", () => {
  assert.ok(fires("dangerous-inner-html", "<div dangerouslySetInnerHTML={{ __html: bio }} />", "Card.jsx"));
});

test("dangerous-inner-html: a sanitiser on the line clears it", () => {
  assert.ok(!fires("dangerous-inner-html", "<div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(c) }} />", "Card.jsx"));
  assert.ok(!fires("dangerous-inner-html", "<div dangerouslySetInnerHTML={{ __html: sanitizeHtml(c) }} />", "Card.jsx"));
});

test("shell-injection: shell=True is a finding, an argument list is not", () => {
  assert.ok(fires("shell-injection", "subprocess.run(cmd, shell=True)", "run.py"));
  assert.ok(!fires("shell-injection", 'subprocess.run(["convert", filename, "out.png"])', "run.py"));
});

test("unsafe-deserialize: pickle and a bare yaml.load are findings", () => {
  assert.ok(fires("unsafe-deserialize", "data = pickle.loads(payload)", "io.py"));
  assert.ok(fires("unsafe-deserialize", "cfg = yaml.load(raw)", "io.py"));
});

test("unsafe-deserialize: a Safe loader is NOT a finding", () => {
  assert.ok(!fires("unsafe-deserialize", "cfg = yaml.safe_load(raw)", "io.py"));
  assert.ok(!fires("unsafe-deserialize", "cfg = yaml.load(raw, Loader=yaml.SafeLoader)", "io.py"));
  assert.ok(!fires("unsafe-deserialize", "cfg = json.loads(raw)", "io.py"));
});

test("tailwind-dynamic-class: an interpolated class is a finding", () => {
  assert.ok(fires("tailwind-dynamic-class", "<div className={`bg-${tone}-500 p-4`} />", "Card.jsx"));
});

test("tailwind-dynamic-class: complete class strings are NOT a finding", () => {
  assert.ok(!fires("tailwind-dynamic-class", "<div className={`${base} rounded`} />", "Card.jsx"));
  assert.ok(!fires("tailwind-dynamic-class", "<div className={colorClasses[color]} />", "Card.jsx"));
});

test("suppression-comment: the suppressions that never expire are findings", () => {
  assert.ok(fires("suppression-comment", "// @ts-ignore\nconst x = y.z;", "a.ts"));
  assert.ok(fires("suppression-comment", "// eslint-disable-next-line no-shadow\nconst x = 1;", "a.js"));
  assert.ok(fires("suppression-comment", "value = cast(x)  # type: ignore", "a.py"));
});

test("suppression-comment: @ts-expect-error is deliberately NOT a finding", () => {
  // The compiler verifies it is still needed and errors when it is not, so it expires on
  // its own. That is the property @ts-ignore lacks and the reason the two are graded apart.
  assert.ok(!fires("suppression-comment", "// @ts-expect-error the SDK types lag the runtime (issue #4412)\nconst x = y.z;", "a.ts"));
});

test("deprecated-api: the named removal-path APIs are findings", () => {
  assert.ok(fires("deprecated-api", "stamp = datetime.utcnow()", "a.py"));
  assert.ok(fires("deprecated-api", "componentWillReceiveProps(next) {}", "a.jsx"));
  assert.ok(fires("deprecated-api", "const b = new Buffer(raw);", "a.js"));
});

test("deprecated-api: the replacements are NOT findings", () => {
  assert.ok(!fires("deprecated-api", "stamp = datetime.now(timezone.utc)", "a.py"));
  assert.ok(!fires("deprecated-api", "componentDidMount() {}", "a.jsx"));
  assert.ok(!fires("deprecated-api", "const b = Buffer.from(raw);", "a.js"));
});

test("dead-branch: a bare literal condition is a finding", () => {
  assert.ok(fires("dead-branch", "if (true) { ship(); }", "a.js"));
  assert.ok(fires("dead-branch", "if (false) { ship(); }", "a.js"));
  assert.ok(fires("dead-branch", "while (false) { poll(); }", "a.js"));
  assert.ok(fires("dead-branch", "if False:", "a.py"));
  assert.ok(fires("dead-branch", "elif True:", "a.py"));
  assert.ok(fires("dead-branch", "while False:", "a.py"));
});

test("dead-branch: the event loop and non-literal conditions are NOT findings", () => {
  assert.ok(!fires("dead-branch", "while (true) { const n = q.pop(); if (!n) return; }", "a.js"));
  assert.ok(!fires("dead-branch", "if (isReady === true) { ship(); }", "a.js"));
  assert.ok(!fires("dead-branch", "if (1) { ship(); }", "a.c"));
  assert.ok(!fires("dead-branch", "while True:", "a.py"));
  assert.ok(!fires("dead-branch", "if item is True:", "a.py"));
  assert.ok(!fires("dead-branch", "if (flag) { ship(); }", "a.js"));
});

test("async-foreach: forEach(async) is a finding, map(async) is not", () => {
  assert.ok(fires("async-foreach", "items.forEach(async (x) => { await go(x); });", "a.js"));
  assert.ok(!fires("async-foreach", "await Promise.all(items.map(async (x) => go(x)));", "a.js"));
  assert.ok(!fires("async-foreach", "items.forEach((x) => void go(x));", "a.js"));
  assert.ok(!fires("async-foreach", "for (const x of items) { await go(x); }", "a.js"));
});

test("catch-any: catch (e: any) is a finding, catch (e: unknown) is not", () => {
  assert.ok(fires("catch-any", "try { await sync(); } catch (e: any) { toast(e.message); }", "a.ts"));
  assert.ok(!fires("catch-any", "try { await sync(); } catch (e: unknown) { toast(String(e)); }", "a.ts"));
  assert.ok(!fires("catch-any", "try { await sync(); } catch (e) { toast(String(e)); }", "a.js"));
});

// ── Comment slop ─────────────────────────────────────────────────────────────

test("model-tooling-artifact: vendor tooling tokens are findings in code AND prose", () => {
  const token = "The timeout defaults to 30 seconds :contentReference[oaicite:3]{index=3}.";
  assert.ok(fires("model-tooling-artifact", `// ${token}`, "a.js"), "code surface");
  assert.ok(fires("model-tooling-artifact", token, "post.md"), "prose surface");
  assert.ok(fires("model-tooling-artifact", "See turn0search2 for the source.", "post.md"));
  assert.ok(fires("model-tooling-artifact", "Reported widely [cite: 12].", "post.md"));
});

test("model-tooling-artifact: ordinary markup that looks similar is NOT a finding", () => {
  assert.ok(!fires("model-tooling-artifact", "const citation = { id: 1 };", "a.js"));
  assert.ok(!fires("model-tooling-artifact", "let attributedString = render(x);", "a.js"));
  assert.ok(!fires("model-tooling-artifact", "See [1] and [2] for the derivation.", "post.md"));
  assert.ok(!fires("model-tooling-artifact", ":::note\nThe cache is warm.\n:::", "post.md"));
});

test("apologetic-comment: a comment apologising for the code is a finding", () => {
  assert.ok(fires("apologetic-comment", "# Note: this is a simplified implementation.", "a.py"));
  assert.ok(fires("apologetic-comment", "// Written for demonstration purposes only.", "a.js"));
  assert.ok(fires("apologetic-comment", "// This may need to be hardened for production.", "a.js"));
});

test("apologetic-comment: an ordinary comment using the same words is NOT a finding", () => {
  assert.ok(!fires("apologetic-comment", "# Minimal repro for issue 88; the full path lives in worker.py", "a.py"));
  assert.ok(!fires("apologetic-comment", "// Production build uses esbuild.", "a.js"));
});

test("deferral-comment: unfinished work signed off in prose is a finding", () => {
  assert.ok(fires("deferral-comment", "const rate = 0.08; // for now, hardcode the tax rate", "a.js"));
  assert.ok(fires("deferral-comment", "// temporary workaround until the pricing service lands", "a.js"));
  assert.ok(fires("deferral-comment", "// in a real implementation you would validate the signature", "a.js"));
  assert.ok(fires("deferral-comment", "// should work for most cases", "a.js"));
});

test("deferral-comment: a tracked deferral and a NOW identifier are NOT findings", () => {
  assert.ok(!fires("deferral-comment", "const rate = 0.08; // tax rate is fixed until PRICING-214 lands", "a.js"));
  assert.ok(!fires("deferral-comment", "const now = Date.now(); // wall clock", "a.js"));
  assert.ok(!fires("deferral-comment", "// works for NOW_UTC and LATER_UTC enums", "a.js"));
});

test("deferral-comment and apologetic-comment never double-report one comment", () => {
  // The apologetic rule owns "simplified implementation"; the deferral rule takes only
  // the noun form. Overlapping legs would report the same comment twice.
  const found = names("# Note: this is a simplified implementation.", "a.py");
  assert.ok(found.includes("apologetic-comment"));
  assert.ok(!found.includes("deferral-comment"));
});

test("banner-comment: two ASCII rules are a finding, one is not", () => {
  const two = "# ============================================\n# UTILITIES\n# ============================================\ndef go(): pass";
  const one = "// ==========================================\nfunction go() {}";
  assert.ok(fires("banner-comment", two, "a.py"));
  assert.ok(!fires("banner-comment", one, "a.js"));
});

test("banner-comment: a divider carrying real content is NOT a finding", () => {
  const withContent = "// ---- see RFC 9110 for the status ladder ----\n// ---- and RFC 9111 for caching ----\nfunction go() {}";
  assert.ok(!fires("banner-comment", withContent, "a.js"));
});

// ── Native (Apple) ───────────────────────────────────────────────────────────

test("fixed-font-size: a hardcoded point size is a finding", () => {
  assert.ok(fires("fixed-font-size", "Text(name).font(.system(size: 28, weight: .semibold))", "V.swift"));
});

test("fixed-font-size: relativeTo: and @ScaledMetric clear it", () => {
  assert.ok(!fires("fixed-font-size", "Text(name).font(.system(size: 17, relativeTo: .body))", "V.swift"));
  assert.ok(!fires("fixed-font-size", "@ScaledMetric var s = 24\nText(n).font(.system(size: s))", "V.swift"));
  assert.ok(!fires("fixed-font-size", "Text(name).font(.title2)", "V.swift"));
});

test("dispatch-main-async-spam: three hops are a finding, one bridge is not", () => {
  const three = "DispatchQueue.main.async { a() }\nDispatchQueue.main.async { b() }\nDispatchQueue.main.async { c() }";
  const one = "DispatchQueue.main.async { self.label.text = name }";
  assert.ok(fires("dispatch-main-async-spam", three, "M.swift"));
  assert.ok(!fires("dispatch-main-async-spam", one, "M.swift"));
});

// ── Prose ────────────────────────────────────────────────────────────────────

test("plain-aiism-collocation: two collocations are a finding, one is not", () => {
  const two = "They have been quietly building a second habit. Decisions compound, and the cost lands later.";
  const one = "Decisions compound, and the cost lands later than anyone budgets for.";
  assert.ok(fires("plain-aiism-collocation", two, "post.md"));
  assert.ok(!fires("plain-aiism-collocation", one, "post.md"));
});

test("plain-aiism-collocation: the literal uses of the same words are NOT findings", () => {
  const literal = "Interest compounds annually. He held the space open for the crane. " +
    "The signal that the sensor emits is a current loop. This matters to me.";
  assert.ok(!fires("plain-aiism-collocation", literal, "post.md"));
});

test("plain-aiism-collocation: the bare words stay out of the banned-word list", () => {
  // A word-level rule on real, shape, signal, hold, pull or land would be a
  // false-positive catastrophe; the whole rule exists to avoid exactly that.
  const plain = "The real shape of the signal is what we hold on to when the numbers land.";
  assert.equal(scanContent(plain, "post.md").length, 0);
});

// ── Widened rules ────────────────────────────────────────────────────────────

test("antithesis: the 'not about X, it's about Y' reframe is now caught", () => {
  assert.ok(fires("antithesis-not-just-x-y", "It's not about money, it's about trust.", "post.md"));
  assert.ok(fires("antithesis-not-just-x-y", "It's not really speed, it's the feedback loop.", "post.md"));
  assert.ok(fires("antithesis-not-just-x-y", "It's not just faster, it's cheaper.", "post.md"), "the original leg still fires");
});

test("antithesis: a single clause is still NOT a finding", () => {
  assert.ok(!fires("antithesis-not-just-x-y", "It's not about money.", "post.md"));
  assert.ok(!fires("antithesis-not-just-x-y", "This is not the file you edited; check the other one.", "post.md"));
});

test("generic-font: the 2026 successors are findings and a real face is not", () => {
  for (const face of ["Inter", "Geist", "Roboto", "Space Grotesk", "Manrope", "Plus Jakarta Sans", "Outfit", "DM Sans"]) {
    assert.ok(fires("generic-font", `body { font-family: '${face}', sans-serif; }`, "app.css"), face);
  }
  assert.ok(!fires("generic-font", "body { font-family: 'Söhne', system-ui; }", "app.css"));
  assert.ok(!fires("generic-font", "body { font-family: ui-serif, Georgia, serif; }", "app.css"));
});

test("generic-font: Poppins is deliberately absent from the family list", () => {
  // The evidence for Poppins is one self-published page calling it overused, and the
  // fleet's own font doctrine uses it as a deliberate accent face. Omitting it costs
  // the rule nothing; including it would fire on a stated design decision.
  assert.ok(!fires("generic-font", "body { font-family: 'Poppins', sans-serif; }", "app.css"));
});

test("cream-serif-default: the rusty-orange accent leg counts as a leg", () => {
  const withAccent = '<h1 class="bg-stone-50 text-orange-700">Field notes</h1>';
  assert.ok(fires("cream-serif-default", withAccent, "page.html"), "cream + rust is two legs");
  assert.ok(fires("cream-serif-default", '<div class="text-amber-700" style="background:#faf8f5">x</div>', "page.html"));
});

test("cream-serif-default: one accent leg alone is below the concentration threshold", () => {
  assert.ok(!fires("cream-serif-default", '<div class="border-orange-700">Heads up</div>', "page.html"));
  assert.ok(!fires("cream-serif-default", '<div class="bg-amber-50">Heads up</div>', "page.html"));
});

test("cream-serif-default: red error states and the 200 band are excluded", () => {
  const errors = '<div class="text-red-700 border-l-4 border-red-700">Failed</div>\n<div class="border-orange-200">x</div>';
  assert.ok(!fires("cream-serif-default", errors, "page.html"));
});

// ── Corpus fixtures for the suppressed-capture path (design + code) ───────────
// The capture path is ~110 lines of scan.mjs across four rule families and two
// suppression sources, and no corpus fixture reached it before 2.1.0: measure() calls the
// two-argument form, so the whole branch was dark under the harness.

test("suppressed capture: the design escape-hatch fixture is silent, and reports why", () => {
  const file = "design/hatched-wordmark.html";
  const content = corpus(file);
  assert.deepEqual(scanContent(content, file), [], "the hatched line must not produce an active finding");
  const suppressed = scanContent(content, file, { collectSuppressed: true });
  assert.deepEqual(
    suppressed.map((v) => [v.name, v.suppressedBy]),
    [["gradient-text", "escape-hatch"]],
  );
  assert.ok(suppressed.every((v) => v.suppressed === true));
});

test("suppressed capture: the code escape-hatch fixture covers three rule families", () => {
  const file = "code/hatched-onboarding.js";
  const content = corpus(file);
  assert.deepEqual(scanContent(content, file), [], "no active finding on a fully hatched file");
  const suppressed = scanContent(content, file, { collectSuppressed: true });
  assert.deepEqual(
    suppressed.map((v) => v.type).sort(),
    ["banned-phrase", "banned-word", "code-pattern"],
    "word, phrase and code-pattern capture all have to work on the code surface",
  );
  assert.ok(suppressed.every((v) => v.suppressedBy === "escape-hatch"));
});

test("suppressed capture: removing the markers restores exactly those findings", () => {
  // Without this the two tests above would pass on a file that had nothing to find.
  const strip = (text) => text.split("\n").map((l) => l.replace(/anti-slop-allow.*$/, "")).join("\n");
  const design = names(strip(corpus("design/hatched-wordmark.html")), "design/hatched-wordmark.html");
  assert.deepEqual(design, ["gradient-text"]);
  const code = names(strip(corpus("code/hatched-onboarding.js")), "code/hatched-onboarding.js");
  assert.ok(code.includes("innerhtml-usage"), `expected innerhtml-usage once unhatched, got ${JSON.stringify(code)}`);
});

// ── 2.2.0 additions (VibeCurb-derived, heuristic provenance) ─────────────────

test("bootstrap-default-blue: two Bootstrap compiled literals are a finding", () => {
  assert.ok(fires("bootstrap-default-blue", ".btn { background: #0d6efd; } .btn:hover { background: #0b5ed7; }", "app.css"));
  assert.ok(fires("bootstrap-default-blue", ".card { border: 1px solid #dee2e6; } a { color: #0d6efd; }", "app.css"));
});

test("bootstrap-default-blue: one literal is below the concentration floor", () => {
  assert.ok(!fires("bootstrap-default-blue", ".btn { background: #0d6efd; }", "app.css"));
});

test("bootstrap-default-blue: a themed blue is NOT a finding", () => {
  assert.ok(!fires("bootstrap-default-blue", ".btn { background: #1a56db; } .btn:hover { background: #1648b8; } .card { border: 1px solid #d8d2c4; }", "app.css"));
});

test("bootstrap-default-blue: design rules stay off native surfaces", () => {
  assert.ok(!fires("bootstrap-default-blue", "// #0d6efd #0b5ed7 in a comment", "View.swift"));
});

// ── 2.2.1 recalibration ──────────────────────────────────────────────────────
// The literal moved out of generic-microcopy into hero-scroll-hint, and
// bootstrap-default-blue gained the requires-blue file gate. Both directions of each are
// asserted here; the false-positive shapes that forced the change are in
// rule-false-positives.test.mjs, next to the rest of the negative direction.

test("hero-scroll-hint: the hero scroll literal is a finding, and it is no longer generic-microcopy", () => {
  const found = names('<span class="hint">Scroll to explore</span>', "Hero.tsx");
  assert.ok(found.includes("hero-scroll-hint"), `expected hero-scroll-hint, got ${JSON.stringify(found)}`);
  assert.ok(!found.includes("generic-microcopy"), "the literal must not fire the host rule it was split out of");
});

test("hero-scroll-hint: product-specific scroll copy is NOT a finding", () => {
  assert.ok(!fires("hero-scroll-hint", '<span class="hint">Scroll for the 2019-2026 price history</span>', "Hero.tsx"));
});

test("hero-scroll-hint: it is graded as a smell, not as the host rule's Quality defect", () => {
  const [violation] = scanContent('<span class="hint">Scroll to explore</span>', "Hero.tsx");
  assert.equal(violation.name, "hero-scroll-hint");
  assert.equal(violation.confidence, "Pattern smell");
});

test("generic-microcopy: the rest of the family still fires without the scroll literal", () => {
  assert.ok(fires("generic-microcopy", '<h1>Welcome back!</h1>', "Dashboard.tsx"));
  assert.ok(fires("generic-microcopy", '<p>Join thousands of happy people</p>', "Landing.tsx"));
});

// ── 2.4.0 additions ──────────────────────────────────────────────────────────
// Two accessibility defects and one type-safety defect that generated code ships often
// and no rule reached. Each is asserted in both directions, and the negative direction
// carries the CORRECT form of the same construct rather than an unrelated clean file:
// that is what catches a rule which has learned to match the construct, not the defect.

test("viewport-zoom-lock: a viewport meta that blocks pinch zoom is a finding", () => {
  const scalable = '<meta name="viewport" content="width=device-width, initial-scale=1, user-scalable=no">';
  const zero = '<meta name="viewport" content="width=device-width, user-scalable=0">';
  const capped = '<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">';
  const cappedFloat = '<meta name="viewport" content="width=device-width, maximum-scale=1.0">';
  for (const html of [scalable, zero, capped, cappedFloat]) {
    assert.ok(fires("viewport-zoom-lock", html, "index.html"), `expected a finding on: ${html}`);
  }
});

test("viewport-zoom-lock: the correct viewport meta and a usable zoom cap are NOT findings", () => {
  assert.ok(!fires("viewport-zoom-lock", '<meta name="viewport" content="width=device-width, initial-scale=1">', "index.html"));
  // A cap of 5 still leaves the user a range; 1 is the one that removes the control.
  assert.ok(!fires("viewport-zoom-lock", '<meta name="viewport" content="width=device-width, maximum-scale=5">', "index.html"));
  assert.ok(!fires("viewport-zoom-lock", '<meta name="viewport" content="width=device-width, maximum-scale=1.5">', "index.html"));
  // maximum-scale=10 must not match through the "1" that starts it.
  assert.ok(!fires("viewport-zoom-lock", '<meta name="viewport" content="width=device-width, maximum-scale=10">', "index.html"));
  // The attributes without the viewport meta around them are some other API's options.
  assert.ok(!fires("viewport-zoom-lock", "const opts = { userScalable: false };", "map.js"));
});

test("positive-tabindex: a hand-numbered focus order is a finding, in markup and in JSX", () => {
  assert.ok(fires("positive-tabindex", '<input id="q" tabindex="3">', "search.html"));
  assert.ok(fires("positive-tabindex", '<input id="q" tabIndex={2} />', "Search.tsx"));
  assert.ok(fires("positive-tabindex", "<input id='q' tabindex='1'>", "search.html"));
});

test("positive-tabindex: 0 and -1 are the two correct values and stay clean", () => {
  assert.ok(!fires("positive-tabindex", '<input id="q" tabindex="0">', "search.html"));
  assert.ok(!fires("positive-tabindex", '<div role="region" tabindex="-1">Results</div>', "search.html"));
  assert.ok(!fires("positive-tabindex", "<div ref={panel} tabIndex={-1} />", "Search.tsx"));
  assert.ok(!fires("positive-tabindex", "<div ref={panel} tabIndex={0} />", "Search.tsx"));
});

test("cast-to-any: a TypeScript escape cast is a finding", () => {
  assert.ok(fires("cast-to-any", "const invoice = raw as any;", "src/ledger.ts"));
  assert.ok(fires("cast-to-any", "total += (row as any).cents;", "src/ledger.ts"));
});

test("cast-to-any: unknown, a longer identifier, and Swift/Kotlin `as Any` are NOT findings", () => {
  assert.ok(!fires("cast-to-any", "const raw = payload as unknown;", "src/ledger.ts"));
  assert.ok(!fires("cast-to-any", "const v = input as anyValue;", "src/ledger.ts"));
  // Case-sensitive on purpose: the existential cast is the correct idiom on both platforms.
  assert.ok(!fires("cast-to-any", "let boxed = value as Any", "Model.swift"));
  assert.ok(!fires("cast-to-any", "val boxed = value as Any", "Model.kt"));
});

test("cast-to-any and catch-any never double-report the same line", () => {
  const found = names("try { go(); } catch (e: any) { log(e); }", "src/ledger.ts");
  assert.ok(found.includes("catch-any"), `expected catch-any, got ${JSON.stringify(found)}`);
  assert.ok(!found.includes("cast-to-any"), "a catch binding is catch-any's finding, not a cast");
});

test("cast-to-any: the corpus pair fires on the positive and stays silent on the control", () => {
  assert.ok(fires("cast-to-any", corpus("code/cast-to-any.ts"), "code/cast-to-any.ts"));
  assert.deepEqual(names(corpus("code/typed-narrowing.ts"), "code/typed-narrowing.ts"), []);
});

test("the 2.4.0 accessibility pair fires on the corpus positive and stays silent on the control", () => {
  const found = names(corpus("design/zoom-lock-tabindex.html"), "design/zoom-lock-tabindex.html");
  assert.deepEqual(found.sort(), ["positive-tabindex", "viewport-zoom-lock"]);
  assert.deepEqual(names(corpus("design/viewport-clean.html"), "design/viewport-clean.html"), []);
});

// ── The remediation floor, end to end (2.4.0) ────────────────────────────────
// The rule tables are checked for a `fix` in rule-metadata.test.mjs. This is the other
// half: that the fix and the line actually reach the emitted violation, for a family from
// each of the four tables and for the four families inlined in scan.mjs.

test("every emitted violation carries a fix and the line it was found on", () => {
  const samples = [
    ["Great question! We delve into the tapestry here.\n\nIn conclusion \u{1F680}.\n", "post.md"],
    ["const a = 1;\nelement.innerHTML = userInput;\n", "src/render.js"],
    ["h1 { background-clip: text; color: transparent; }\n", "page.css"],
    ["let w = UIScreen.main.bounds.width\n", "View.swift"],
  ];
  for (const [content, path] of samples) {
    const violations = scanContent(content, path, { proseScope: "all" });
    assert.ok(violations.length > 0, `expected findings for ${path}`);
    for (const v of violations) {
      assert.ok(typeof v.fix === "string" && v.fix.length > 0, `${path} finding has no fix: ${JSON.stringify(v)}`);
      assert.ok(Number.isInteger(v.line) && v.line >= 1, `${path} finding has no line: ${JSON.stringify(v)}`);
    }
  }
});

test("the reported line is the line the tell is actually on", () => {
  const js = ["const a = 1;", "const b = 2;", "// a naive implementation, for now", "eval(input);"].join("\n");
  const found = scanContent(js, "src/run.js");
  assert.equal(found.find((v) => v.name === "eval-usage").line, 4);
  // A comment tell on a code surface is scanned through extractComments, which preserves
  // the line count precisely so this number is the file's line and not the comment's index.
  assert.equal(found.find((v) => v.name === "apologetic-comment").line, 3);
});
