import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const SCRIPTS = join(dirname(fileURLToPath(import.meta.url)), "..");
const REFERENCES = join(SCRIPTS, "..", "skills", "anti-slop", "references");

// A citation that does not resolve is a silent capability loss: the agent follows the
// pointer, finds nothing, and degrades without reporting it. Nothing else in the suite
// would notice.
test("every reference citation resolves to a real file and heading", () => {
  const run = spawnSync(process.execPath, [join(SCRIPTS, "check-references.mjs")], { encoding: "utf8" });
  assert.equal(run.status, 0, run.stdout + run.stderr);
  assert.match(run.stdout, /PASS: every reference citation resolves/);
});

test("no reference file is orphaned (nothing cites it)", () => {
  const run = spawnSync(process.execPath, [join(SCRIPTS, "check-references.mjs")], { encoding: "utf8" });
  assert.ok(
    !run.stdout.includes("WARN:"),
    `a reference nothing cites is a reference no agent will read:\n${run.stdout}`,
  );
});

// The skill body is the only entry point an agent is guaranteed to read, so a reference it
// never mentions is reachable only by accident.
test("SKILL.md or the detector agent reaches every reference file", () => {
  const skill = readFileSync(join(REFERENCES, "..", "SKILL.md"), "utf8");
  const agent = readFileSync(join(SCRIPTS, "..", "agents", "slop-detector.md"), "utf8");
  const entryPoints = skill + agent;
  for (const file of readdirSync(REFERENCES).filter((f) => f.endsWith(".md"))) {
    assert.ok(entryPoints.includes(file), `${file} is cited by no entry point (SKILL.md or slop-detector.md)`);
  }
});
