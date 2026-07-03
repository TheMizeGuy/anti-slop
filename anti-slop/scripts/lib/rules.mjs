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
export const ESCAPE_HATCH = /(?:anti-slop-allow|unslop-ignore)\b/i;

// ── Em dash density (prose): the #1 cited writing tell. Flag on concentration, ──
// not a single legitimate dash. Counts only after prose noise-stripping.
export const EMDASH_MIN_COUNT = 5;     // ignore a handful of legitimate dashes
export const EMDASH_MIN_DENSITY = 4;   // per 1000 words before it counts

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
export const EMOJI_REGEX = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE00}-\u{FE0F}\u{1F000}-\u{1FAFF}]/gu;

// ── File type detection ──
export const PROSE_EXTENSIONS = new Set([".md", ".mdx", ".txt", ".rst"]);
export const CODE_EXTENSIONS = new Set([".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs", ".py", ".rb", ".go", ".rs", ".java", ".cs", ".php", ".c", ".h", ".cpp", ".cc", ".hpp", ".kt", ".kts", ".swift", ".scala", ".m", ".mm", ".sh", ".bash", ".lua", ".dart", ".sql", ".r"]);
export const STYLE_EXTENSIONS = new Set([".css", ".scss", ".less", ".html", ".htm", ".jsx", ".tsx", ".vue", ".svelte"]);
