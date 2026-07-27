import { test } from "node:test";
import assert from "node:assert/strict";
import { scanContent } from "../lib/scan.mjs";

const names = (content, path) => scanContent(content, path).map((v) => v.name);
const fires = (rule, content, path) => names(content, path).includes(rule);

// ── Item 1: the hero type scale ──────────────────────────────────────────────
// The rule catches the VERBATIM Tailwind default triplet as a genericness signal. It is
// not a rule against responsive typography: a remediation that deletes fluid type scaling
// makes the page worse and breaks WCAG 1.4.4, so any match wide enough to be cleared that
// way is the wrong match.

test("hero triplet: the verbatim Tailwind default run is a finding", () => {
  const html = '<h1 class="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight">Ship faster</h1>';
  assert.ok(fires("tailwind-hero-triplet", html, "hero.html"));
});

test("hero triplet: a responsive scale on different steps is NOT a finding", () => {
  const html = '<h1 class="text-3xl md:text-5xl xl:text-7xl font-semibold tracking-tighter">Ship faster</h1>';
  assert.ok(!fires("tailwind-hero-triplet", html, "hero.html"));
});

test("hero triplet: a fluid clamp() ramp is NOT a finding", () => {
  const css = "h1 { font-size: clamp(2rem, 1.2rem + 3.2vw, 4.5rem); letter-spacing: -0.025em; }";
  assert.ok(!fires("tailwind-hero-triplet", css, "type.css"));
});

test("hero triplet: a single responsive size step is NOT a finding", () => {
  const html = '<h1 class="text-5xl font-bold">Ship faster</h1>';
  assert.ok(!fires("tailwind-hero-triplet", html, "hero.html"));
});

// ── Item 1 sibling: !important on the reduced-motion idiom ───────────────────
// `* { transition: none !important }` inside a prefers-reduced-motion block is the
// canonical, correct implementation of WCAG 2.3.3. Flagging it invites a "fix" that
// deletes motion-preference handling, which is the same failure mode as the hero rule.

test("important-overuse: the reduced-motion idiom is NOT a finding", () => {
  const css = "@media (prefers-reduced-motion: reduce) {\n  * { transition: none !important; animation: none !important; }\n}";
  assert.ok(!fires("important-overuse", css, "base.css"));
});

test("important-overuse: a lone pragmatic override is NOT a finding", () => {
  const css = ".vendor-widget .title { color: var(--ink) !important; }";
  assert.ok(!fires("important-overuse", css, "overrides.css"));
});

test("important-overuse: genuine overuse still fires", () => {
  const css = [
    ".a { color: red !important; }",
    ".b { background: white !important; }",
    ".c { margin: 0 !important; }",
    ".d { padding: 0 !important; }",
  ].join("\n");
  assert.ok(fires("important-overuse", css, "styles.css"));
});

// ── Item 3: concentration thresholds ─────────────────────────────────────────

test("rounded-everything: a lone radius hit is NOT a finding (the floor rule)", () => {
  const html = '<span class="rounded-full h-8 w-8"><img src="/a.png" alt="Ada"></span>';
  assert.ok(!fires("rounded-everything", html, "avatar.html"));
});

test("rounded-everything: two radius hits are still NOT a finding", () => {
  const css = ".btn { border-radius: 999px; }\n.pill { border-radius: 999px; }";
  assert.ok(!fires("rounded-everything", css, "two.css"));
});

test("rounded-everything: the same radius on every control IS a finding", () => {
  const html = [
    '<input class="rounded-full border px-4">',
    '<select class="rounded-full border px-4"></select>',
    '<textarea class="rounded-full border px-4"></textarea>',
    '<button class="rounded-full px-4">Save</button>',
  ].join("\n");
  assert.ok(fires("rounded-everything", html, "form.html"));
});

test("cream-serif-default: one leg of the combination is NOT a finding", () => {
  const css = "body { background: #faf8f5; font-family: Charter, Georgia, serif; }";
  assert.ok(!fires("cream-serif-default", css, "one-leg.css"));
});

test("cream-serif-default: two legs of the combination ARE a finding", () => {
  const css = 'body { background: #faf8f5; }\nh1 { font-family: "Instrument Serif", serif; }';
  assert.ok(fires("cream-serif-default", css, "combo.css"));
});

test("ai-purple-class: a lone indigo utility is NOT a finding", () => {
  const html = '<a class="text-indigo-600 underline">Read the changelog</a>';
  assert.ok(!fires("ai-purple-class", html, "link.html"));
});

test("ai-purple-class: indigo used as the palette IS a finding", () => {
  const html = [
    '<button class="bg-indigo-600 text-white">Get started</button>',
    '<div class="border-indigo-500"><span class="text-indigo-700">New</span></div>',
  ].join("\n");
  assert.ok(fires("ai-purple-class", html, "hero.html"));
});

// ── Item 7: native tells ─────────────────────────────────────────────────────

test("native: UIScreen.main.bounds is a finding", () => {
  const swift = "let cardWidth = UIScreen.main.bounds.width - 32";
  assert.ok(fires("uiscreen-bounds", swift, "CardView.swift"));
});

test("native: a fixed content-width frame is a finding", () => {
  const swift = "VStack { Text(title) }.frame(width: 320)";
  assert.ok(fires("fixed-content-frame", swift, "DetailView.swift"));
});

test("native: a small control frame is NOT a finding", () => {
  const swift = "Image(systemName: \"gear\").frame(width: 44, height: 44)";
  assert.ok(!fires("fixed-content-frame", swift, "IconButton.swift"));
});

test("native: branching on the device idiom is a finding", () => {
  const swift = "if UIDevice.current.userInterfaceIdiom == .pad { wide() } else { narrow() }";
  assert.ok(fires("device-idiom-branch", swift, "RootView.swift"));
});

test("native: a fixed grid column array is a finding", () => {
  const swift = "let columns = [GridItem(.fixed(300)), GridItem(.fixed(300))]";
  assert.ok(fires("fixed-grid-columns", swift, "Grid.swift"));
});

test("native: an adaptive grid is NOT a finding", () => {
  const swift = "let columns = [GridItem(.adaptive(minimum: 280, maximum: 420), spacing: 16)]";
  assert.ok(!fires("fixed-grid-columns", swift, "Grid.swift"));
});

test("native: a repeating symbol effect is a finding", () => {
  const swift = 'Image(systemName: "dot.radiowaves.left.and.right").symbolEffect(.pulse, options: .repeating)';
  assert.ok(fires("repeating-symbol-effect", swift, "LiveBadge.swift"));
});

test("native: a one-shot symbol effect is NOT a finding", () => {
  const swift = 'Image(systemName: "checkmark").symbolEffect(.bounce, value: saved)';
  assert.ok(!fires("repeating-symbol-effect", swift, "SaveButton.swift"));
});
