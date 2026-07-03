import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { spawnSync, spawn } from "node:child_process";
import { scanContent, calculateScore } from "../lib/scan.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const SCRIPTS_DIR = dirname(HERE);
const ENTRY_PATH = join(SCRIPTS_DIR, "slop-scanner.mjs");

const SLOP_MD = 'This is delve. This is delve. This is delve.\n';
const SECRET_JS = 'const config = { password: "hunter2-not-a-real-value" };\n';

// Every child runs with its own scratch cwd so .anti-slop/ never touches the repo's own data,
// and each gets a fresh temp dir per test to keep --record assertions isolated.
function scratchDir() {
  return mkdtempSync(join(tmpdir(), "anti-slop-cli-"));
}

function runCli(args, cwd) {
  return spawnSync(process.execPath, [ENTRY_PATH, "scan", ...args], { cwd, encoding: "utf8" });
}

// ── A2: text report on a slop file ──

test("A2: scan on a slop file exits 1 with a readable 'Scan score: N/50' report", () => {
  const dir = scratchDir();
  try {
    writeFileSync(join(dir, "slop.md"), SLOP_MD);
    const result = runCli(["slop.md"], dir);
    assert.equal(result.status, 1);
    assert.match(result.stdout, /Scan score: \d+\/50/);
    assert.match(result.stdout, /delve/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ── A2: --format json shape, nothing else on stdout ──

test("A2: --format json emits the D5 JSON shape and nothing else on stdout", () => {
  const dir = scratchDir();
  try {
    writeFileSync(join(dir, "slop.md"), SLOP_MD);
    const result = runCli(["--format", "json", "slop.md"], dir);
    assert.equal(result.status, 1);
    const parsed = JSON.parse(result.stdout);
    assert.ok(Array.isArray(parsed.files) && parsed.files.length === 1);
    const [file] = parsed.files;
    assert.equal(file.file, "slop.md");
    assert.ok(Number.isInteger(file.score));
    assert.equal(typeof file.verdict, "string");
    assert.ok(Array.isArray(file.violations) && file.violations.length > 0);
    assert.deepEqual(Object.keys(parsed.totals).sort(), ["bySeverity", "files", "violations"]);
    assert.equal(parsed.totals.files, 1);
    assert.equal(parsed.totals.violations, file.violations.length);
    assert.deepEqual(Object.keys(parsed.totals.bySeverity).sort(), ["high", "low", "medium"]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ── A2: --fail-on thresholds ──

test("A2: --fail-on high exits 0 when only low/medium findings exist", () => {
  const dir = scratchDir();
  try {
    writeFileSync(join(dir, "slop.md"), SLOP_MD);
    // Sanity check the fixture actually has no high-severity findings before trusting the exit code.
    const violations = scanContent(SLOP_MD, "slop.md");
    assert.ok(violations.length > 0 && violations.every((v) => v.severity !== "high"));

    const result = runCli(["--fail-on", "high", "slop.md"], dir);
    assert.equal(result.status, 0, result.stderr);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("A2: --fail-on none always exits 0, even with findings", () => {
  const dir = scratchDir();
  try {
    writeFileSync(join(dir, "slop.md"), SLOP_MD);
    const result = runCli(["--fail-on", "none", "slop.md"], dir);
    assert.equal(result.status, 0, result.stderr);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("A2: --fail-on high exits 1 when a high-severity finding exists", () => {
  const dir = scratchDir();
  try {
    writeFileSync(join(dir, "secret.js"), SECRET_JS);
    const violations = scanContent(SECRET_JS, "secret.js");
    assert.ok(violations.some((v) => v.severity === "high"), "fixture must contain a high-severity finding");

    const result = runCli(["--fail-on", "high", "secret.js"], dir);
    assert.equal(result.status, 1);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ── A2: usage errors exit 2 ──

test("A2: an unreadable file exits 2 with a usage message on stderr", () => {
  const dir = scratchDir();
  try {
    const result = runCli(["missing.md"], dir);
    assert.equal(result.status, 2);
    assert.match(result.stderr, /Cannot read file/);
    assert.match(result.stderr, /Usage:/);
    assert.equal(result.stdout, "");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("A2: an unknown flag exits 2 with a usage message on stderr", () => {
  const dir = scratchDir();
  try {
    writeFileSync(join(dir, "slop.md"), SLOP_MD);
    const result = runCli(["--bogus", "slop.md"], dir);
    assert.equal(result.status, 2);
    assert.match(result.stderr, /Unknown option: --bogus/);
    assert.match(result.stderr, /Usage:/);
    assert.equal(result.stdout, "");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("A2: no file arguments exits 2 with a usage message on stderr", () => {
  const dir = scratchDir();
  try {
    const result = runCli([], dir);
    assert.equal(result.status, 2);
    assert.match(result.stderr, /Usage:/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ── A2: --quiet suppresses output but keeps the exit code ──

test("A2: --quiet prints nothing on either stream and still sets the exit code", () => {
  const dir = scratchDir();
  try {
    writeFileSync(join(dir, "slop.md"), SLOP_MD);
    const result = runCli(["--quiet", "slop.md"], dir);
    assert.equal(result.status, 1);
    assert.equal(result.stdout, "");
    assert.equal(result.stderr, "");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ── A3: no side effects by default ──

test("A3: without --record, a CLI scan leaves no .anti-slop directory behind", () => {
  const dir = scratchDir();
  try {
    writeFileSync(join(dir, "slop.md"), SLOP_MD);
    const result = runCli(["slop.md"], dir);
    assert.equal(result.status, 1);
    assert.equal(existsSync(join(dir, ".anti-slop")), false, "a plain CLI scan must not create .anti-slop/");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("A3: --record writes scores.json and scan-log.json exactly as an MCP scan_file call would", () => {
  const dir = scratchDir();
  try {
    writeFileSync(join(dir, "slop.md"), SLOP_MD);
    const result = runCli(["--record", "slop.md"], dir);
    assert.equal(result.status, 1);

    const expectedViolations = scanContent(SLOP_MD, "slop.md");
    const expectedScore = calculateScore(expectedViolations);

    const scores = JSON.parse(readFileSync(join(dir, ".anti-slop", "scores.json"), "utf8"));
    assert.equal(scores.length, 1);
    assert.equal(scores[0].score, expectedScore);
    assert.equal(scores[0].file, "slop.md");
    assert.equal(scores[0].violations, expectedViolations.length);
    assert.match(scores[0].timestamp, /^\d{4}-\d{2}-\d{2}T/);

    const log = JSON.parse(readFileSync(join(dir, ".anti-slop", "scan-log.json"), "utf8"));
    assert.equal(log.length, expectedViolations.length);
    log.forEach((entry, i) => {
      const { timestamp, ...rest } = entry;
      const { ...expected } = expectedViolations[i];
      assert.deepEqual(rest, { ...expected, file: "slop.md" });
      assert.match(timestamp, /^\d{4}-\d{2}-\d{2}T/);
    });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("A3: --record on a clean file still logs a score entry but no scan-log entries", () => {
  const dir = scratchDir();
  try {
    writeFileSync(join(dir, "clean.md"), "The migration ran cleanly against the staging copy.\n");
    const result = runCli(["--record", "clean.md"], dir);
    assert.equal(result.status, 0, result.stderr);

    const scores = JSON.parse(readFileSync(join(dir, ".anti-slop", "scores.json"), "utf8"));
    assert.equal(scores.length, 1);
    assert.equal(scores[0].violations, 0);
    assert.equal(existsSync(join(dir, ".anti-slop", "scan-log.json")), false, "no findings means no scan-log.json write");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ── A1: zero-arg invocation is unaffected by the new dispatch ──

test("A1: invoking with zero args still starts the MCP stdio server (stays alive, does not exit)", async () => {
  const dir = scratchDir();
  try {
    const child = spawn(process.execPath, [ENTRY_PATH], { cwd: dir, stdio: ["pipe", "ignore", "ignore"] });
    let exited = false;
    child.on("exit", () => { exited = true; });
    await new Promise((resolve) => setTimeout(resolve, 400));
    assert.equal(exited, false, "zero-arg invocation must start the long-running MCP server, not exit immediately");
    child.kill();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
