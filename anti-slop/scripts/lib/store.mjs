import { createConnection } from "net";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join, basename } from "path";
import { createHash } from "crypto";
import { homedir } from "os";

// ── Multi-project support ──
export const PROJECT_PATH = process.cwd();
export const PROJECT_NAME = basename(PROJECT_PATH);
// Overridable so tests can point the registry at a scratch dir instead of the
// real ~/.anti-slop (which would otherwise register/unregister fake projects
// in the developer's actual multi-project registry).
const REGISTRY_DIR = process.env.ANTI_SLOP_REGISTRY_DIR || join(homedir(), ".anti-slop");
const REGISTRY_FILE = join(REGISTRY_DIR, "registry.json");

export function getPreferredPort() {
  const hash = createHash("md5").update(PROJECT_PATH).digest("hex");
  return 7847 + (parseInt(hash.substring(0, 8), 16) % 1000);
}

export function checkPort(port) {
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

export function loadRegistry() {
  if (!existsSync(REGISTRY_DIR)) mkdirSync(REGISTRY_DIR, { recursive: true });
  if (!existsSync(REGISTRY_FILE)) return {};
  try { return JSON.parse(readFileSync(REGISTRY_FILE, "utf8")); } catch { return {}; }
}

export function saveRegistry(registry) {
  if (!existsSync(REGISTRY_DIR)) mkdirSync(REGISTRY_DIR, { recursive: true });
  writeFileSync(REGISTRY_FILE, JSON.stringify(registry, null, 2));
}

export function registerProject(port) {
  const registry = loadRegistry();
  registry[PROJECT_PATH] = { port, name: PROJECT_NAME, started: new Date().toISOString() };
  saveRegistry(registry);
}

export function unregisterProject() {
  try {
    const registry = loadRegistry();
    delete registry[PROJECT_PATH];
    saveRegistry(registry);
  } catch {
    // Best-effort cleanup on exit
  }
}

export async function cleanStaleEntries() {
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

export function ensureDataDir() {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
}

export function loadProjectConfig() {
  if (!existsSync(CONFIG_FILE)) return {};
  try { return JSON.parse(readFileSync(CONFIG_FILE, "utf8")); } catch { return {}; }
}

export function loadLog() {
  ensureDataDir();
  if (!existsSync(LOG_FILE)) return [];
  try { return JSON.parse(readFileSync(LOG_FILE, "utf8")); } catch { return []; }
}

export function saveLog(log) {
  ensureDataDir();
  const trimmed = log.slice(-500);
  writeFileSync(LOG_FILE, JSON.stringify(trimmed, null, 2));
}

export function loadScores() {
  ensureDataDir();
  if (!existsSync(SCORE_FILE)) return [];
  try { return JSON.parse(readFileSync(SCORE_FILE, "utf8")); } catch { return []; }
}

export function saveScore(score) {
  ensureDataDir();
  const scores = loadScores();
  scores.push({ ...score, timestamp: new Date().toISOString() });
  const trimmed = scores.slice(-100);
  writeFileSync(SCORE_FILE, JSON.stringify(trimmed, null, 2));
}
