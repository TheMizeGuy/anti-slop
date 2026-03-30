import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { createServer } from "http";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join, dirname, extname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Banned Words (top 50 highest-signal, prose-only) ──
const BANNED_WORDS = [
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
];

// ── Banned Phrases (top 40 highest-signal) ──
const BANNED_PHRASES = [
  "great question", "that's a great question", "absolutely!",
  "certainly!", "i'd be happy to help", "i'd be happy to assist",
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

// ── UI Design Patterns (Tailwind class combos) ──
const DESIGN_PATTERNS = [
  { name: "purple-gradient-default", pattern: /from-(indigo|purple|violet)-[45]00\s.*to-(indigo|purple|violet)-[56]00/i, desc: "Purple/indigo gradient (Tailwind AI default)" },
  { name: "icon-in-colored-circle", pattern: /rounded-full\s[^"]*bg-[a-z]+-100\s[^"]*p-3/i, desc: "Icon in colored circle background" },
  { name: "frosted-glass-nav", pattern: /backdrop-blur[^\s]*\s[^"]*bg-white\/[0-9]+\s[^"]*border-b/i, desc: "Frosted glass navigation bar" },
  { name: "gradient-text", pattern: /bg-clip-text\s[^"]*text-transparent/i, desc: "Gradient text effect on heading" },
  { name: "shadow-border-rounded-combo", pattern: /shadow-sm\s[^"]*border\s[^"]*rounded-xl/i, desc: "shadow-sm + border + rounded-xl AI card combo" },
  { name: "z-index-escalation", pattern: /z-(?:index:\s*|\[)(?:999|9999|99999)/i, desc: "z-index escalation (999+)" },
  { name: "important-overuse", pattern: /!important/g, desc: "!important usage" },
];

// ── Code Patterns ──
const CODE_PATTERNS = [
  { name: "full-lodash-import", pattern: /import\s+_\s+from\s+['"]lodash['"]/g, desc: "Full lodash import (use cherry-picked imports)" },
  { name: "full-moment-import", pattern: /import\s+moment\s+from\s+['"]moment['"]/g, desc: "moment.js import (use dayjs or date-fns)" },
  { name: "eval-usage", pattern: /\beval\s*\(/g, desc: "eval() usage (security risk)" },
  { name: "innerhtml-usage", pattern: /\.innerHTML\s*=/g, desc: "innerHTML assignment (XSS risk)" },
  { name: "hardcoded-secret", pattern: /(?:api[_-]?key|password|secret|token)\s*[:=]\s*['"][^'"]{8,}['"]/gi, desc: "Possible hardcoded credential" },
  { name: "console-log-emoji", pattern: /console\.log\s*\(\s*['"][^\n]*[\u{1F300}-\u{1FAFF}]/gu, desc: "Emoji in console.log" },
  { name: "img-no-dimensions", pattern: /<img\s(?![^>]*(?:width|height))[^>]*>/gi, desc: "<img> without width/height (causes CLS)" },
  { name: "useeffect-setstate", pattern: /useEffect\s*\(\s*\(\s*\)\s*=>\s*\{[^}]*set[A-Z]\w*\s*\(/g, desc: "useEffect setting state (likely derived state)" },
];

// ── Emoji detection ──
const EMOJI_REGEX = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE00}-\u{FE0F}\u{1F000}-\u{1FAFF}]/gu;

// ── File type detection ──
const PROSE_EXTENSIONS = new Set([".md", ".mdx", ".txt", ".rst"]);
const CODE_EXTENSIONS = new Set([".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs", ".py", ".rb", ".go", ".rs", ".java", ".cs", ".php"]);
const STYLE_EXTENSIONS = new Set([".css", ".scss", ".less", ".html", ".htm", ".jsx", ".tsx", ".vue", ".svelte"]);

// ── Data storage ──
const DATA_DIR = join(process.cwd(), ".anti-slop");
const LOG_FILE = join(DATA_DIR, "scan-log.json");
const SCORE_FILE = join(DATA_DIR, "scores.json");

function ensureDataDir() {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
}

function loadLog() {
  ensureDataDir();
  if (!existsSync(LOG_FILE)) return [];
  try { return JSON.parse(readFileSync(LOG_FILE, "utf8")); } catch { return []; }
}

function saveLog(log) {
  ensureDataDir();
  const trimmed = log.slice(-500); // keep last 500 entries
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
  const trimmed = scores.slice(-100); // keep last 100 scores
  writeFileSync(SCORE_FILE, JSON.stringify(trimmed, null, 2));
}

// ── Scanner ──
function scanContent(content, filePath) {
  const violations = [];
  const ext = extname(filePath).toLowerCase();
  const isProse = PROSE_EXTENSIONS.has(ext);
  const isCode = CODE_EXTENSIONS.has(ext);
  const isStyle = STYLE_EXTENSIONS.has(ext) || isCode;
  const lines = content.split("\n");

  // Banned words (prose and comments, not inside code strings/variable names)
  if (isProse || isCode) {
    const textToScan = isProse ? content : lines.filter(l => l.match(/^\s*\/\/|^\s*#|^\s*\*|^\s*\/\*/) || isProse).join("\n");
    for (const word of BANNED_WORDS) {
      const regex = new RegExp(`\\b${word}\\b`, "gi");
      const matches = textToScan.match(regex);
      if (matches) {
        violations.push({
          type: "banned-word",
          word,
          count: matches.length,
          severity: "medium",
          desc: `Banned AI-tell word "${word}" found ${matches.length}x`,
        });
      }
    }
  }

  // Banned phrases
  if (isProse || isCode) {
    const lower = content.toLowerCase();
    for (const phrase of BANNED_PHRASES) {
      const idx = lower.indexOf(phrase);
      if (idx !== -1) {
        const lineNum = content.substring(0, idx).split("\n").length;
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

  // Emoji detection (all file types)
  const emojiMatches = content.match(EMOJI_REGEX);
  if (emojiMatches) {
    violations.push({
      type: "emoji",
      count: emojiMatches.length,
      severity: "low",
      desc: `${emojiMatches.length} emoji found in ${filePath}`,
    });
  }

  // Design patterns (style files and JSX/TSX)
  if (isStyle) {
    for (const pat of DESIGN_PATTERNS) {
      const matches = content.match(pat.pattern);
      if (matches) {
        const count = Array.isArray(matches) ? matches.length : 1;
        violations.push({
          type: "design-tell",
          name: pat.name,
          count,
          severity: pat.name === "important-overuse" && count > 3 ? "high" : "medium",
          desc: `${pat.desc} (${count}x)`,
        });
      }
    }
  }

  // Code patterns
  if (isCode) {
    for (const pat of CODE_PATTERNS) {
      const matches = content.match(pat.pattern);
      if (matches) {
        const severity = ["eval-usage", "innerhtml-usage", "hardcoded-secret"].includes(pat.name) ? "high" : "medium";
        violations.push({
          type: "code-pattern",
          name: pat.name,
          count: matches.length,
          severity,
          desc: `${pat.desc} (${matches.length}x)`,
        });
      }
    }
  }

  return violations;
}

// ── Score calculation ──
function calculateScore(violations) {
  let score = 50;
  for (const v of violations) {
    if (v.severity === "high") score -= 5;
    else if (v.severity === "medium") score -= 2;
    else score -= 1;
  }
  return Math.max(0, Math.min(50, score));
}

// ── Web Dashboard ──
function startDashboard(port = 7847) {
  const server = createServer((req, res) => {
    if (req.url === "/api/log") {
      res.writeHead(200, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
      res.end(JSON.stringify(loadLog()));
      return;
    }
    if (req.url === "/api/scores") {
      res.writeHead(200, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
      res.end(JSON.stringify(loadScores()));
      return;
    }

    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>anti-slop dashboard</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'SF Mono', 'Cascadia Code', 'Fira Code', monospace; background: #0a0a0a; color: #e0e0e0; padding: 24px; }
  h1 { font-size: 20px; font-weight: 600; margin-bottom: 24px; color: #fff; }
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
</style>
</head>
<body>
<h1>anti-slop <span style="color:#555">dashboard</span> <span class="refresh" onclick="load()">refresh</span></h1>

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
  <div id="empty-log" class="empty" style="display:none">No violations recorded yet. Write some code and the scanner will catch issues automatically.</div>
</div>

<script>
async function load() {
  const [logRes, scoresRes] = await Promise.all([
    fetch('/api/log').then(r => r.json()).catch(() => []),
    fetch('/api/scores').then(r => r.json()).catch(() => [])
  ]);

  // Stats
  const statsEl = document.getElementById('stats');
  const totalScans = scoresRes.length;
  const totalViolations = logRes.length;
  const avgScore = totalScans ? Math.round(scoresRes.reduce((s, e) => s + e.score, 0) / totalScans) : 0;
  const highSev = logRes.filter(v => v.severity === 'high').length;
  statsEl.innerHTML = [
    { v: totalScans, l: 'Total Scans' },
    { v: totalViolations, l: 'Violations Found' },
    { v: highSev, l: 'High Severity' },
    { v: avgScore + '/50', l: 'Avg Score' },
  ].map(s => '<div class="stat"><div class="stat-value">' + s.v + '</div><div class="stat-label">' + s.l + '</div></div>').join('');

  // Current score
  const scoreEl = document.getElementById('current-score');
  const timeEl = document.getElementById('score-time');
  if (scoresRes.length) {
    const last = scoresRes[scoresRes.length - 1];
    scoreEl.innerHTML = last.score + '<span class="total">/50</span>';
    scoreEl.style.color = last.score >= 42 ? '#22c55e' : last.score >= 30 ? '#eab308' : '#ef4444';
    timeEl.textContent = new Date(last.timestamp).toLocaleString() + ' - ' + (last.file || 'scan');
  }

  // Chart
  const chartEl = document.getElementById('chart');
  const recent = scoresRes.slice(-50);
  chartEl.innerHTML = recent.map(s => {
    const h = Math.max(4, (s.score / 50) * 120);
    const cls = s.score >= 42 ? 'good' : s.score >= 30 ? 'ok' : 'bad';
    return '<div class="bar ' + cls + '" style="height:' + h + 'px" title="' + s.score + '/50 - ' + new Date(s.timestamp).toLocaleTimeString() + '"></div>';
  }).join('');

  // Log
  const tbody = document.getElementById('log-body');
  const emptyEl = document.getElementById('empty-log');
  if (!logRes.length) {
    tbody.innerHTML = '';
    emptyEl.style.display = 'block';
  } else {
    emptyEl.style.display = 'none';
    tbody.innerHTML = logRes.slice(-50).reverse().map(v =>
      '<tr><td>' + new Date(v.timestamp).toLocaleTimeString() + '</td>' +
      '<td>' + (v.file || '-').split('/').pop().split('\\\\').pop() + '</td>' +
      '<td><span class="type-badge">' + v.type + '</span></td>' +
      '<td>' + v.desc + '</td>' +
      '<td class="sev-' + v.severity + '">' + v.severity + '</td></tr>'
    ).join('');
  }
}
load();
setInterval(load, 5000);
</script>
</body>
</html>`);
  });

  server.listen(port, "127.0.0.1", () => {
    // Silent start - no console output to avoid polluting MCP stdio
  });

  return server;
}

// ── MCP Server ──
const mcpServer = new Server(
  { name: "anti-slop-scanner", version: "1.0.0" },
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

    // Log violations
    if (violations.length > 0) {
      const log = loadLog();
      for (const v of violations) {
        log.push({ ...v, file: filePath, timestamp: new Date().toISOString() });
      }
      saveLog(log);
    }

    // Save score
    saveScore({ score, file: filePath, violations: violations.length });

    if (violations.length === 0) {
      return { content: [{ type: "text", text: "" }] }; // Silent when clean
    }

    const report = violations.map(v => `[${v.severity.toUpperCase()}] ${v.desc}`).join("\n");
    return {
      content: [{
        type: "text",
        text: `Score: ${score}/50 | ${violations.length} violation(s) in ${filePath.split("/").pop().split("\\").pop()}\n\n${report}`,
      }],
    };
  }

  if (name === "get_dashboard_url") {
    return {
      content: [{ type: "text", text: "Dashboard: http://127.0.0.1:7847" }],
    };
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
startDashboard(7847);

const transport = new StdioServerTransport();
await mcpServer.connect(transport);
