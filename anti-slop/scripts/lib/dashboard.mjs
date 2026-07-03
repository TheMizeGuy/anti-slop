import { createServer } from "http";
import {
  PROJECT_PATH,
  PROJECT_NAME,
  loadLog,
  loadScores,
  loadRegistry,
  loadProjectConfig,
  checkPort,
  getPreferredPort,
  registerProject,
  unregisterProject,
  cleanStaleEntries,
} from "./store.mjs";

export let DASHBOARD_PORT = null;

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
export async function startDashboardIfNeeded() {
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
