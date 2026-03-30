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
import { fileURLToPath } from "url";
import { createHash } from "crypto";
import { execFile } from "child_process";
import { homedir } from "os";

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

// ── Scanner ──
function scanContent(content, filePath) {
  const violations = [];
  const ext = extname(filePath).toLowerCase();
  const isProse = PROSE_EXTENSIONS.has(ext);
  const isCode = CODE_EXTENSIONS.has(ext);
  const isStyle = STYLE_EXTENSIONS.has(ext) || isCode;
  const lines = content.split("\n");

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

  const emojiMatches = content.match(EMOJI_REGEX);
  if (emojiMatches) {
    violations.push({
      type: "emoji",
      count: emojiMatches.length,
      severity: "low",
      desc: `${emojiMatches.length} emoji found in ${filePath}`,
    });
  }

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
function startDashboard(port) {
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

<script>
var CURRENT_PORT = ${port};

function esc(s) { var d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

async function loadProjects() {
  try {
    var res = await fetch('/api/registry');
    var registry = await res.json();
    var projects = Object.entries(registry);
    var nav = document.getElementById('project-nav');
    if (projects.length <= 1) { nav.style.display = 'none'; return; }
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
  } catch(e) {
    document.getElementById('project-nav').style.display = 'none';
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

  // Open browser - port is a validated integer from internal hash, not user input
  const dashboardUrl = "http://127.0.0.1:" + String(port);
  if (process.platform === "win32") {
    execFile("cmd", ["/c", "start", "", dashboardUrl], () => {});
  } else if (process.platform === "darwin") {
    execFile("open", [dashboardUrl], () => {});
  } else {
    execFile("xdg-open", [dashboardUrl], () => {});
  }

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
  { name: "anti-slop-scanner", version: "1.1.0" },
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

    const report = violations.map(v => `[${v.severity.toUpperCase()}] ${v.desc}`).join("\n");
    return {
      content: [{
        type: "text",
        text: `Score: ${score}/50 | ${violations.length} violation(s) in ${filePath.split("/").pop().split("\\").pop()}\n\n${report}`,
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

main();
