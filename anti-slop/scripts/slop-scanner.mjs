import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { createServer } from "http";
import { createConnection } from "net";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join, dirname, extname, basename } from "path";
import { fileURLToPath, pathToFileURL } from "url";
import { createHash } from "crypto";
import { homedir } from "os";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Banned Words (top 50 highest-signal, prose-only) ──
export const BANNED_WORDS = [
  "delve", "delving", "leverage", "leveraging", "utilize", "utilizing",
  "harness", "harnessing", "streamline", "foster", "fostering",
  "cultivate", "elevate", "empower", "empowering", "embark",
  "unveil", "unveiling", "showcase", "showcasing", "spearhead",
  "orchestrate", "synergize", "galvanize", "transcend",
  "pivotal", "seamless", "cutting-edge", "groundbreaking",
  "transformative", "unprecedented", "unparalleled", "multifaceted",
  "vibrant", "bustling", "captivating", "enchanting",
  "landscape", "tapestry", "realm", "synergy", "testament",
  "interplay", "paradigm", "intersection",
  "gossamer", "iridescent", "luminous", "ephemeral", "ethereal", "enigmatic",
  // Inflated/low-confidence words: kept in the list but flagged only on clustering
  // (count >= 2) at low severity, via LOW_CONFIDENCE_WORDS below.
  "comprehensive", "robust", "navigate", "nuanced", "meticulous", "facilitate",
  "holistic", "myriad", "plethora", "paramount", "intricate", "profound",
];

// ── Low-confidence words: high keyword-match but rarely cited as a real tell ──
// (Reddit corpus, see references/empirical-rankings.md). Flagged only when they
// CLUSTER (count >= 2), at "low" severity. A lone hit is treated as clean.
export const LOW_CONFIDENCE_WORDS = new Set([
  "utilize", "utilizing", "comprehensive", "robust", "navigate", "nuanced",
  "meticulous", "harness", "harnessing", "seamless", "foster", "fostering",
  "facilitate", "streamline", "leverage", "leveraging", "realm", "holistic",
  "myriad", "plethora", "paramount", "intricate", "vibrant", "captivating",
  "profound", "empower", "empowering", "cultivate",
]);

// ── Escape hatch: a line carrying this marker is a deliberate choice; skip it. ──
const ESCAPE_HATCH = /(?:anti-slop-allow|unslop-ignore)\b/i;

// ── Em dash density (prose): the #1 cited writing tell. Flag on concentration, ──
// not a single legitimate dash. Counts only after prose noise-stripping.
const EMDASH_MIN_COUNT = 5;     // ignore a handful of legitimate dashes
const EMDASH_MIN_DENSITY = 4;   // per 1000 words before it counts

// ── Banned Phrases (top 40 highest-signal) ──
export const BANNED_PHRASES = [
  "great question", "that's a great question", "absolutely!",
  "certainly!", "you're absolutely right", "i'd be happy to help", "i'd be happy to assist",
  "hope this helps", "feel free to", "let me know if you have",
  "does that make sense", "here's the thing", "let me walk you through",
  "let me break this down", "let's dive in", "let's unpack this",
  "it's worth noting", "it's important to note", "at the end of the day",
  "in today's", "in a world where", "at its core",
  "in conclusion", "to sum up", "in summary",
  "game-changer", "paradigm shift", "deep dive",
  "the implications are significant", "the stakes are high",
  "embark on a journey", "navigate the complexities",
  "pave the way", "watershed moment", "a beacon of",
  "a tapestry of", "a testament to", "ever-evolving",
  "key takeaways", "without further ado",
];

// ── UI Design Patterns (severity per rule; optional `suppress` skips a line) ──
// Ordered roughly by empirical signal. Severity reflects the corpus ranking:
// shadcn-default / purple / gradients are the strongest; the rest are lighter.
export const DESIGN_PATTERNS = [
  { name: "purple-gradient-default", severity: "medium", pattern: /from-(indigo|purple|violet)-[45]00\s.*to-(indigo|purple|violet)-[56]00/i, desc: "Purple/indigo gradient (Tailwind AI default)" },
  { name: "purple-blue-gradient", severity: "medium", pattern: /from-(purple|violet|indigo|fuchsia)-\d+\s+(via-[a-z]+-\d+\s+)?to-(blue|indigo|pink|cyan|sky)-\d+|linear-gradient\([^)]*#(6366f1|7c3aed|8b5cf6|a855f7)[^)]*\)/i, desc: "Purple-to-blue/pink gradient" },
  { name: "ai-purple-hex", severity: "low", pattern: /#(6366f1|4f46e5|818cf8|7c3aed|6d28d9|8b5cf6|a855f7|9333ea|7e22ce|c026d3|d946ef)\b/i, desc: "AI purple (indigo/violet hex as brand color)" },
  { name: "ai-purple-class", severity: "medium", pattern: /\b(bg|text|from|via|to|border|ring|fill|stroke|decoration|outline)-(indigo|violet|purple|fuchsia)-(400|500|600|700|800)\b/i, desc: "AI purple as primary (Tailwind indigo/violet/purple class)" },
  { name: "gradient-text", severity: "medium", pattern: /bg-clip-text\s[^"]*text-transparent|text-transparent\s[^"]*bg-clip-text|-webkit-background-clip\s*:\s*text|\bbackground-clip\s*:\s*text/i, desc: "Gradient text on heading (strong AI tell)" },
  { name: "cream-serif-default", severity: "low", pattern: /#(faf8f5|f5f1e8|f3eee3|fdfbf7|f7f3ec|faf6ef|f6f1e7|fbf7f0|f4efe4)\b|\bbg-(stone|amber|orange)-(50|100)\b|\b(Instrument\s*Serif|Fraunces|Playfair\s*Display|Cormorant|Spectral|DM\s*Serif)\b/i, desc: "Cream/serif 'tasteful default' (the 2026 tell)" },
  { name: "shadcn-default-card", severity: "low", pattern: /rounded-lg\s+border\s+bg-card\s+text-card-foreground\s+shadow-sm|"baseColor"\s*:\s*"(slate|zinc|gray|neutral|stone)"|--radius\s*:\s*0\.5rem/i, desc: "Un-themed shadcn default card kit" },
  { name: "icon-in-colored-circle", severity: "medium", pattern: /rounded-full\s[^"]*bg-[a-z]+-100\s[^"]*p-3/i, desc: "Icon in colored circle background" },
  { name: "frosted-glass-nav", severity: "medium", pattern: /backdrop-blur[^\s]*\s[^"]*bg-white\/[0-9]+\s[^"]*border-b/i, desc: "Frosted glass navigation bar" },
  { name: "shadow-border-rounded-combo", severity: "medium", pattern: /shadow-sm\s[^"]*border\s[^"]*rounded-xl/i, desc: "shadow-sm + border + rounded-xl AI card combo" },
  { name: "neon-glow", severity: "low", pattern: /shadow-\[0_0_|drop-shadow-\[0_0_|box-shadow\s*:[^;]*\b0\s+0\s+\d{2,}px/i, desc: "Unprompted neon glow (dark-mode tell)" },
  { name: "rounded-everything", severity: "low", pattern: /\brounded-(2xl|3xl|full)\b|border-radius\s*:\s*(999\d*px|9999px)/i, suppress: /\b[hw]-(\d|10|11|12|14|16)(\.5)?\b/i, desc: "Maximal rounding on everything (cards/pills)" },
  { name: "generic-font", severity: "low", pattern: /font-family\s*:\s*['"]?(Inter|Geist|Roboto)\b|\b(Inter|Geist|Geist_Mono|Roboto)\s*\(/i, desc: "Generic default font (Inter/Geist/Roboto)" },
  { name: "hype-copy", severity: "low", pattern: /\bTransform your\b|\bSupercharge\b|\bUnleash\b|\bEffortlessly\b|take your [^.]{0,30}to the next level/i, desc: "Marketing hype copy in UI" },
  { name: "stock-illustration", severity: "low", pattern: /\b(undraw|storyset|drawkit)\b/i, desc: "Generic stock illustration (undraw/storyset)" },
  { name: "z-index-escalation", severity: "medium", pattern: /z-(?:index:\s*|\[)(?:999|9999|99999)/i, desc: "z-index escalation (999+)" },
  { name: "important-overuse", severity: (c) => (c > 3 ? "high" : "medium"), pattern: /!important/gi, desc: "!important usage" },
];

// ── Code Patterns (severity per rule) ──
export const CODE_PATTERNS = [
  { name: "full-lodash-import", severity: "medium", pattern: /import\s+_\s+from\s+['"]lodash['"]/g, desc: "Full lodash import (use cherry-picked imports)" },
  { name: "full-moment-import", severity: "medium", pattern: /import\s+moment\s+from\s+['"]moment['"]/g, desc: "moment.js import (use dayjs or date-fns)" },
  { name: "eval-usage", severity: "high", pattern: /\beval\s*\(/g, desc: "eval() usage (security risk)" },
  { name: "innerhtml-usage", severity: "high", skipInTests: true, pattern: /\.innerHTML\s*=/g, desc: "innerHTML assignment (XSS risk)" },
  // Word-boundary on the key avoids compound identifiers (colorToken, currentPassword,
  // URL_CHANGE_PASSWORD); the value lookahead excludes URLs/paths/CSS vars/hex that are
  // never secrets. Test/fixture files are skipped (fake creds live there). "Possible",
  // not definite: a candidate for a human read, not a confirmed leak.
  { name: "hardcoded-secret", severity: "high", skipInTests: true, pattern: /\b(?:api[_-]?key|password|secret|token)\s*[:=]\s*['"](?!\/|https?:|\.\.?\/|var\(|--|#[0-9a-fA-F])[^'"]{8,}['"]/gi, desc: "Possible hardcoded credential" },
  { name: "console-log-emoji", severity: "medium", pattern: /console\.log\s*\(\s*['"][^\n]*[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE00}-\u{FE0F}\u{1F000}-\u{1FAFF}]/gu, desc: "Emoji in console.log" },
  { name: "img-no-dimensions", severity: "medium", pattern: /<img\s(?![^>]*(?:width|height))[^>]*>/gi, desc: "<img> without width/height (causes CLS)" },
  { name: "useeffect-setstate", severity: "medium", pattern: /useEffect\s*\(\s*\(\s*\)\s*=>\s*\{[^}]*set[A-Z]\w*\s*\(/g, desc: "useEffect setting state (likely derived state)" },
  // AI-tell code patterns from the corpus study (high precision when present)
  { name: "chat-artifact", severity: "high", pattern: /\bhere'?s the (updated|complete|full|fixed|revised|new) (code|version|implementation|file)\b|\bas an? (ai|a\.i\.) (language )?model\b|\b(good|great) catch!|\byou'?re absolutely right\b|\bi hope this helps\b/gi, desc: "Leftover chat artifact (assistant voice in code)" },
  { name: "placeholder-comment", severity: "high", pattern: /(\/\/|#|\/\*|\*|--|<!--)\s*\.{2,}\s*(rest|the rest|your|remaining|existing|previous|other)\b|(\/\/|#|\/\*|\*|--|<!--)\s*(rest|remainder) of (your |the |my )?(code|implementation|logic|function|file)\b|(\/\/|#|\/\*|\*|--|<!--)\s*(your|the) (code|logic|implementation|stuff) (goes )?here\b|(\/\/|#|\/\*|\*|--|<!--)\s*(add|insert|implement|put) (your )?(code|logic|implementation) here\b|(\/\/|#|\/\*|\*|--|<!--)\s*(implementation|code|logic) (goes|go) here\b|(\/\/|#|\/\*|\*|--|<!--)\s*existing code (here|unchanged|stays|remains)\b|(\/\/|#|\/\*|\*|--|<!--)\s*TODO:?\s*(implement|add|fill in|finish)\b/gi, desc: "Placeholder-comment stub (file unfinished -- a bug)" },
  { name: "narrating-comment", severity: "low", pattern: /(\/\/|#|\/\*|\*|--)\s*(step\s*\d+\b|now we\b|first,|next,|then,|finally,)|(\/\/|#|\/\*|\*|--)\s*(increment|decrement|initialize|declare|instantiate|loop (over|through)|iterate over|return the|set the|get the|call the)\b|(\/\/|#|\/\*|\*|--)\s*this (function|method|line|loop|variable|class|block) (does|handles|returns|creates)\b|(\/\/|#|\/\*|\*|--)\s*(import|importing) (the |required )?(libraries|modules|dependencies)\b/gi, desc: "Narrating comment (restates the code)" },
  { name: "swallowed-error", severity: "medium", pattern: /^\s*except\s*:|^\s*except\s+(Exception|BaseException)\s*:\s*(pass|\.\.\.)\s*$|\bcatch\s*\([^)]*\)\s*\{\s*\}|\bcatch\s*\{\s*\}|\bcatch\s*\([^)]*\)\s*\{\s*\/\/[^\n]*\}|\bif\s+err\s*!=\s*nil\s*\{\s*\}|\bif\s+err\s*!=\s*nil\s*\{\s*\/\/[^\n]*\}/g, desc: "Swallowed error (bare except / empty catch / empty Go err block) -- a bug" },
  { name: "generic-naming", severity: "low", pattern: /\b(def|function|func|fn|fun|sub)\s+(process_?[Dd]ata|handle_?[Dd]ata|do_?[Ss]tuff|do_?[Ss]omething|my_?[Ff]unction|process_?[Ii]tem|process_?[Ii]nput|main_?[Ff]unction)\b/g, desc: "Generic placeholder function name" },
  { name: "boilerplate-marker", severity: "low", skipInTests: true, pattern: /\blorem ipsum\b|\bYOUR_API_KEY\b|\b(your|my)[-_]?api[-_]?key\b|\bexample\.com\b|\b(John|Jane) (Doe|Smith)\b|['"]sk-(xxx|your|placeholder|123)/gi, desc: "Tutorial/boilerplate marker (dummy data)" },
];

// ── Text constructs (prose only): regex-detectable sentence/format tells ──
// Severity follows the corpus ranking. Emitted only after prose noise-stripping
// (code fences, quotes, blockquotes, frontmatter, and escape-hatch lines blanked).
export const TEXT_CONSTRUCTS = [
  { name: "antithesis-not-just-x-y", severity: "medium", pattern: /\b(it'?s|its|it is|that'?s|this is|they'?re)\s+not\s+(just|only|merely|simply)\b[^.?!\n]{0,60}\bit'?s\b/gi, desc: '"It\'s not just X, it\'s Y" antithesis (#1 sentence tell)' },
  { name: "antithesis-not-only-but", severity: "low", pattern: /\bnot\s+(just|only|merely|simply)\s+(a |an |the )?[\w-]+,?\s+but\b/gi, desc: '"not only X, but Y" antithesis' },
  { name: "assistant-boilerplate", severity: "high", pattern: /\bas an? (ai|a\.i\.) (language )?model\b|\bas a large language model\b|\bi (cannot|can'?t|am unable to) (assist|help|fulfil|fulfill|comply|provide)\b|\bas of my last (knowledge )?(update|training)\b|\bknowledge cut[- ]?off\b|\bi (do not|don'?t) have (personal|the ability|access|feelings|opinions)\b/gi, desc: "Leftover assistant boilerplate (as-an-AI / refusal / cutoff)" },
  { name: "assistant-offer", severity: "medium", pattern: /\bwould you like me to\b|\bis there anything else i can\b|\bi hope this (helps|email finds you well)\b/gi, desc: "Trailing assistant offer / sign-off" },
  { name: "dive-in", severity: "low", pattern: /\b(deep dive|dive in(to)?|let'?s dive|diving in|dive deep)\b/gi, desc: '"dive in" / "deep dive" opener' },
  { name: "listicle-scaffold", severity: "low", pattern: /(^|\s)#{0,4}\s*\d+\s+(ways|tips|signs|reasons|things|steps|tricks|secrets|lessons|mistakes|rules)\b/gi, desc: 'Listicle scaffolding ("N ways to...")' },
  { name: "fast-paced-opener", severity: "low", pattern: /\bin today'?s\s+(fast[- ]?paced|digital|ever[- ]?changing|modern|competitive)?\s*(world|age|landscape|era|society|market)\b|\bin (the|this) (modern|digital) (world|age|era)\b/gi, desc: '"In today\'s fast-paced world" opener' },
  { name: "unlock-potential", severity: "low", pattern: /\b(unlock|unleash|tap into)\w*\s+(the\s+|your\s+|its\s+|their\s+|full\s+)*(power|potential|capabilities|secrets)\b/gi, desc: '"unlock the potential" hype' },
  { name: "in-conclusion", severity: "low", pattern: /\bin (conclusion|summary)\b|\bto (summari[sz]e|conclude|wrap (this |it )?up)\b|\bin closing\b/gi, desc: '"In conclusion / In summary" closer' },
  { name: "honestly-opener", severity: "low", pattern: /(^|\n)\s*honestly,\s|\blet'?s be (honest|real)\b/gi, desc: '"Honestly," / "Let\'s be real" opener' },
  { name: "hr-divider", severity: "low", pattern: /^\s{0,3}(---+|\*\*\*+|___+)\s*$/gm, desc: "Horizontal-rule divider between sections" },
  { name: "hype-marketing", severity: "low", pattern: /\brevolution(ary|i[sz]e)\b|\btransform your (life|business|workflow)\b|\bto the next level\b|\bsupercharge\b|\bsay goodbye to\b|\blook no further\b|\bbuckle up\b|\bwithout further ado\b/gi, desc: "Marketing hype (revolutionary / supercharge)" },
];

// ── Context Exceptions ──
// If any of these domain words appear in the file, the banned word is likely legitimate
export const CONTEXT_EXCEPTIONS = {
  "realm": ["server", "wow", "warcraft", "mmo", "game", "character", "guild", "blizzard", "horde", "alliance", "dungeon", "raid", "player", "azeroth"],
  "enchanting": ["enchant", "wow", "warcraft", "spell", "magic", "item", "gear", "weapon", "profession", "disenchant"],
  "landscape": ["terrain", "geography", "map", "topograph", "satellite", "gis", "orientation", "portrait"],
  "tapestry": ["fabric", "weave", "textile", "cloth", "thread", "loom"],
  "luminous": ["light", "lumen", "brightness", "display", "hdr", "backlight", "nit", "candela", "shader"],
  "ethereal": ["ethereum", "eth", "blockchain", "crypto", "network", "protocol", "web3"],
  "ephemeral": ["container", "storage", "port", "cache", "session", "kubernetes", "docker", "k8s", "ttl", "expir"],
  "paradigm": ["programming", "oop", "functional", "declarative", "design pattern", "methodology"],
  "intersection": ["set", "array", "math", "geometry", "road", "traffic", "union", "typescript", "venn"],
  "synergy": ["damage", "buff", "skill", "ability", "combo", "stat", "bonus", "perk"],
  "vibrant": ["color", "saturation", "hue", "display", "gamut", "profile", "palette"],
  "captivating": ["audience", "player", "viewer", "retention", "analytics"],
  "testament": ["bible", "scripture", "religious", "church", "covenant"],
  "gossamer": ["fabric", "silk", "textile", "material", "spider"],
  "iridescent": ["material", "shader", "surface", "coating", "finish", "pearl", "holographic"],
  "enigmatic": ["puzzle", "cipher", "mystery", "riddle", "cryptograph"],
  "orchestrate": ["orchestra", "music", "conductor", "symphony", "instrument", "kubernetes", "k8s", "workflow engine"],
  "bustling": ["city", "market", "port", "town", "npc", "merchant"],
  "pivotal": ["pivot table", "pivot point", "agile", "sprint"],
  "seamless": ["seam", "stitch", "texture", "tile", "tilemap"],
  "harness": ["test harness", "wiring harness", "cable harness", "playwright", "cypress", "webdriver", "e2e"],
};

// ── Emoji detection ──
const EMOJI_REGEX = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE00}-\u{FE0F}\u{1F000}-\u{1FAFF}]/gu;

// ── File type detection ──
const PROSE_EXTENSIONS = new Set([".md", ".mdx", ".txt", ".rst"]);
const CODE_EXTENSIONS = new Set([".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs", ".py", ".rb", ".go", ".rs", ".java", ".cs", ".php", ".c", ".h", ".cpp", ".cc", ".hpp", ".kt", ".kts", ".swift", ".scala", ".m", ".mm", ".sh", ".bash", ".lua", ".dart", ".sql", ".r"]);
const STYLE_EXTENSIONS = new Set([".css", ".scss", ".less", ".html", ".htm", ".jsx", ".tsx", ".vue", ".svelte"]);

// ── Multi-project support ──
const PROJECT_PATH = process.cwd();
const PROJECT_NAME = basename(PROJECT_PATH);
const REGISTRY_DIR = join(homedir(), ".anti-slop");
const REGISTRY_FILE = join(REGISTRY_DIR, "registry.json");
let DASHBOARD_PORT = null;

function getPreferredPort() {
  const hash = createHash("md5").update(PROJECT_PATH).digest("hex");
  return 7847 + (parseInt(hash.substring(0, 8), 16) % 1000);
}

function checkPort(port) {
  if (!port || typeof port !== "number") return Promise.resolve(false);
  return new Promise((resolve) => {
    let resolved = false;
    const done = (result) => { if (!resolved) { resolved = true; clearTimeout(timer); resolve(result); } };
    const socket = createConnection({ port, host: "127.0.0.1" });
    socket.on("connect", () => { socket.destroy(); done(true); });
    socket.on("error", () => done(false));
    const timer = setTimeout(() => { socket.destroy(); done(false); }, 500);
  });
}

function loadRegistry() {
  if (!existsSync(REGISTRY_DIR)) mkdirSync(REGISTRY_DIR, { recursive: true });
  if (!existsSync(REGISTRY_FILE)) return {};
  try { return JSON.parse(readFileSync(REGISTRY_FILE, "utf8")); } catch { return {}; }
}

function saveRegistry(registry) {
  if (!existsSync(REGISTRY_DIR)) mkdirSync(REGISTRY_DIR, { recursive: true });
  writeFileSync(REGISTRY_FILE, JSON.stringify(registry, null, 2));
}

function registerProject(port) {
  const registry = loadRegistry();
  registry[PROJECT_PATH] = { port, name: PROJECT_NAME, started: new Date().toISOString() };
  saveRegistry(registry);
}

function unregisterProject() {
  try {
    const registry = loadRegistry();
    delete registry[PROJECT_PATH];
    saveRegistry(registry);
  } catch {
    // Best-effort cleanup on exit
  }
}

async function cleanStaleEntries() {
  const registry = loadRegistry();
  const entries = Object.entries(registry);
  if (entries.length === 0) return;

  const results = await Promise.all(
    entries.map(async ([path, info]) => {
      const alive = await checkPort(info.port);
      return [path, alive];
    })
  );

  let changed = false;
  for (const [path, alive] of results) {
    if (!alive) {
      delete registry[path];
      changed = true;
    }
  }
  if (changed) saveRegistry(registry);
}

// ── Per-project data storage ──
const DATA_DIR = join(process.cwd(), ".anti-slop");
const LOG_FILE = join(DATA_DIR, "scan-log.json");
const SCORE_FILE = join(DATA_DIR, "scores.json");

const CONFIG_FILE = join(DATA_DIR, "config.json");

function ensureDataDir() {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
}

function loadProjectConfig() {
  if (!existsSync(CONFIG_FILE)) return {};
  try { return JSON.parse(readFileSync(CONFIG_FILE, "utf8")); } catch { return {}; }
}

function loadLog() {
  ensureDataDir();
  if (!existsSync(LOG_FILE)) return [];
  try { return JSON.parse(readFileSync(LOG_FILE, "utf8")); } catch { return []; }
}

function saveLog(log) {
  ensureDataDir();
  const trimmed = log.slice(-500);
  writeFileSync(LOG_FILE, JSON.stringify(trimmed, null, 2));
}

function loadScores() {
  ensureDataDir();
  if (!existsSync(SCORE_FILE)) return [];
  try { return JSON.parse(readFileSync(SCORE_FILE, "utf8")); } catch { return []; }
}

function saveScore(score) {
  ensureDataDir();
  const scores = loadScores();
  scores.push({ ...score, timestamp: new Date().toISOString() });
  const trimmed = scores.slice(-100);
  writeFileSync(SCORE_FILE, JSON.stringify(trimmed, null, 2));
}

// ── Prose noise-stripping: keep only the author's own prose. Blanks fenced code,
// inline code, double-quoted spans, blockquotes, YAML frontmatter, and any line
// carrying the escape-hatch marker. Line count is preserved so line numbers hold. ──
function stripProseNoise(content) {
  const lines = content.split("\n");
  const out = [];
  let inFence = false;
  let inFrontmatter = false;
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    if (i === 0 && line.trim() === "---") { inFrontmatter = true; out.push(""); continue; }
    if (inFrontmatter) { if (line.trim() === "---") inFrontmatter = false; out.push(""); continue; }
    if (/^\s*(```|~~~)/.test(line)) { inFence = !inFence; out.push(""); continue; }
    if (inFence) { out.push(""); continue; }
    if (/^\s*>/.test(line)) { out.push(""); continue; }
    if (ESCAPE_HATCH.test(line)) { out.push(""); continue; }
    line = line.replace(/`[^`]*`/g, " ").replace(/"[^"\n]*"/g, " ");
    out.push(line);
  }
  return out.join("\n");
}

// ── Comment lines only (for scanning code files for prose-style tells) ──
function extractComments(content) {
  return content.split("\n")
    .filter(l => /^\s*(\/\/|#|\*|\/\*|<!--|--)/.test(l) && !ESCAPE_HATCH.test(l))
    .join("\n");
}

// ── Blank any line carrying the escape-hatch marker (preserves line count) ──
function stripEscapeHatchLines(content) {
  return content.split("\n").map(l => (ESCAPE_HATCH.test(l) ? "" : l)).join("\n");
}

function globalize(re) {
  return re.flags.includes("g") ? re : new RegExp(re.source, re.flags + "g");
}

function resolveSeverity(sev, count) {
  return typeof sev === "function" ? sev(count) : sev;
}

// ── Count regex matches per non-suppressed, non-escaped line ──
function countLinePattern(lines, pat) {
  const g = globalize(pat.pattern);
  let count = 0;
  for (const line of lines) {
    if (ESCAPE_HATCH.test(line)) continue;
    if (pat.suppress && pat.suppress.test(line)) continue;
    const m = line.match(g);
    if (m) count += m.length;
  }
  return count;
}

// ── Scanner ──
export function scanContent(content, filePath) {
  const violations = [];
  const ext = extname(filePath).toLowerCase();
  const isProse = PROSE_EXTENSIONS.has(ext);
  const isCode = CODE_EXTENSIONS.has(ext);
  const isStyle = STYLE_EXTENSIONS.has(ext) || isCode;
  // Test/fixture files carry fake creds, example.com, and innerHTML scaffolding -- skip the
  // security / dummy-data patterns there so real findings are not drowned in test noise.
  const isTestFile = /\.(test|spec)\.[mc]?[jt]sx?$|(^|\/)(__tests__|__mocks__|fixtures|e2e)\/|\.stories\.[mc]?[jt]sx?$/i.test(filePath);
  const config = loadProjectConfig();
  const allowedWords = new Set((config.allowedWords || []).map(w => w.toLowerCase()));
  const contentLower = content.toLowerCase();

  // Prose scans the author's own text with noise stripped; code scans comment lines.
  const proseScan = isProse ? stripProseNoise(content) : null;

  // ── Banned words ──
  if (isProse || isCode) {
    const textToScan = isProse ? proseScan : extractComments(content);
    for (const word of BANNED_WORDS) {
      const lw = word.toLowerCase();
      if (allowedWords.has(lw)) continue;
      const exceptions = CONTEXT_EXCEPTIONS[lw];
      if (exceptions && exceptions.some(e => contentLower.includes(e))) continue;
      const matches = textToScan.match(new RegExp(`\\b${word}\\b`, "gi"));
      if (!matches) continue;
      const count = matches.length;
      // Concentration rule: a lone low-confidence word is the writer's own prose, not a tell.
      const lowConf = LOW_CONFIDENCE_WORDS.has(lw);
      if (lowConf && count < 2) continue;
      violations.push({
        type: "banned-word",
        word,
        count,
        severity: lowConf ? "low" : "medium",
        desc: `Banned AI-tell word "${word}" found ${count}x`,
      });
    }
  }

  // ── Banned phrases ──
  if (isProse || isCode) {
    const hay = (isProse ? proseScan : content).toLowerCase();
    for (const phrase of BANNED_PHRASES) {
      const idx = hay.indexOf(phrase);
      if (idx !== -1) {
        const lineNum = hay.substring(0, idx).split("\n").length;
        violations.push({
          type: "banned-phrase",
          phrase,
          line: lineNum,
          severity: "medium",
          desc: `Banned phrase "${phrase}" at line ${lineNum}`,
        });
      }
    }
  }

  // ── Text constructs + em-dash density (prose only) ──
  if (isProse) {
    for (const pat of TEXT_CONSTRUCTS) {
      const matches = proseScan.match(globalize(pat.pattern));
      if (matches) {
        violations.push({
          type: "text-construct",
          name: pat.name,
          count: matches.length,
          severity: pat.severity,
          desc: `${pat.desc} (${matches.length}x)`,
        });
      }
    }
    const emdashes = (proseScan.match(/—/g) || []).length;
    const words = (proseScan.match(/\S+/g) || []).length || 1;
    const density = (emdashes / words) * 1000;
    if (emdashes >= EMDASH_MIN_COUNT && density >= EMDASH_MIN_DENSITY) {
      violations.push({
        type: "text-construct",
        name: "em-dash-density",
        count: emdashes,
        severity: density >= EMDASH_MIN_DENSITY * 2 ? "medium" : "low",
        desc: `High em dash density (${emdashes} dashes, ${density.toFixed(1)}/1k words) -- the #1 AI writing tell`,
      });
    }
  }

  // ── Emoji (skips escape-hatch lines so an intentional CLI glyph can opt out) ──
  const emojiMatches = stripEscapeHatchLines(content).match(EMOJI_REGEX);
  if (emojiMatches) {
    violations.push({
      type: "emoji",
      count: emojiMatches.length,
      severity: "low",
      desc: `${emojiMatches.length} emoji found in ${filePath}`,
    });
  }

  // ── Design + code patterns (per-line, with suppress + escape hatch) ──
  const lines = content.split("\n");
  if (isStyle) {
    for (const pat of DESIGN_PATTERNS) {
      const count = countLinePattern(lines, pat);
      if (count > 0) {
        violations.push({
          type: "design-tell",
          name: pat.name,
          count,
          severity: resolveSeverity(pat.severity, count),
          desc: `${pat.desc} (${count}x)`,
        });
      }
    }
  }
  if (isCode) {
    for (const pat of CODE_PATTERNS) {
      if (isTestFile && pat.skipInTests) continue;
      const count = countLinePattern(lines, pat);
      if (count > 0) {
        violations.push({
          type: "code-pattern",
          name: pat.name,
          count,
          severity: resolveSeverity(pat.severity, count),
          desc: `${pat.desc} (${count}x)`,
        });
      }
    }
  }

  return violations;
}

// ── Score calculation ──
export function calculateScore(violations) {
  let score = 50;
  for (const v of violations) {
    if (v.severity === "high") score -= 5;
    else if (v.severity === "medium") score -= 2;
    else score -= 1;
  }
  return Math.max(0, Math.min(50, score));
}

// ── Verdict ladder (source-aligned): a weighted-count tier for the scan summary. ──
// Uses the source scanners' additive weights (high=3, medium=2, low=1), which are
// distinct from the /50 score. For prose, pass the word count so a long, lightly
// flecked document is not over-escalated (the concentration guard).
export function verdict(violations, words = 0) {
  const W = { high: 3, medium: 2, low: 1 };
  let weighted = 0, high = 0, medium = 0;
  for (const v of violations) {
    weighted += W[v.severity] || 1;
    if (v.severity === "high") high++;
    else if (v.severity === "medium") medium++;
  }
  if (weighted === 0) return "CLEAN";
  if (high === 0 && medium === 0) return "MINOR";
  if (high >= 3 || weighted >= 15) return "STRONG";
  if (high >= 1) return "SOME";
  const density = words > 0 ? (weighted / words) * 1000 : 0;
  if (weighted >= 6 && !(words >= 600 && density < 2.0)) return "SOME";
  return "MINOR";
}

// ── Filter stale violations that are now context-allowed ──
function filterAllowedViolations(log) {
  const config = loadProjectConfig();
  const allowedWords = new Set((config.allowedWords || []).map(w => w.toLowerCase()));
  return log.filter(v => {
    if (v.type !== "banned-word") return true;
    if (allowedWords.has((v.word || "").toLowerCase())) return false;
    return true;
  });
}

// ── Web Dashboard ──
function startDashboard(port) {
  const server = createServer((req, res) => {
    if (req.url === "/api/log") {
      res.writeHead(200, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
      res.end(JSON.stringify(filterAllowedViolations(loadLog())));
      return;
    }
    if (req.url === "/api/scores") {
      res.writeHead(200, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
      res.end(JSON.stringify(loadScores()));
      return;
    }
    if (req.url === "/api/registry") {
      res.writeHead(200, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
      res.end(JSON.stringify(loadRegistry()));
      return;
    }
    if (req.url === "/api/project") {
      res.writeHead(200, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
      res.end(JSON.stringify({ path: PROJECT_PATH, name: PROJECT_NAME, port }));
      return;
    }

    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><circle cx='50' cy='50' r='40' fill='none' stroke='%23ef4444' stroke-width='8'/><line x1='22' y1='22' x2='78' y2='78' stroke='%23ef4444' stroke-width='8' stroke-linecap='round'/></svg>">
<title>anti-slop</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'SF Mono', 'Cascadia Code', 'Fira Code', monospace; background: #0a0a0a; color: #e0e0e0; padding: 24px; }
  h1 { font-size: 20px; font-weight: 600; margin-bottom: 8px; color: #fff; }
  h2 { font-size: 14px; font-weight: 600; margin-bottom: 12px; color: #888; text-transform: uppercase; letter-spacing: 0.05em; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 24px; }
  .card { background: #141414; border: 1px solid #222; border-radius: 8px; padding: 20px; }
  .score-big { font-size: 64px; font-weight: 700; color: #fff; }
  .score-big .total { font-size: 24px; color: #555; }
  .score-label { font-size: 12px; color: #666; margin-top: 4px; }
  .chart { height: 120px; display: flex; align-items: flex-end; gap: 2px; }
  .bar { background: #333; border-radius: 2px 2px 0 0; min-width: 4px; flex: 1; transition: background 0.2s; position: relative; }
  .bar:hover { background: #555; }
  .bar.good { background: #22c55e; }
  .bar.ok { background: #eab308; }
  .bar.bad { background: #ef4444; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th { text-align: left; padding: 8px 12px; color: #666; border-bottom: 1px solid #222; font-weight: 500; }
  td { padding: 8px 12px; border-bottom: 1px solid #1a1a1a; }
  .sev-high { color: #ef4444; }
  .sev-medium { color: #eab308; }
  .sev-low { color: #22c55e; }
  .type-badge { background: #1e1e1e; padding: 2px 8px; border-radius: 4px; font-size: 11px; }
  .empty { color: #444; font-style: italic; padding: 40px; text-align: center; }
  .refresh { color: #555; font-size: 11px; cursor: pointer; float: right; }
  .refresh:hover { color: #888; }
  .stats { display: flex; gap: 32px; margin-bottom: 24px; }
  .stat { text-align: center; }
  .stat-value { font-size: 28px; font-weight: 700; color: #fff; }
  .stat-label { font-size: 11px; color: #666; }
  .project-nav { display: flex; gap: 4px; margin-bottom: 20px; padding: 4px; background: #111; border-radius: 6px; border: 1px solid #1a1a1a; overflow-x: auto; }
  .project-tab { padding: 6px 14px; border-radius: 4px; font-size: 12px; color: #666; cursor: pointer; white-space: nowrap; text-decoration: none; transition: color 0.15s, background 0.15s; }
  .project-tab:hover { color: #aaa; background: #1a1a1a; }
  .project-tab.active { color: #e0e0e0; background: #222; }
  .header-row { display: flex; align-items: baseline; gap: 12px; margin-bottom: 20px; }
  .project-name { color: #555; font-size: 14px; font-weight: 400; }
</style>
</head>
<body>
<div class="header-row">
  <h1>anti-slop <span style="color:#555">dashboard</span></h1>
  <span class="project-name" id="project-name-label"></span>
  <span class="refresh" onclick="load()">refresh</span>
</div>

<div id="project-nav" class="project-nav" style="display:none"></div>

<div class="stats" id="stats"></div>

<div class="grid">
  <div class="card">
    <h2>Current Score</h2>
    <div id="current-score" class="score-big">--<span class="total">/50</span></div>
    <div class="score-label" id="score-time"></div>
  </div>
  <div class="card">
    <h2>Score History</h2>
    <div class="chart" id="chart"></div>
  </div>
</div>

<div class="card">
  <h2>Recent Violations</h2>
  <table>
    <thead><tr><th>Time</th><th>File</th><th>Type</th><th>Description</th><th>Severity</th></tr></thead>
    <tbody id="log-body"></tbody>
  </table>
  <div id="empty-log" class="empty" style="display:none">No violations recorded yet. Run a scan and results will appear here.</div>
</div>

<div class="card" id="overview-card" style="display:none;margin-top:24px">
  <h2>All Projects</h2>
  <table>
    <thead><tr><th>Project</th><th>Score</th><th>Scans</th><th>Violations</th><th>Last Scan</th><th></th></tr></thead>
    <tbody id="overview-body"></tbody>
  </table>
</div>

<script>
var CURRENT_PORT = ${port};

function esc(s) { var d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

async function loadProjects() {
  try {
    var res = await fetch('/api/registry');
    var registry = await res.json();
    var projects = Object.entries(registry);
    var nav = document.getElementById('project-nav');
    nav.style.display = 'flex';
    nav.innerHTML = '';
    projects.forEach(function(entry) {
      var info = entry[1];
      var a = document.createElement('a');
      a.className = 'project-tab' + (info.port === CURRENT_PORT ? ' active' : '');
      a.href = 'http://127.0.0.1:' + parseInt(info.port, 10);
      a.textContent = info.name;
      nav.appendChild(a);
    });
    if (projects.length === 0) { nav.style.display = 'none'; }
  } catch(e) {
    document.getElementById('project-nav').style.display = 'none';
  }
}

async function loadOverview() {
  try {
    var res = await fetch('/api/registry');
    var registry = await res.json();
    var projects = Object.entries(registry);
    var card = document.getElementById('overview-card');
    if (projects.length <= 1) { card.style.display = 'none'; return; }
    card.style.display = 'block';

    var results = await Promise.all(projects.map(function(entry) {
      var info = entry[1];
      return fetch('http://127.0.0.1:' + parseInt(info.port, 10) + '/api/scores')
        .then(function(r) { return r.json(); })
        .then(function(scores) { return { name: info.name, port: info.port, scores: scores }; })
        .catch(function() { return { name: info.name, port: info.port, scores: [] }; });
    }));

    var tbody = document.getElementById('overview-body');
    tbody.innerHTML = '';
    results.forEach(function(proj) {
      var lastScore = proj.scores.length ? proj.scores[proj.scores.length - 1] : null;
      var score = lastScore ? lastScore.score : '-';
      var scoreColor = !lastScore ? '#666' : lastScore.score >= 42 ? '#22c55e' : lastScore.score >= 30 ? '#eab308' : '#ef4444';
      var totalViolations = proj.scores.reduce(function(sum, s) { return sum + (s.violations || 0); }, 0);
      var lastTime = lastScore ? new Date(lastScore.timestamp).toLocaleString() : '-';
      var tr = document.createElement('tr');
      tr.innerHTML = '<td><a href="http://127.0.0.1:' + parseInt(proj.port, 10) + '" style="color:#88f;text-decoration:none">' + esc(proj.name) + '</a></td>' +
        '<td style="color:' + scoreColor + ';font-weight:600">' + score + '<span style="color:#555">/50</span></td>' +
        '<td>' + proj.scores.length + '</td>' +
        '<td>' + totalViolations + '</td>' +
        '<td style="color:#888">' + esc(lastTime) + '</td>';
      tbody.appendChild(tr);
    });
  } catch(e) {
    document.getElementById('overview-card').style.display = 'none';
  }
}

async function load() {
  var logRes = [], scoresRes = [];
  try {
    var responses = await Promise.all([
      fetch('/api/log').then(function(r) { return r.json(); }),
      fetch('/api/scores').then(function(r) { return r.json(); })
    ]);
    logRes = responses[0] || [];
    scoresRes = responses[1] || [];
  } catch(e) { }

  // Stats
  var statsEl = document.getElementById('stats');
  var totalScans = scoresRes.length;
  var totalViolations = logRes.length;
  var avgScore = totalScans ? Math.round(scoresRes.reduce(function(s, e) { return s + e.score; }, 0) / totalScans) : 0;
  var highSev = logRes.filter(function(v) { return v.severity === 'high'; }).length;
  statsEl.innerHTML = [
    { v: totalScans, l: 'Total Scans' },
    { v: totalViolations, l: 'Violations Found' },
    { v: highSev, l: 'High Severity' },
    { v: avgScore + '/50', l: 'Avg Score' },
  ].map(function(s) { return '<div class="stat"><div class="stat-value">' + s.v + '</div><div class="stat-label">' + s.l + '</div></div>'; }).join('');

  // Current score
  var scoreEl = document.getElementById('current-score');
  var timeEl = document.getElementById('score-time');
  if (scoresRes.length) {
    var last = scoresRes[scoresRes.length - 1];
    scoreEl.innerHTML = last.score + '<span class="total">/50</span>';
    scoreEl.style.color = last.score >= 42 ? '#22c55e' : last.score >= 30 ? '#eab308' : '#ef4444';
    timeEl.textContent = new Date(last.timestamp).toLocaleString() + ' - ' + (last.file || 'scan');
  }

  // Chart
  var chartEl = document.getElementById('chart');
  var recent = scoresRes.slice(-50);
  chartEl.innerHTML = recent.map(function(s) {
    var h = Math.max(4, (s.score / 50) * 120);
    var cls = s.score >= 42 ? 'good' : s.score >= 30 ? 'ok' : 'bad';
    return '<div class="bar ' + cls + '" style="height:' + h + 'px" title="' + s.score + '/50 - ' + new Date(s.timestamp).toLocaleTimeString() + '"></div>';
  }).join('');

  // Log
  var tbody = document.getElementById('log-body');
  var emptyEl = document.getElementById('empty-log');
  if (!logRes.length) {
    tbody.innerHTML = '';
    emptyEl.style.display = 'block';
  } else {
    emptyEl.style.display = 'none';
    tbody.innerHTML = logRes.slice(-50).reverse().map(function(v) {
      var fname = esc((v.file || '-').split('/').pop().split('\\\\').pop());
      var sev = esc(v.severity);
      return '<tr><td>' + esc(new Date(v.timestamp).toLocaleTimeString()) + '</td>' +
        '<td>' + fname + '</td>' +
        '<td><span class="type-badge">' + esc(v.type) + '</span></td>' +
        '<td>' + esc(v.desc) + '</td>' +
        '<td class="sev-' + sev + '">' + sev + '</td></tr>';
    }).join('');
  }

  loadProjects();
  loadOverview();

  // Populate project name from API (avoids server-side HTML interpolation)
  try {
    var projRes = await fetch('/api/project');
    var projData = await projRes.json();
    document.getElementById('project-name-label').textContent = projData.name;
    document.title = 'anti-slop | ' + projData.name;
  } catch(e) {}
}
load();
setInterval(load, 5000);
</script>
</body>
</html>`);
  });

  return new Promise((resolve, reject) => {
    server.on("error", (err) => reject(err));
    server.listen(port, "127.0.0.1", () => {
      server.unref();
      resolve(server);
    });
  });
}

// ── Dashboard lifecycle ──
async function startDashboardIfNeeded() {
  await cleanStaleEntries();

  const registry = loadRegistry();
  const otherDashboardsExist = Object.keys(registry).length > 0;

  // Already running for this project?
  if (registry[PROJECT_PATH]) {
    const alive = await checkPort(registry[PROJECT_PATH].port);
    if (alive) {
      DASHBOARD_PORT = registry[PROJECT_PATH].port;
      return; // Another session already serves the dashboard
    }
  }

  // Find available port and start dashboard (retry on EADDRINUSE)
  const preferred = getPreferredPort();
  let port = null;
  for (let i = 0; i < 100; i++) {
    const candidate = preferred + i;
    const inUse = await checkPort(candidate);
    if (inUse) continue;
    try {
      await startDashboard(candidate);
      port = candidate;
      break;
    } catch (err) {
      if (err.code !== "EADDRINUSE") break; // unexpected error, stop trying
    }
  }

  if (port === null) return; // no port available, skip dashboard

  DASHBOARD_PORT = port;
  registerProject(port);

  // Dashboard is available via get_dashboard_url tool -- don't auto-open browser

  // Cleanup on exit
  const cleanup = () => unregisterProject();
  process.on("exit", cleanup);
  process.on("SIGINT", () => { cleanup(); process.exit(0); });
  process.on("SIGTERM", () => { cleanup(); process.exit(0); });

  // Periodically clean stale entries so the nav stays accurate
  setInterval(() => cleanStaleEntries().catch(() => {}), 30000).unref();
}

// ── MCP Server ──
const mcpServer = new Server(
  { name: "anti-slop-scanner", version: "1.4.1" },
  { capabilities: { tools: {} } }
);

mcpServer.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "scan_file",
      description: "Scan a file for anti-slop violations (banned words, phrases, emoji, design tells, code patterns, security issues). Returns only violations found. Empty result means clean.",
      inputSchema: {
        type: "object",
        properties: {
          file_path: { type: "string", description: "Path to the file to scan" },
          content: { type: "string", description: "File content to scan (if file_path not accessible)" },
        },
        required: [],
      },
    },
    {
      name: "get_dashboard_url",
      description: "Get the URL of the anti-slop web dashboard for this project.",
      inputSchema: { type: "object", properties: {} },
    },
    {
      name: "get_score_history",
      description: "Get the score history for this project.",
      inputSchema: { type: "object", properties: {} },
    },
  ],
}));

mcpServer.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (name === "scan_file") {
    let content = args.content || "";
    let filePath = args.file_path || "unknown";

    if (!content && args.file_path) {
      try { content = readFileSync(args.file_path, "utf8"); }
      catch { return { content: [{ type: "text", text: `Cannot read file: ${args.file_path}` }] }; }
    }

    if (!content) {
      return { content: [{ type: "text", text: "No content to scan." }] };
    }

    const violations = scanContent(content, filePath);
    const score = calculateScore(violations);

    if (violations.length > 0) {
      const log = loadLog();
      for (const v of violations) {
        log.push({ ...v, file: filePath, timestamp: new Date().toISOString() });
      }
      saveLog(log);
    }

    saveScore({ score, file: filePath, violations: violations.length });

    if (violations.length === 0) {
      return { content: [{ type: "text", text: "" }] };
    }

    const ext = (filePath.match(/\.[^./\\]+$/) || [""])[0].toLowerCase();
    const isProseFile = [".md", ".mdx", ".txt", ".rst"].includes(ext);
    const tier = verdict(violations, isProseFile ? (content.match(/\S+/g) || []).length : 0);
    const report = violations.map(v => `[${v.severity.toUpperCase()}] ${v.desc}`).join("\n");
    return {
      content: [{
        type: "text",
        text: `Score: ${score}/50 | ${tier} | ${violations.length} violation(s) in ${filePath.split("/").pop().split("\\").pop()}\n\n${report}`,
      }],
    };
  }

  if (name === "get_dashboard_url") {
    const port = DASHBOARD_PORT || loadRegistry()[PROJECT_PATH]?.port;
    if (!port) return { content: [{ type: "text", text: "Dashboard not started." }] };
    return { content: [{ type: "text", text: `Dashboard: http://127.0.0.1:${port}` }] };
  }

  if (name === "get_score_history") {
    const scores = loadScores();
    if (!scores.length) return { content: [{ type: "text", text: "No scores recorded yet." }] };
    const recent = scores.slice(-10);
    const text = recent.map(s =>
      `${new Date(s.timestamp).toLocaleString()} | ${s.score}/50 | ${s.violations} violations | ${s.file || "scan"}`
    ).join("\n");
    return { content: [{ type: "text", text: `Last ${recent.length} scans:\n${text}` }] };
  }

  return { content: [{ type: "text", text: `Unknown tool: ${name}` }] };
});

// ── Start ──
async function main() {
  await startDashboardIfNeeded();
  const transport = new StdioServerTransport();
  await mcpServer.connect(transport);
}

// Only start the server when run directly; importing the module (for tests) must not.
const invokedDirectly = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedDirectly) {
  main();
}
