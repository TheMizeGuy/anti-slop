import { test, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdtempSync, rmSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { spawn } from "node:child_process";

const HERE = dirname(fileURLToPath(import.meta.url));
const SCRIPTS_DIR = dirname(HERE);
const ENTRY_PATH = join(SCRIPTS_DIR, "slop-scanner.mjs");
const STORE_PATH = join(SCRIPTS_DIR, "lib", "store.mjs");
const DASHBOARD_PATH = join(SCRIPTS_DIR, "lib", "dashboard.mjs");
const SCAN_PATH = join(SCRIPTS_DIR, "lib", "scan.mjs");
const DASHBOARD_HTML_PATH = join(SCRIPTS_DIR, "lib", "dashboard.html");

// Point the registry at a scratch dir and run "as" a scratch project so tests never
// touch the developer's real ~/.anti-slop registry or the anti-slop repo's own data.
const scratchRegistryDir = mkdtempSync(join(tmpdir(), "anti-slop-registry-"));
const scratchProjectDir = mkdtempSync(join(tmpdir(), "anti-slop-project-"));
process.env.ANTI_SLOP_REGISTRY_DIR = scratchRegistryDir;
process.chdir(scratchProjectDir);

// dashboard.mjs's interval is deliberately .unref()'d so it never blocks process exit --
// that also means it never shows up in process._getActiveHandles(), so the only reliable
// way to prove "the interval only exists while a dashboard is actually serving" is to
// intercept the global setInterval call itself.
let setIntervalCalls = 0;
const realSetInterval = globalThis.setInterval;
globalThis.setInterval = function (...args) {
  setIntervalCalls += 1;
  return realSetInterval(...args);
};

const store = await import(pathToFileURL(STORE_PATH).href);
const dashboard = await import(pathToFileURL(DASHBOARD_PATH).href);

function writeConfig(obj) {
  const dataDir = join(scratchProjectDir, ".anti-slop");
  mkdirSync(dataDir, { recursive: true });
  writeFileSync(join(dataDir, "config.json"), JSON.stringify(obj));
}

after(() => {
  rmSync(scratchRegistryDir, { recursive: true, force: true });
  rmSync(scratchProjectDir, { recursive: true, force: true });
});

// ── A1: starting the MCP server must never open an HTTP port ──

test("A1: importing lib/dashboard.mjs and lib/store.mjs starts no listener", async () => {
  assert.equal(dashboard.DASHBOARD_PORT, null);
  const alive = await store.checkPort(store.getPreferredPort());
  assert.equal(alive, false, "preferred port must not be in use merely from importing the modules");
});

test("A1: importing the entry module keeps the event loop free (no auto-start)", async () => {
  const entryUrl = pathToFileURL(ENTRY_PATH).href;
  await new Promise((resolve, reject) => {
    // Run in a fresh child process: importing (not invoking directly) must let the
    // process exit on its own within a short window if nothing keeps the loop alive.
    const child = spawn(process.execPath, ["-e", `import(${JSON.stringify(entryUrl)})`], {
      stdio: "ignore",
    });
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error("importing slop-scanner.mjs did not let the process exit within 5s"));
    }, 5000);
    child.on("exit", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve();
      else reject(new Error(`child process exited with code ${code}`));
    });
    child.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
});

// ── A3: config kill-switch ──

test("A3: dashboard: false in config disables get_dashboard_url and starts nothing", async () => {
  writeConfig({ dashboard: false });
  const before = setIntervalCalls;
  const result = await dashboard.ensureDashboard();
  assert.deepEqual(result, { disabled: true, port: null });
  assert.equal(dashboard.DASHBOARD_PORT, null, "must not have started a server while disabled");
  const alive = await store.checkPort(store.getPreferredPort());
  assert.equal(alive, false, "no server should be listening while disabled");
  assert.equal(setIntervalCalls, before, "no cleanup interval should be registered while disabled");
});

// ── A2 + A4: lazy start, reuse on later calls, interval only while serving ──

test("A2/A4: default config starts on demand; second call reuses; interval only registered on real start", async () => {
  writeConfig({}); // default: dashboard key absent = allowed on demand
  const beforeStart = setIntervalCalls;

  const first = await dashboard.ensureDashboard();
  assert.equal(first.disabled, false);
  assert.ok(Number.isInteger(first.port) && first.port > 0, "must return a real port on first call");
  assert.equal(dashboard.DASHBOARD_PORT, first.port);
  assert.equal(setIntervalCalls, beforeStart + 1, "starting the dashboard must register exactly one cleanup interval");

  const beforeSecond = setIntervalCalls;
  const second = await dashboard.ensureDashboard();
  assert.equal(second.port, first.port, "second call must reuse the already-running dashboard, not start another");
  assert.equal(setIntervalCalls, beforeSecond, "reusing an existing dashboard must not register another interval");

  const res = await fetch(`http://127.0.0.1:${first.port}/api/project`);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("access-control-allow-origin"), null, "the API must not serve a CORS wildcard (no cross-origin consumer exists)");
  const body = await res.json();
  assert.equal(body.port, first.port);
  assert.equal(body.name, store.PROJECT_NAME);
});

test("A2: concurrent get_dashboard_url calls share one start (no second server, one interval)", async () => {
  // Needs a process where DASHBOARD_PORT is still null, so run in a fresh child
  // with its own scratch project + registry.
  const raceProject = mkdtempSync(join(tmpdir(), "anti-slop-race-project-"));
  const raceRegistry = mkdtempSync(join(tmpdir(), "anti-slop-race-registry-"));
  const script = [
    "let intervals = 0;",
    "const real = globalThis.setInterval;",
    "globalThis.setInterval = (...a) => { intervals++; return real(...a); };",
    `const { ensureDashboard } = await import(${JSON.stringify(pathToFileURL(DASHBOARD_PATH).href)});`,
    "const [a, b] = await Promise.all([ensureDashboard(), ensureDashboard()]);",
    "console.log(JSON.stringify({ aPort: a.port, bPort: b.port, intervals }));",
    "process.exit(0);",
  ].join("\n");
  const out = await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["--input-type=module", "-e", script], {
      cwd: raceProject,
      env: { ...process.env, ANTI_SLOP_REGISTRY_DIR: raceRegistry },
      stdio: ["ignore", "pipe", "inherit"],
    });
    let stdout = "";
    child.stdout.on("data", (d) => { stdout += d; });
    const timer = setTimeout(() => { child.kill(); reject(new Error("race child timed out")); }, 10000);
    child.on("exit", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve(stdout.trim());
      else reject(new Error(`race child exited ${code}: ${stdout}`));
    });
    child.on("error", (err) => { clearTimeout(timer); reject(err); });
  });
  rmSync(raceProject, { recursive: true, force: true });
  rmSync(raceRegistry, { recursive: true, force: true });
  const result = JSON.parse(out);
  assert.ok(Number.isInteger(result.aPort) && result.aPort > 0, "first concurrent call must get a real port");
  assert.equal(result.bPort, result.aPort, "concurrent calls must resolve to the SAME dashboard, not start two servers");
  assert.equal(result.intervals, 1, "exactly one cleanup interval must be registered for one logical start");
});

// ── A5/A6: dashboard.html is a fully static document with the findings-only UI ──

test("A6: dashboard.html has no server-side interpolation placeholders", () => {
  const html = readFileSync(DASHBOARD_HTML_PATH, "utf8");
  assert.ok(!/\$\{/.test(html), "dashboard.html must be a static document (no ${...} template interpolation)");
});

test("A6: Windows basename split is at the right escape level for a static file", () => {
  // In the old template literal, split('\\\\') collapsed to split('\\') when served;
  // as a static file nothing collapses, so the source must carry the single-backslash
  // form or Windows paths render in full instead of as basenames.
  // The FILE must contain two backslash characters (browser parses '\\' into one);
  // these test-source literals are therefore twice as deep again.
  const html = readFileSync(DASHBOARD_HTML_PATH, "utf8");
  assert.ok(html.includes("split('\\\\')"), "file paths must be split on a single backslash at browser runtime");
  assert.ok(!html.includes("split('\\\\\\\\')"), "a template-literal-era four-backslash token would split on two backslashes and never match real Windows separators");
});

test("A5: dashboard.html shows findings stats, not the old score-centric UI", () => {
  const html = readFileSync(DASHBOARD_HTML_PATH, "utf8");
  assert.ok(html.includes("Findings by Rule"), "findings-by-rule section expected");
  assert.ok(html.includes("Findings per Scan"), "findings-per-scan timeline expected");
  assert.ok(html.includes("Recent Findings"), "recent findings table expected");
  assert.ok(html.includes("Total Scans") && html.includes("Findings Caught") && html.includes("Files Scanned"), "stat row expected");
  assert.ok(html.includes("project-nav") && html.includes("/api/registry"), "multi-project nav tabs must be kept");
  assert.ok(html.includes("empty"), "empty state must be kept");
  assert.ok(!html.includes("Current Score"), "the /50 score card must be removed from the dashboard");
  assert.ok(!html.includes("Score History"), "the score-history chart must be removed");
  assert.ok(!html.includes("All Projects"), "the cross-port All Projects overview must be removed");
});

// ── A8: the dashboard HTML itself must pass the plugin's own scanner ──

test("A8: dashboard.html passes the plugin's own scanner", async () => {
  const { scanContent } = await import(pathToFileURL(SCAN_PATH).href);
  const html = readFileSync(DASHBOARD_HTML_PATH, "utf8");
  const violations = scanContent(html, DASHBOARD_HTML_PATH);
  assert.deepEqual(violations, [], `dashboard.html should scan clean: ${JSON.stringify(violations)}`);
});

// ── A9: version bump ──

test("A9: MCP server version string is 1.5.0", () => {
  const entrySrc = readFileSync(ENTRY_PATH, "utf8");
  assert.match(entrySrc, /version:\s*"1\.5\.0"/);
});

// ── A2 (tool description): get_dashboard_url documents the on-demand behavior ──

test("get_dashboard_url tool description documents on-demand start + disable switch", () => {
  const entrySrc = readFileSync(ENTRY_PATH, "utf8");
  const start = entrySrc.indexOf('name: "get_dashboard_url"');
  const end = entrySrc.indexOf('name: "get_score_history"');
  assert.ok(start !== -1 && end !== -1 && end > start, "get_dashboard_url tool block not found");
  const toolBlock = entrySrc.slice(start, end);
  assert.match(toolBlock, /on demand/i);
  assert.match(toolBlock, /dashboard.*false/i);
});

// ── D6: suppressed-finding capture reaches the dashboard ──

test("D6: dashboard.html's Findings by Rule table gains a Suppressed column", () => {
  const html = readFileSync(DASHBOARD_HTML_PATH, "utf8");
  assert.match(html, /<th>Suppressed<\/th>/, "Findings by Rule table must have a Suppressed column header");
});

test("D6: renderRules tallies active vs suppressed per rule and sorts by their sum", () => {
  const html = readFileSync(DASHBOARD_HTML_PATH, "utf8");
  const rulesFn = html.slice(html.indexOf("function renderRules"), html.indexOf("function renderChart"));
  assert.match(rulesFn, /suppressedCount/, "renderRules must track a suppressed count alongside the active count");
  assert.match(rulesFn, /v\.suppressed/, "renderRules must branch on the suppressed flag when tallying");
});

test("D6: renderStats and renderLog (Findings Caught / Recent Findings) count active entries only", () => {
  const html = readFileSync(DASHBOARD_HTML_PATH, "utf8");
  const statsFn = html.slice(html.indexOf("function renderStats"), html.indexOf("function renderRules"));
  assert.match(statsFn, /!v\.suppressed/, "renderStats must filter out suppressed entries before computing Findings Caught / High / Medium / Low");
  const logFn = html.slice(html.indexOf("function renderLog"), html.indexOf("async function load()"));
  assert.match(logFn, /!v\.suppressed/, "renderLog (Recent Findings) must filter out suppressed entries");
});

test("D6: /api/log serves suppressed entries and drops only STALE active banned-word entries for now-allowed words", async () => {
  writeConfig({ allowedWords: ["leverage"] });
  store.saveLog([
    { type: "banned-word", word: "leverage", severity: "low", file: "a.md", timestamp: "2026-07-01T00:00:00.000Z" }, // stale active: leverage is now allowed
    { type: "banned-word", word: "leverage", severity: "low", suppressed: true, suppressedBy: "allowed-words", file: "a.md", timestamp: "2026-07-02T00:00:00.000Z" },
    { type: "banned-word", word: "delve", suppressed: true, suppressedBy: "escape-hatch", severity: "medium", file: "b.md", timestamp: "2026-07-03T00:00:00.000Z" },
    { type: "code-pattern", name: "eval-usage", severity: "high", file: "c.ts", timestamp: "2026-07-04T00:00:00.000Z" },
  ]);

  const port = dashboard.DASHBOARD_PORT;
  assert.ok(Number.isInteger(port) && port > 0, "dashboard must already be running from an earlier test in this file");
  const res = await fetch(`http://127.0.0.1:${port}/api/log`);
  assert.equal(res.status, 200);
  const log = await res.json();

  assert.ok(!log.some((v) => v.word === "leverage" && !v.suppressed), "the stale ACTIVE leverage entry must be dropped now that it's allowed");
  assert.ok(log.some((v) => v.word === "leverage" && v.suppressed === true), "the SUPPRESSED leverage entry must survive the allowedWords filter");
  assert.ok(log.some((v) => v.word === "delve" && v.suppressed === true), "escape-hatch suppressed entries must survive unfiltered");
  assert.ok(log.some((v) => v.name === "eval-usage" && !v.suppressed), "unrelated active entries must be untouched");
});
