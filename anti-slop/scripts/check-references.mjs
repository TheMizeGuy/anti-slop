#!/usr/bin/env node
// Link integrity for the skill's reference library.
//
// Every `references/<path>.md` citation in shipped content must resolve to a real file,
// and every `#anchor` on one must resolve to a real heading in that file. A citation that
// does not resolve is a SILENT capability loss: the agent follows the pointer, finds
// nothing, and degrades without reporting it.
//
// Citations in this repo are mostly bare filenames (`design-patterns.md`) because the
// skill and the references sit in one directory, so both forms are checked.
//
// Zero dependencies, Node >= 18 stdlib only. Exit 0 pass, 1 fail.

import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, relative, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const PLUGIN_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const REFERENCES_DIR = join(PLUGIN_ROOT, "skills", "anti-slop", "references");

// Scratch and machine-written state. Not shipped, not our contract to keep.
const SKIP_DIRS = new Set([".git", ".serena", ".claude", ".anti-slop", ".remember", "node_modules"]);

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (entry.endsWith(".md")) out.push(full);
  }
  return out;
}

// GitHub-flavoured heading slug: lowercase, strip punctuation, spaces to dashes.
function slugify(heading) {
  return heading
    .replace(/`/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

function headingSlugs(text) {
  const slugs = new Set();
  for (const line of text.split("\n")) {
    const m = /^#{1,6}\s+(.*)$/.exec(line);
    if (m) slugs.add(slugify(m[1].trim()));
  }
  return slugs;
}

const referenceFiles = new Set(readdirSync(REFERENCES_DIR).filter((f) => f.endsWith(".md")));
const slugIndex = new Map();
for (const f of referenceFiles) {
  slugIndex.set(f, headingSlugs(readFileSync(join(REFERENCES_DIR, f), "utf8")));
}

// Either `references/foo.md` (from SKILL.md or an agent) or a bare `foo.md` in backticks
// (how the reference files cite each other). Both resolve to the same directory.
const CITATION = /(?:references\/)?([a-z0-9-]+\.md)(#[A-Za-z0-9-]+)?/g;

const docs = walk(PLUGIN_ROOT);
const failures = [];
const referenced = new Set();
let citations = 0;

for (const f of docs) {
  const rel = relative(PLUGIN_ROOT, f);
  const lines = readFileSync(f, "utf8").split("\n");
  lines.forEach((line, i) => {
    for (const m of line.matchAll(CITATION)) {
      const [full, file, anchor] = m;
      // Only judge names that look like reference citations: an explicit references/ path,
      // or a bare name that matches a file we actually ship. Anything else (README.md,
      // CHANGELOG.md, a filename in prose) is out of scope.
      const isExplicit = full.startsWith("references/");
      if (!isExplicit && !referenceFiles.has(file)) continue;
      citations++;
      referenced.add(file);
      if (!referenceFiles.has(file) && !existsSync(join(PLUGIN_ROOT, "references", file))) {
        failures.push({ file: rel, line: i + 1, ref: full, why: "file does not exist" });
      } else if (anchor && !slugIndex.get(file)?.has(anchor.slice(1))) {
        failures.push({ file: rel, line: i + 1, ref: full, why: "anchor does not exist in that file" });
      }
    }
  });
}

// The mirror failure: a reference nothing points at is a reference no agent will ever
// read. Warn rather than fail -- a newly added file is legitimately unwired for one commit.
const orphans = [...referenceFiles].filter((f) => !referenced.has(f)).sort();

console.log(`checked ${citations} reference citations across ${docs.length} markdown files`);
if (orphans.length) {
  console.log(`\nWARN: ${orphans.length} reference file(s) nothing cites (unreachable to agents):`);
  for (const o of orphans) console.log(`  ${o}`);
}
if (failures.length) {
  console.log(`\nFAIL: ${failures.length} broken citation(s):`);
  for (const f of failures) console.log(`  ${f.file}:${f.line}  ${f.ref}  -- ${f.why}`);
  process.exit(1);
}
console.log("\nPASS: every reference citation resolves.");
