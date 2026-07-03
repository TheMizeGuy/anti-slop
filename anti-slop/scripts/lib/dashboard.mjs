import { createServer } from "http";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
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

const __dirname = dirname(fileURLToPath(import.meta.url));
const DASHBOARD_HTML_PATH = join(__dirname, "dashboard.html");

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
  const html = readFileSync(DASHBOARD_HTML_PATH, "utf8");
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
    res.end(html);
  });

  return new Promise((resolve, reject) => {
    server.on("error", (err) => reject(err));
    server.listen(port, "127.0.0.1", () => {
      server.unref();
      resolve(server);
    });
  });
}

// ── Dashboard lifecycle: fully on-demand. First call starts the dashboard (or
// reports why it didn't); later calls reuse the already-running instance. ──
export async function ensureDashboard() {
  const config = loadProjectConfig();
  if (config.dashboard === false) {
    return { disabled: true, port: null };
  }

  if (DASHBOARD_PORT) {
    return { disabled: false, port: DASHBOARD_PORT };
  }

  await cleanStaleEntries();

  const registry = loadRegistry();

  // Already running for this project (e.g. started by another session)?
  if (registry[PROJECT_PATH]) {
    const alive = await checkPort(registry[PROJECT_PATH].port);
    if (alive) {
      DASHBOARD_PORT = registry[PROJECT_PATH].port;
      return { disabled: false, port: DASHBOARD_PORT };
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

  if (port === null) return { disabled: false, port: null }; // no port available

  DASHBOARD_PORT = port;
  registerProject(port);

  // Cleanup on exit
  const cleanup = () => unregisterProject();
  process.on("exit", cleanup);
  process.on("SIGINT", () => { cleanup(); process.exit(0); });
  process.on("SIGTERM", () => { cleanup(); process.exit(0); });

  // Periodically clean stale entries so the nav stays accurate -- only runs while
  // this process is actually serving a dashboard.
  setInterval(() => cleanStaleEntries().catch(() => {}), 30000).unref();

  return { disabled: false, port };
}
