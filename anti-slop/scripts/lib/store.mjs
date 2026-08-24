import { createConnection } from "net";
import { readFileSync, writeFileSync, existsSync, mkdirSync, renameSync, unlinkSync } from "fs";
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

// ── Atomic JSON write ──
// A pre-commit hook and a CI run (or two dashboards racing) can interleave a plain
// writeFileSync. Every reader here swallows the resulting JSON.parse throw and returns an
// empty collection, so a torn write is silent total data loss rather than a crash. Write
// to a sibling temp file and rename, which is atomic within a filesystem.
function writeJsonAtomic(file, value) {
  const tmp = `${file}.tmp`;
  try {
    writeFileSync(tmp, JSON.stringify(value, null, 2));
    renameSync(tmp, file);
  } catch (err) {
    try { if (existsSync(tmp)) unlinkSync(tmp); } catch { /* nothing left to clean up */ }
    throw err;
  }
}

export function loadRegistry() {
  if (!existsSync(REGISTRY_DIR)) mkdirSync(REGISTRY_DIR, { recursive: true });
  if (!existsSync(REGISTRY_FILE)) return {};
  try { return JSON.parse(readFileSync(REGISTRY_FILE, "utf8")); } catch { return {}; }
}

export function saveRegistry(registry) {
  if (!existsSync(REGISTRY_DIR)) mkdirSync(REGISTRY_DIR, { recursive: true });
  writeJsonAtomic(REGISTRY_FILE, registry);
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

export const LOG_LIMIT = 500;
export const SCORE_LIMIT = 100;

export function ensureDataDir() {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
}

// `scan` reads the config once per FILE, and scanContent is also called directly by
// embedders, so this was an existsSync + readFileSync + JSON.parse in the hot path. A
// one-shot CLI run cannot see the config change underneath it, so memoize per process.
// The dashboard is the exception -- it is a long-lived server whose user may edit the
// config while it serves -- and passes { fresh: true }.
let configCache = null;
export function loadProjectConfig({ fresh = false } = {}) {
  if (!fresh && configCache !== null) return configCache;
  let value = {};
  if (existsSync(CONFIG_FILE)) {
    try { value = JSON.parse(readFileSync(CONFIG_FILE, "utf8")); } catch { value = {}; }
  }
  configCache = value;
  return value;
}

// The read paths never create `.anti-slop/`. `history` and `stats` on a project that has
// never recorded anything are pure reads, and the README promises a scan leaves no trace
// in the project directory unless the user opts in with --record.
export function loadLog() {
  if (!existsSync(LOG_FILE)) return [];
  try { return JSON.parse(readFileSync(LOG_FILE, "utf8")); } catch { return []; }
}

export function saveLog(log) {
  ensureDataDir();
  writeJsonAtomic(LOG_FILE, log.slice(-LOG_LIMIT));
}

export function loadScores() {
  if (!existsSync(SCORE_FILE)) return [];
  try { return JSON.parse(readFileSync(SCORE_FILE, "utf8")); } catch { return []; }
}

// One load/trim/write cycle for a whole run, called once per invocation. The per-file
// `saveScore` it replaces made an N-file scan do N read-modify-write round trips over the
// whole score file -- and, because the cap counts rows rather than runs, evicted its own
// rows before the run had finished.
export function saveScores(batch) {
  if (!batch.length) return;
  ensureDataDir();
  const stamped = batch.map((s) => ({ ...s, timestamp: new Date().toISOString() }));
  writeJsonAtomic(SCORE_FILE, [...loadScores(), ...stamped].slice(-SCORE_LIMIT));
}
