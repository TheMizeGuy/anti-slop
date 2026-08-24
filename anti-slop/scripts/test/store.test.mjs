import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";

// ── store.mjs behavior, none of which had direct coverage ────────────────────
// store.mjs captures process.cwd() at IMPORT time, so a test cannot chdir into a scratch
// project and re-import it: every case here runs in a child process whose cwd is a fresh
// mkdtemp dir, with ANTI_SLOP_REGISTRY_DIR pointed at a scratch dir so the developer's
// real ~/.anti-slop registry is never read or written.

const STORE_URL = pathToFileURL(
  join(dirname(dirname(fileURLToPath(import.meta.url))), "lib", "store.mjs"),
).href;

function inProject(body, { seed } = {}) {
  const project = mkdtempSync(join(tmpdir(), "anti-slop-store-"));
  const registry = mkdtempSync(join(tmpdir(), "anti-slop-store-reg-"));
  try {
    if (seed) {
      mkdirSync(join(project, ".anti-slop"), { recursive: true });
      for (const [name, text] of Object.entries(seed)) {
        writeFileSync(join(project, ".anti-slop", name), text);
      }
    }
    const script = [
      `const store = await import(${JSON.stringify(STORE_URL)});`,
      "const out = await (async (store) => {" + body + "})(store);",
      "process.stdout.write(JSON.stringify(out));",
    ].join("\n");
    const run = spawnSync(process.execPath, ["--input-type=module", "-e", script], {
      cwd: project,
      env: { ...process.env, ANTI_SLOP_REGISTRY_DIR: registry },
      encoding: "utf8",
    });
    assert.equal(run.status, 0, run.stderr);
    return { value: JSON.parse(run.stdout), project, registry };
  } finally {
    rmSync(project, { recursive: true, force: true });
    rmSync(registry, { recursive: true, force: true });
  }
}

// ── Corrupt-JSON fallbacks ───────────────────────────────────────────────────
// Every reader swallows a JSON.parse throw and returns an empty collection. That is the
// right call for a cache file, and it is also why a torn write is silent data loss rather
// than a crash -- which is what writeJsonAtomic exists to prevent.

test("a corrupt config.json falls back to an empty config instead of throwing", () => {
  const { value } = inProject("return store.loadProjectConfig();", { seed: { "config.json": "{ not json" } });
  assert.deepEqual(value, {});
});

test("a corrupt scan-log.json falls back to an empty log", () => {
  const { value } = inProject("return store.loadLog();", { seed: { "scan-log.json": "[[[" } });
  assert.deepEqual(value, []);
});

test("a corrupt scores.json falls back to an empty score list", () => {
  const { value } = inProject("return store.loadScores();", { seed: { "scores.json": "nope" } });
  assert.deepEqual(value, []);
});

test("a corrupt registry.json falls back to an empty registry", () => {
  const project = mkdtempSync(join(tmpdir(), "anti-slop-store-"));
  const registry = mkdtempSync(join(tmpdir(), "anti-slop-store-reg-"));
  try {
    writeFileSync(join(registry, "registry.json"), "{oops");
    const script = [
      `const store = await import(${JSON.stringify(STORE_URL)});`,
      "process.stdout.write(JSON.stringify(store.loadRegistry()));",
    ].join("\n");
    const run = spawnSync(process.execPath, ["--input-type=module", "-e", script], {
      cwd: project,
      env: { ...process.env, ANTI_SLOP_REGISTRY_DIR: registry },
      encoding: "utf8",
    });
    assert.equal(run.status, 0, run.stderr);
    assert.deepEqual(JSON.parse(run.stdout), {});
  } finally {
    rmSync(project, { recursive: true, force: true });
    rmSync(registry, { recursive: true, force: true });
  }
});

// ── Retention caps ───────────────────────────────────────────────────────────

test("saveLog keeps the most recent LOG_LIMIT rows and drops the oldest", () => {
  const { value } = inProject(`
    const rows = Array.from({ length: store.LOG_LIMIT + 100 }, (_, i) => ({ i }));
    store.saveLog(rows);
    const kept = store.loadLog();
    return { limit: store.LOG_LIMIT, kept: kept.length, first: kept[0].i, last: kept[kept.length - 1].i };
  `);
  assert.equal(value.kept, value.limit);
  assert.equal(value.first, 100, "the oldest rows are the ones dropped");
  assert.equal(value.last, value.limit + 99);
});

test("saveScores appends a batch in one cycle and caps at SCORE_LIMIT", () => {
  const { value } = inProject(`
    store.saveScores([{ score: 1, file: "a", violations: 0 }]);
    store.saveScores(Array.from({ length: store.SCORE_LIMIT + 5 }, (_, i) => ({ score: i, file: "b", violations: i })));
    const kept = store.loadScores();
    return { limit: store.SCORE_LIMIT, kept: kept.length, firstScore: kept[0].score, stamped: typeof kept[0].timestamp };
  `);
  assert.equal(value.kept, value.limit);
  // 1 + (LIMIT + 5) = LIMIT + 6 rows written, LIMIT kept, so the first 6 -- the whole
  // first batch plus scores 0..4 of the second -- are the ones evicted.
  assert.equal(value.firstScore, 5, "the earliest rows, including the first batch, are evicted first");
  assert.equal(value.stamped, "string", "every stored score carries a timestamp");
});

test("saveScores on an empty batch writes nothing at all", () => {
  const { value } = inProject(`
    const { existsSync } = await import("node:fs");
    store.saveScores([]);
    return { dataDir: existsSync(process.cwd() + "/.anti-slop") };
  `);
  assert.equal(value.dataDir, false, "an empty batch must not even create the data directory");
});

// ── Lazy data directory ──────────────────────────────────────────────────────

test("the read paths never create .anti-slop/", () => {
  const { value } = inProject(`
    const { existsSync } = await import("node:fs");
    store.loadLog(); store.loadScores(); store.loadProjectConfig();
    return { dataDir: existsSync(process.cwd() + "/.anti-slop") };
  `);
  assert.equal(value.dataDir, false, "history and stats on an untouched project must leave no trace");
});

// ── Port selection ───────────────────────────────────────────────────────────

test("getPreferredPort is stable per project path and stays inside its band", () => {
  const { value } = inProject(`
    const a = store.getPreferredPort();
    const b = store.getPreferredPort();
    return { a, b };
  `);
  assert.equal(value.a, value.b, "the same project must always prefer the same port");
  assert.ok(value.a >= 7847 && value.a <= 8846, `port ${value.a} outside the 7847..8846 band`);
});

test("two different project paths prefer different ports", () => {
  const first = inProject("return store.getPreferredPort();").value;
  const second = inProject("return store.getPreferredPort();").value;
  assert.notEqual(first, second, "the port is derived from the project path, so two paths should differ");
});

test("checkPort rejects a non-number without opening a socket", () => {
  const { value } = inProject(`
    return {
      zero: await store.checkPort(0),
      nul: await store.checkPort(null),
      str: await store.checkPort("80"),
      undef: await store.checkPort(undefined),
    };
  `);
  assert.deepEqual(value, { zero: false, nul: false, str: false, undef: false });
});

// ── Registry lifecycle ───────────────────────────────────────────────────────

test("registerProject and unregisterProject round trip through the registry file", () => {
  const { value } = inProject(`
    store.registerProject(9123);
    const afterRegister = store.loadRegistry();
    const entry = afterRegister[store.PROJECT_PATH];
    store.unregisterProject();
    return {
      registeredPort: entry && entry.port,
      registeredName: entry && entry.name,
      expectedName: store.PROJECT_NAME,
      afterUnregister: Object.keys(store.loadRegistry()).length,
    };
  `);
  assert.equal(value.registeredPort, 9123);
  assert.equal(value.registeredName, value.expectedName);
  assert.equal(value.afterUnregister, 0);
});

test("cleanStaleEntries purges entries whose port has no listener", () => {
  const { value } = inProject(`
    store.saveRegistry({ "/gone/one": { port: 9124, name: "one" }, "/gone/two": { port: 9125, name: "two" } });
    await store.cleanStaleEntries();
    return Object.keys(store.loadRegistry());
  `);
  assert.deepEqual(value, [], "no listener on either port means both entries are dead");
});

// ── Atomic writes ────────────────────────────────────────────────────────────

test("a completed write leaves no .tmp file behind", () => {
  const project = mkdtempSync(join(tmpdir(), "anti-slop-store-"));
  const registry = mkdtempSync(join(tmpdir(), "anti-slop-store-reg-"));
  try {
    const script = [
      `const store = await import(${JSON.stringify(STORE_URL)});`,
      'store.saveLog([{ type: "banned-word", word: "delve" }]);',
      "store.saveScores([{ score: 47, file: 'a.md', violations: 1 }]);",
    ].join("\n");
    const run = spawnSync(process.execPath, ["--input-type=module", "-e", script], {
      cwd: project,
      env: { ...process.env, ANTI_SLOP_REGISTRY_DIR: registry },
      encoding: "utf8",
    });
    assert.equal(run.status, 0, run.stderr);
    const dataDir = join(project, ".anti-slop");
    assert.equal(existsSync(join(dataDir, "scan-log.json.tmp")), false);
    assert.equal(existsSync(join(dataDir, "scores.json.tmp")), false);
    assert.equal(JSON.parse(readFileSync(join(dataDir, "scan-log.json"), "utf8")).length, 1);
  } finally {
    rmSync(project, { recursive: true, force: true });
    rmSync(registry, { recursive: true, force: true });
  }
});
