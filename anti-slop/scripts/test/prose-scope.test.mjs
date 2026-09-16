import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import * as scan from "../lib/scan.mjs";
import * as rules from "../lib/rules.mjs";

// ── Prose scope (2.3.0) ──────────────────────────────────────────────────────
// The writing rules cover user-facing prose. A prose file the project has not opted in is
// skipped: no findings, no "clean" line, no score, no record, no effect on the exit code.
// The suite preload (test/env.mjs) pins ANTI_SLOP_PROSE_SCOPE=all for every other test
// file, so the default's own tests clear it for their duration. Namespace imports keep
// the failure readable when a symbol is missing: "not a function" in the test that needs
// it, rather than a link error that takes the whole file down.

const { scanContent } = scan;
const HERE = dirname(fileURLToPath(import.meta.url));
const ENTRY_PATH = join(dirname(HERE), "slop-scanner.mjs");

const SLOP_MD = "This is delve. This is delve. This is delve.\n";
const SECRET_JS = 'const config = { password: "hunter2-not-a-real-value" };\n';

function withoutEnv(fn) {
  const saved = process.env.ANTI_SLOP_PROSE_SCOPE;
  delete process.env.ANTI_SLOP_PROSE_SCOPE;
  try { return fn(); } finally { if (saved !== undefined) process.env.ANTI_SLOP_PROSE_SCOPE = saved; }
}

function withEnv(value, fn) {
  const saved = process.env.ANTI_SLOP_PROSE_SCOPE;
  process.env.ANTI_SLOP_PROSE_SCOPE = value;
  try { return fn(); } finally {
    if (saved === undefined) delete process.env.ANTI_SLOP_PROSE_SCOPE;
    else process.env.ANTI_SLOP_PROSE_SCOPE = saved;
  }
}

// Child processes get the suite's environment minus the preload's pin, so the CLI runs
// under its real default unless a test sets the variable on purpose.
function childEnv(overrides = {}) {
  const { ANTI_SLOP_PROSE_SCOPE, ...env } = process.env;
  return { ...env, ...overrides };
}

function scratchDir() {
  return mkdtempSync(join(tmpdir(), "anti-slop-prose-scope-"));
}

function runCli(args, cwd, env = childEnv()) {
  return spawnSync(process.execPath, [ENTRY_PATH, "scan", ...args], { cwd, encoding: "utf8", env });
}

function writeConfig(dir, config) {
  mkdirSync(join(dir, ".anti-slop"), { recursive: true });
  writeFileSync(join(dir, ".anti-slop", "config.json"), JSON.stringify(config));
}

// ── The scope itself ─────────────────────────────────────────────────────────

test("the two scopes are user-facing and all, and user-facing is the default", () => {
  assert.deepEqual([...rules.PROSE_SCOPES], ["user-facing", "all"]);
  assert.equal(rules.DEFAULT_PROSE_SCOPE, "user-facing");
  withoutEnv(() => assert.equal(scan.proseScope(), "user-facing"));
});

test("under the default scope an internal document scans to nothing", () => {
  withoutEnv(() => {
    assert.deepEqual(scanContent(SLOP_MD, "docs/plan.md"), []);
    assert.deepEqual(scanContent(SLOP_MD, "docs/plan.md", { collectSuppressed: true }), []);
    assert.deepEqual(scan.proseScopeFor("docs/plan.md"), { scope: "user-facing", prose: true, inScope: false });
  });
});

test("code files sit outside the prose scope: comment rules and code rules still run", () => {
  withoutEnv(() => {
    const violations = scanContent(SECRET_JS, "secret.js");
    assert.ok(violations.some((v) => v.severity === "high"), JSON.stringify(violations));
    assert.deepEqual(scan.proseScopeFor("secret.js"), { scope: "user-facing", prose: false, inScope: true });
    const comment = scanContent("// we delve, delve, delve\nconst x = 1;\n", "note.ts");
    assert.ok(comment.some((v) => v.type === "banned-word" && v.word === "delve"), JSON.stringify(comment));
  });
});

test("opts.proseScope all scans a prose file in full", () => {
  withoutEnv(() => {
    const all = scanContent(SLOP_MD, "docs/plan.md", { proseScope: "all" });
    assert.ok(all.some((v) => v.type === "banned-word" && v.word === "delve"), JSON.stringify(all));
    assert.deepEqual(scan.proseScopeFor("docs/plan.md", { proseScope: "all" }), { scope: "all", prose: true, inScope: true });
  });
});

test("ANTI_SLOP_PROSE_SCOPE sets the scope when the caller passes none; the caller wins; unknown values are ignored", () => {
  withEnv("all", () => assert.ok(scanContent(SLOP_MD, "docs/plan.md").length > 0));
  withEnv("user-facing", () => assert.deepEqual(scanContent(SLOP_MD, "docs/plan.md"), []));
  withEnv("everything", () => assert.equal(scan.proseScope(), "user-facing"));
  withEnv("all", () => assert.deepEqual(scanContent(SLOP_MD, "docs/plan.md", { proseScope: "user-facing" }), []));
});

test("globToRegExp: the forms a config needs", () => {
  const matches = (glob, path) => scan.globToRegExp(glob).test(path);
  assert.ok(matches("**/*.md", "a.md"));
  assert.ok(matches("**/*.md", "docs/x/a.md"));
  assert.ok(!matches("**/*.md", "a.txt"));
  assert.ok(matches("docs/**", "docs/a.md"));
  assert.ok(matches("docs/**", "docs/x/y.md"));
  assert.ok(!matches("docs/**", "doc/a.md"));
  assert.ok(!matches("docs/**", "docs"));
  assert.ok(matches("docs/**/*.md", "docs/a.md"));
  assert.ok(matches("docs/**/*.md", "docs/x/a.md"));
  assert.ok(!matches("docs/**/*.md", "docs/x/a.txt"));
  assert.ok(matches("README.md", "README.md"));
  assert.ok(!matches("README.md", "sub/README.md"));
  assert.ok(matches("*.txt", "a.txt"));
  assert.ok(!matches("*.txt", "x/a.txt"));
  assert.ok(matches("notes/?.md", "notes/a.md"));
  assert.ok(!matches("notes/?.md", "notes/ab.md"));
  // Regex metacharacters in a glob are literal.
  assert.ok(!matches("a.b.md", "aXb.md"));
  assert.ok(matches("release-notes (draft).md", "release-notes (draft).md"));
});

// ── The CLI ──────────────────────────────────────────────────────────────────

test("CLI: userFacingProse opts files in; everything else prints as skipped, never as clean", () => {
  const dir = scratchDir();
  try {
    writeConfig(dir, { userFacingProse: ["docs/public/**", "README.md"] });
    mkdirSync(join(dir, "docs", "public"), { recursive: true });
    for (const f of ["docs/public/guide.md", "docs/plan.md", "README.md", "notes.txt"]) writeFileSync(join(dir, f), SLOP_MD);
    writeFileSync(join(dir, "app.js"), SECRET_JS);
    const files = ["docs/plan.md", "docs/public/guide.md", "README.md", "notes.txt", "app.js"];

    const json = runCli(["--format", "json", ...files], dir);
    assert.equal(json.status, 1, json.stderr);
    const parsed = JSON.parse(json.stdout);
    assert.deepEqual(parsed.files.map((f) => f.file), ["docs/public/guide.md", "README.md", "app.js"]);
    assert.deepEqual(parsed.skipped, [
      { file: "docs/plan.md", reason: "prose-scope" },
      { file: "notes.txt", reason: "prose-scope" },
    ]);
    assert.equal(parsed.totals.files, 3, "totals count scanned files only");
    assert.ok(parsed.files.every((f) => f.violations.length > 0));

    const text = runCli(files, dir);
    assert.equal(text.status, 1, text.stderr);
    assert.match(text.stdout, /^docs\/plan\.md: skipped \(prose scope: user-facing\)$/m);
    assert.match(text.stdout, /^notes\.txt: skipped \(prose scope: user-facing\)$/m);
    assert.ok(!/plan\.md: clean/.test(text.stdout), "a skipped file must never read as clean");
    assert.match(text.stdout, /^Total: \d+ violation\(s\) across 3 files/m);
    assert.match(text.stdout, /^2 prose file\(s\) skipped under prose scope user-facing: list them under userFacingProse/m);
    assert.ok(
      text.stdout.indexOf("docs/plan.md: skipped") < text.stdout.indexOf("docs/public/guide.md"),
      "input order is kept: the skipped line sits where the caller listed the file",
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("CLI: an absolute path is matched against its project-relative form", () => {
  const dir = scratchDir();
  try {
    writeConfig(dir, { userFacingProse: ["docs/public/**"] });
    mkdirSync(join(dir, "docs", "public"), { recursive: true });
    writeFileSync(join(dir, "docs", "public", "guide.md"), SLOP_MD);
    const result = runCli(["--format", "json", join(dir, "docs", "public", "guide.md")], dir);
    assert.equal(result.status, 1, result.stderr);
    assert.equal(JSON.parse(result.stdout).skipped.length, 0);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("CLI: --prose-scope all scans the file, outranks the environment, and rejects other values", () => {
  const dir = scratchDir();
  try {
    mkdirSync(join(dir, "docs"), { recursive: true });
    writeFileSync(join(dir, "docs", "plan.md"), SLOP_MD);
    const scanned = runCli(["--prose-scope", "all", "docs/plan.md"], dir);
    assert.equal(scanned.status, 1, scanned.stderr);
    assert.match(scanned.stdout, /Scan score: \d+\/50/);

    const overEnv = runCli(["--prose-scope", "user-facing", "docs/plan.md"], dir, childEnv({ ANTI_SLOP_PROSE_SCOPE: "all" }));
    assert.equal(overEnv.status, 0, overEnv.stderr);
    assert.match(overEnv.stdout, /^docs\/plan\.md: skipped \(prose scope: user-facing\)$/m);

    const bogus = runCli(["--prose-scope", "everything", "docs/plan.md"], dir);
    assert.equal(bogus.status, 2);
    assert.match(bogus.stderr, /--prose-scope must be one of user-facing\|all \(got everything\)/);
    assert.equal(bogus.stdout, "");

    const missing = runCli(["--prose-scope"], dir);
    assert.equal(missing.status, 2);
    assert.match(missing.stderr, /--prose-scope must be one of user-facing\|all \(got nothing\)/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("CLI: with no flag, the environment sets the scope and outranks the config", () => {
  const dir = scratchDir();
  try {
    mkdirSync(join(dir, "docs"), { recursive: true });
    writeFileSync(join(dir, "docs", "plan.md"), SLOP_MD);
    assert.equal(runCli(["docs/plan.md"], dir).status, 0, "default: skipped");
    assert.equal(runCli(["docs/plan.md"], dir, childEnv({ ANTI_SLOP_PROSE_SCOPE: "all" })).status, 1, "env all: scanned");
    writeConfig(dir, { proseScope: "all" });
    assert.equal(runCli(["docs/plan.md"], dir).status, 1, "config all: scanned");
    assert.equal(
      runCli(["docs/plan.md"], dir, childEnv({ ANTI_SLOP_PROSE_SCOPE: "user-facing" })).status, 0,
      "env user-facing outranks config all",
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("CLI: a skipped file never affects the exit code and is never recorded", () => {
  const dir = scratchDir();
  try {
    mkdirSync(join(dir, "docs"), { recursive: true });
    writeFileSync(join(dir, "docs", "plan.md"), SLOP_MD);
    writeFileSync(join(dir, "app.js"), SECRET_JS);

    const only = runCli(["--record", "--fail-on", "any", "docs/plan.md"], dir);
    assert.equal(only.status, 0, only.stderr);
    assert.equal(existsSync(join(dir, ".anti-slop")), false, "a run that skipped everything writes nothing");

    const mixed = runCli(["--record", "--quiet", "docs/plan.md", "app.js"], dir);
    assert.equal(mixed.status, 1);
    const scores = JSON.parse(readFileSync(join(dir, ".anti-slop", "scores.json"), "utf8"));
    assert.equal(scores.length, 1);
    assert.equal(scores[0].file, "app.js", "the one scanned file names itself; the skipped one is not a file of the run");
    const log = JSON.parse(readFileSync(join(dir, ".anti-slop", "scan-log.json"), "utf8"));
    assert.ok(log.length > 0 && log.every((e) => e.file === "app.js"), JSON.stringify(log));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("CLI: --quiet prints nothing for a skipped file either, and --help documents the flag", () => {
  const dir = scratchDir();
  try {
    writeFileSync(join(dir, "plan.md"), SLOP_MD);
    const quiet = runCli(["--quiet", "plan.md"], dir);
    assert.equal(quiet.status, 0);
    assert.equal(quiet.stdout, "");
    assert.equal(quiet.stderr, "");
    const help = spawnSync(process.execPath, [ENTRY_PATH, "--help"], { cwd: dir, encoding: "utf8", env: childEnv() });
    assert.equal(help.status, 0);
    assert.match(help.stdout, /--prose-scope SCOPE\s+user-facing\|all/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
