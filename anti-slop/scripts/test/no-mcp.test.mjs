import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync, spawn } from "node:child_process";

const HERE = dirname(fileURLToPath(import.meta.url));
const SCRIPTS_DIR = dirname(HERE);
const PLUGIN_ROOT = dirname(SCRIPTS_DIR);
const ENTRY_PATH = join(SCRIPTS_DIR, "slop-scanner.mjs");

const scratchDir = () => mkdtempSync(join(tmpdir(), "anti-slop-nomcp-"));
const run = (args, cwd) => spawnSync(process.execPath, [ENTRY_PATH, ...args], { cwd, encoding: "utf8" });

// ── The MCP layer is gone, not merely unused ─────────────────────────────────

test("the plugin ships no .mcp.json", () => {
  assert.equal(
    existsSync(join(PLUGIN_ROOT, ".mcp.json")),
    false,
    "a stale .mcp.json would make Claude Code try to start a server that no longer exists",
  );
});

test("the entry point carries no MCP server code", () => {
  const src = readFileSync(ENTRY_PATH, "utf8");
  for (const token of ["modelcontextprotocol", "StdioServerTransport", "ListToolsRequestSchema", "CallToolRequestSchema", "setRequestHandler"]) {
    assert.ok(!src.includes(token), `slop-scanner.mjs still references ${token}`);
  }
});

test("no library module imports the MCP SDK", () => {
  for (const mod of ["lib/cli.mjs", "lib/scan.mjs", "lib/rules.mjs", "lib/store.mjs", "lib/stats.mjs", "lib/dashboard.mjs"]) {
    const src = readFileSync(join(SCRIPTS_DIR, mod), "utf8");
    assert.ok(!src.includes("modelcontextprotocol"), `${mod} still imports the MCP SDK`);
  }
});

test("the MCP SDK is no longer a dependency", () => {
  const pkg = JSON.parse(readFileSync(join(SCRIPTS_DIR, "package.json"), "utf8"));
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };
  assert.ok(
    !Object.keys(deps).some((d) => d.includes("modelcontextprotocol")),
    `package.json still depends on ${JSON.stringify(deps)}`,
  );
});

// The plugin now has zero runtime dependencies, which is the point: it is a scanner, and a
// scanner that needs an npm install before it can run is a scanner that silently does not.
test("the scanner runs with no node_modules present", () => {
  const dir = scratchDir();
  try {
    writeFileSync(join(dir, "slop.md"), "This is delve. This is delve. This is delve.\n");
    const result = run(["scan", "slop.md"], dir);
    assert.equal(result.status, 1, result.stderr);
    assert.match(result.stdout, /Scan score: \d+\/50/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ── Zero-arg invocation ──────────────────────────────────────────────────────

test("invoking with zero args prints usage and exits, rather than hanging as a server", async () => {
  const dir = scratchDir();
  try {
    const child = spawn(process.execPath, [ENTRY_PATH], { cwd: dir, stdio: ["pipe", "pipe", "pipe"] });
    let stderr = "";
    child.stderr.on("data", (d) => { stderr += d; });
    const status = await new Promise((resolve) => {
      const timer = setTimeout(() => { child.kill(); resolve("hung"); }, 3000);
      child.on("exit", (code) => { clearTimeout(timer); resolve(code); });
    });
    assert.notEqual(status, "hung", "zero-arg invocation must not sit there as a long-running process");
    assert.equal(status, 2);
    assert.match(stderr, /Usage: slop-scanner/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ── The three capabilities that used to be MCP-only ──────────────────────────

test("history: reports nothing recorded, then the recorded scan", () => {
  const dir = scratchDir();
  try {
    const empty = run(["history"], dir);
    assert.equal(empty.status, 0, empty.stderr);
    assert.match(empty.stdout, /No scores recorded yet/);

    writeFileSync(join(dir, "slop.md"), "This is delve. This is delve. This is delve.\n");
    run(["scan", "--record", "--quiet", "slop.md"], dir);

    const after = run(["history"], dir);
    assert.equal(after.status, 0, after.stderr);
    assert.match(after.stdout, /Scan score: \d+\/50/);
    assert.match(after.stdout, /slop\.md/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("stats: reports nothing recorded, then per-rule active and suppressed counts", () => {
  const dir = scratchDir();
  try {
    const empty = run(["stats"], dir);
    assert.equal(empty.status, 0, empty.stderr);
    assert.match(empty.stdout, /No findings recorded yet/);

    writeFileSync(join(dir, "slop.md"), "This is delve. This is delve. This is delve.\n");
    run(["scan", "--record", "--quiet", "slop.md"], dir);

    const after = run(["stats"], dir);
    assert.equal(after.status, 0, after.stderr);
    assert.match(after.stdout, /delve/);
    assert.match(after.stdout, /active/);
    assert.match(after.stdout, /suppressed/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// The v1.5.0 invariant survives the MCP removal, with the CLI subcommand replacing the tool
// call as the ONLY thing that may open a port.
test("dashboard: the config switch still disables it and starts nothing", () => {
  const dir = scratchDir();
  try {
    writeFileSync(join(dir, ".anti-slop-config-marker"), "");
    const cfgDir = join(dir, ".anti-slop");
    spawnSync("mkdir", ["-p", cfgDir]);
    writeFileSync(join(cfgDir, "config.json"), JSON.stringify({ dashboard: false }));
    const result = run(["dashboard"], dir);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /disabled/i);
    assert.ok(!/http:\/\/127\.0\.0\.1:\d+/.test(result.stdout), "a disabled dashboard must not print a URL");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("no subcommand opens a port unless it is `dashboard`", () => {
  const dir = scratchDir();
  try {
    writeFileSync(join(dir, "slop.md"), "This is delve. This is delve. This is delve.\n");
    for (const args of [["scan", "--record", "--quiet", "slop.md"], ["history"], ["stats"]]) {
      const result = run(args, dir);
      assert.ok(result.status === 0 || result.status === 1, `${args[0]} exited ${result.status}: ${result.stderr}`);
      assert.ok(!/http:\/\/127\.0\.0\.1:\d+/.test(result.stdout), `${args[0]} printed a dashboard URL`);
    }
    const registry = join(dir, ".anti-slop", "registry.json");
    assert.equal(existsSync(registry), false, "no scan-path command may register a dashboard port");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("an unknown subcommand is a usage error naming the valid ones", () => {
  const dir = scratchDir();
  try {
    const result = run(["serve"], dir);
    assert.equal(result.status, 2);
    assert.match(result.stderr, /Unknown command: serve/);
    assert.match(result.stderr, /scan/);
    assert.match(result.stderr, /dashboard/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
