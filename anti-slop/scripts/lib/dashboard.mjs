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
// A suppressed:true entry is already-labeled deliberate-suppression data (escape hatch
// or allowedWords, see scan.mjs opts.collectSuppressed) and is never "stale" the way an
// old ACTIVE banned-word entry becomes once its word is added to allowedWords.
export function filterAllowedViolations(log) {
  const config = loadProjectConfig({ fresh: true });
  const allowedWords = new Set((config.allowedWords || []).map(w => w.toLowerCase()));
  return log.filter(v => {
    if (v.suppressed === true) return true;
    if (v.type !== "banned-word") return true;
    if (allowedWords.has((v.word || "").toLowerCase())) return false;
    return true;
  });
}

// ── Web Dashboard ──
// The listener THIS process started, or null when it started none (disabled, no free
// port, or another session already serves this project). It is unref()'d at start so an
// embedder or a test never hangs on it; the CLI subcommand re-refs it (holdDashboardOpen).
let server = null;

function startDashboard(port) {
  const html = readFileSync(DASHBOARD_HTML_PATH, "utf8");
  const listener = createServer((req, res) => {
    if (req.url === "/api/log") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(filterAllowedViolations(loadLog())));
      return;
    }
    if (req.url === "/api/scores") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(loadScores()));
      return;
    }
    if (req.url === "/api/registry") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(loadRegistry()));
      return;
    }
    if (req.url === "/api/project") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ path: PROJECT_PATH, name: PROJECT_NAME, port }));
      return;
    }

    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(html);
  });

  return new Promise((resolve, reject) => {
    listener.on("error", (err) => reject(err));
    listener.listen(port, "127.0.0.1", () => {
      listener.unref();
      resolve(listener);
    });
  });
}

// The CLI `dashboard` subcommand is the one caller that wants the process to outlive the
// call. From 2.0.0 to 2.2.1 the subcommand returned as soon as the URL printed, the entry
// point called process.exit, and the listener died with it: the printed port answered
// nothing. The MCP server that hosted the dashboard before 2.0.0 was long-lived by nature;
// the CLI has to be on purpose. Returns false when this process started nothing, so the
// caller can print the URL of the already-running instance and return at once.
export function holdDashboardOpen() {
  if (!server) return false;
  server.ref();
  return true;
}

// ── Dashboard lifecycle: fully on-demand. First call starts the dashboard (or
// reports why it didn't); later calls reuse the already-running instance. ──
let startPromise = null;

export async function ensureDashboard() {
  const config = loadProjectConfig({ fresh: true });
  if (config.dashboard === false) {
    return { disabled: true, port: null };
  }

  if (DASHBOARD_PORT) {
    return { disabled: false, port: DASHBOARD_PORT };
  }

  // Concurrent tool calls must share one start attempt: without this, each caller
  // binds its own port, stacks duplicate exit handlers, and all but the last
  // registered server is orphaned off-registry until process exit.
  if (!startPromise) {
    startPromise = startOnce().finally(() => {
      if (!DASHBOARD_PORT) startPromise = null; // failed start: allow a later retry
    });
  }
  return startPromise;
}

async function startOnce() {
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
      server = await startDashboard(candidate);
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
