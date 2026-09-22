#!/usr/bin/env node
// Jev audit of the anti-slop plugin (maintainer tool, not shipped). Usage:
//   TYPESAFE_API_KEY=... node audit.mjs <label> [battery,...]
//   batteries: sections,words,phrases,rules,pairs,gaps (default all)
// Writes out/<label>/<battery>.json (raw answers) and out/<label>/report.md. Responses are
// cached under cache/ by a hash of the request, so a rescore re-bills only what changed;
// JEV_FRESH=1 bypasses the cache. See README.md in this directory.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  MODEL, READER, SECTION_QUESTIONS, WORD_QUESTIONS, PHRASE_QUESTIONS, RULE_QUESTIONS,
  PAIR_QUESTIONS, GAP_QUESTIONS, FLAG, REVIEW_LOW, ACTION_EDIT, ACTION_REWRITE,
} from "./questions.mjs";
import { GAP_CANDIDATES } from "./candidates.mjs";
import { PAIRS } from "./pairs.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = process.env.ANTI_SLOP_REPO || join(HERE, "..", "..");
const PLUGIN = join(REPO, "anti-slop");
const SKILL_DIR = join(PLUGIN, "skills", "anti-slop");
const REFS = join(SKILL_DIR, "references");
const KEY = (process.env.TYPESAFE_API_KEY || "").trim();
if (!KEY) { console.error("TYPESAFE_API_KEY missing (source ~/.zshenv)"); process.exit(2); }

const label = process.argv[2];
if (!label) { console.error("usage: node audit.mjs <label> [batteries]"); process.exit(2); }
const batteries = (process.argv[3] || "sections,words,phrases,rules,pairs,gaps").split(",");
const OUT = join(HERE, "out", label);
mkdirSync(OUT, { recursive: true });
const CACHE_DIR = join(HERE, "cache");
mkdirSync(CACHE_DIR, { recursive: true });
const FRESH = process.env.JEV_FRESH === "1";

// ── Files under audit (model-facing surfaces) ──
const FILES = [
  { id: "SKILL.md", path: join(SKILL_DIR, "SKILL.md") },
  { id: "agents/slop-detector.md", path: join(PLUGIN, "agents", "slop-detector.md") },
  { id: "commands/slop-check.md", path: join(PLUGIN, "commands", "slop-check.md") },
  ...[
    "confidence-and-evidence", "choosing-with-intent", "empirical-rankings", "self-check",
    "writing-patterns", "banned-words", "banned-phrases", "code-patterns", "design-patterns",
    "frontend-patterns", "native-ui-patterns", "density-and-economy", "regression-patterns",
  ].map((n) => ({ id: `references/${n}.md`, path: join(REFS, `${n}.md`) })),
];

function readFile(id) {
  const f = FILES.find((x) => x.id === id);
  if (!f) throw new Error(`unknown file id ${id}`);
  return readFileSync(f.path, "utf8");
}

// ── Jev client ──
let inflight = 0;
const MAX_INFLIGHT = 4;
const queue = [];
function slot() {
  return new Promise((resolve) => { queue.push(resolve); pump(); });
}
function pump() {
  while (inflight < MAX_INFLIGHT && queue.length) { inflight += 1; queue.shift()(); }
}
function release() { inflight -= 1; pump(); }

const usage = { requests: 0, input_tokens: 0, cached: 0, request_ids: [] };

async function jev(state, questions, tag) {
  const body = { model: MODEL, state, questions };
  const hash = createHash("sha256").update(JSON.stringify(body)).digest("hex");
  const cachePath = join(CACHE_DIR, `${hash}.json`);
  if (!FRESH && existsSync(cachePath)) {
    usage.cached += 1;
    return JSON.parse(readFileSync(cachePath, "utf8"));
  }
  await slot();
  try {
    for (let attempt = 0; attempt < 5; attempt++) {
      let res;
      try {
        res = await fetch("https://api.typesafe.ai/v1/systemone", {
          method: "POST",
          headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(60000),
        });
      } catch (err) {
        if (attempt === 4) throw err;
        await new Promise((r) => setTimeout(r, 500 * 2 ** attempt));
        continue;
      }
      if (res.status === 429 || res.status >= 500) {
        const wait = Number(res.headers.get("retry-after")) * 1000 || 500 * 2 ** attempt;
        await res.text();
        await new Promise((r) => setTimeout(r, wait));
        continue;
      }
      const text = await res.text();
      if (!res.ok) {
        // Do not echo the state: a 422 body echoes the request back.
        throw new Error(`${tag}: HTTP ${res.status} ${text.slice(0, 200)}`);
      }
      const json = JSON.parse(text);
      usage.requests += 1;
      usage.input_tokens += json.usage?.input_tokens || 0;
      usage.request_ids.push(res.headers.get("x-typesafe-request-id"));
      if (json.model !== MODEL) console.error(`WARNING model drift: ${json.model}`);
      writeFileSync(cachePath, JSON.stringify(json));
      return json;
    }
    throw new Error(`${tag}: retries exhausted`);
  } finally {
    release();
  }
}

// ── Markdown chunking ──
function stripFrontmatter(md) {
  if (!md.startsWith("---")) return md;
  const end = md.indexOf("\n---", 3);
  return end === -1 ? md : md.slice(end + 4);
}
function words(s) { return (s.match(/\S+/g) || []).length; }

export function chunk(id, md) {
  const lines = stripFrontmatter(md).split("\n");
  const raw = [];
  let cur = { heading: "(preamble)", level: 1, lines: [] };
  const stack = [];
  let inFence = false;
  for (const line of lines) {
    if (/^\s*(```|~~~)/.test(line)) inFence = !inFence;
    const m = !inFence && line.match(/^(#{1,4})\s+(.*)$/);
    if (m) {
      raw.push(cur);
      const level = m[1].length;
      while (stack.length && stack[stack.length - 1].level >= level) stack.pop();
      stack.push({ level, text: m[2].trim() });
      cur = { heading: stack.map((s) => s.text).join(" > "), level, lines: [line] };
    } else {
      cur.lines.push(line);
    }
  }
  raw.push(cur);
  // Merge tiny chunks into the previous one (a tiny FIRST chunk, such as a bare file title,
  // merges forward into the next); split huge ones at paragraph breaks.
  const merged = [];
  let carry = null;
  for (const c of raw) {
    const text = c.lines.join("\n").trim();
    if (!text) continue;
    if (words(text) < 40 && merged.length) {
      merged[merged.length - 1].text += `\n\n${text}`;
      merged[merged.length - 1].heading += ` + ${c.heading.split(" > ").pop()}`;
      continue;
    }
    if (words(text) < 40 && !merged.length) {
      carry = carry ? { heading: carry.heading, text: `${carry.text}\n\n${text}` } : { heading: c.heading, text };
      continue;
    }
    if (carry) {
      merged.push({ heading: c.heading, text: `${carry.text}\n\n${text}` });
      carry = null;
      continue;
    }
    merged.push({ heading: c.heading, text });
  }
  if (carry) merged.push(carry);
  const out = [];
  for (const c of merged) {
    if (words(c.text) <= 1400) { out.push(c); continue; }
    const paras = c.text.split(/\n\s*\n/);
    let part = [], n = 0, k = 0;
    for (const p of paras) {
      if (n + words(p) > 1100 && part.length) {
        out.push({ heading: `${c.heading} (part ${++k})`, text: part.join("\n\n") });
        part = []; n = 0;
      }
      part.push(p); n += words(p);
    }
    if (part.length) out.push({ heading: `${c.heading} (part ${++k})`, text: part.join("\n\n") });
  }
  return out.map((c, i) => ({ file: id, index: i, heading: c.heading, words: words(c.text), text: c.text }));
}

// ── Batteries ──
async function runSections() {
  const sections = FILES.flatMap((f) => chunk(f.id, readFileSync(f.path, "utf8")));
  console.error(`sections: ${sections.length} chunks`);
  const results = await Promise.all(sections.map(async (s) => {
    const state = { reader: READER, file: s.file, section: s.heading, text: s.text };
    const r = await jev(state, SECTION_QUESTIONS, `${s.file}#${s.index}`);
    const a = r.answers;
    const nouls = {};
    for (const k of Object.keys(SECTION_QUESTIONS)) if (a[k]?.type === "noul") nouls[k] = a[k].noul;
    return {
      file: s.file, index: s.index, heading: s.heading, words: s.words,
      action: a.action.score, action_conf: a.action.confidence, action_p: a.action.probabilities,
      nouls,
    };
  }));
  writeFileSync(join(OUT, "sections.json"), JSON.stringify(results, null, 1));
  return results;
}

function parseWords() {
  const md = readFile("references/banned-words.md");
  const out = [];
  let section = "";
  for (const line of md.split("\n")) {
    const h = line.match(/^##\s+(.*)/); if (h) { section = h[1]; continue; }
    const m = line.match(/^\|\s*`([^`]+)`([^|]*)\|\s*([^|]*)\|?/);
    if (!m) continue;
    const note = m[2].trim();
    const suggested = (m[3] || "").trim().replace(/^\|?\s*/, "");
    for (const w of m[1].split(" / ")) {
      out.push({ word: w.trim(), section, note, suggested: suggested || "(delete)" });
    }
  }
  return out;
}

async function runWords() {
  const list = parseWords();
  console.error(`words: ${list.length}`);
  const BATCH = 40;
  const results = [];
  const jobs = [];
  for (let b = 0; b < list.length; b += BATCH) {
    const slice = list.slice(b, b + BATCH);
    const state = { words: slice.map(({ word, suggested }) => ({ word, suggested })) };
    let questions = {};
    slice.forEach((_, i) => Object.assign(questions, WORD_QUESTIONS(i)));
    jobs.push(jev(state, questions, `words ${b}`).then((r) => {
      slice.forEach((w, i) => results.push({
        ...w, ordinary: r.answers[`ordinary_${i}`].noul, loses_meaning: r.answers[`loses_meaning_${i}`].noul,
      }));
    }));
  }
  await Promise.all(jobs);
  results.sort((a, b) => (b.ordinary + b.loses_meaning) - (a.ordinary + a.loses_meaning));
  writeFileSync(join(OUT, "words.json"), JSON.stringify(results, null, 1));
  return results;
}

function parsePhrases() {
  const md = readFile("references/banned-phrases.md");
  const out = [];
  let section = "";
  for (const line of md.split("\n")) {
    const h = line.match(/^##\s+(.*)/); if (h) { section = h[1]; continue; }
    const m = line.match(/^-\s+"([^"]+)"\s*(\(.*\))?/);
    if (m) out.push({ phrase: m[1], section, note: (m[2] || "").trim() });
    else { const m2 = line.match(/^-\s+"?([A-Z][^"(]*?)"?\s*$/); if (m2 && section) out.push({ phrase: m2[1].trim(), section, note: "" }); }
  }
  return out;
}

async function runPhrases() {
  const list = parsePhrases();
  console.error(`phrases: ${list.length}`);
  const BATCH = 40;
  const results = [];
  const jobs = [];
  for (let b = 0; b < list.length; b += BATCH) {
    const slice = list.slice(b, b + BATCH);
    const state = { phrases: slice.map(({ phrase }) => ({ phrase })) };
    let questions = {};
    slice.forEach((_, i) => Object.assign(questions, PHRASE_QUESTIONS(i)));
    jobs.push(jev(state, questions, `phrases ${b}`).then((r) => {
      slice.forEach((p, i) => results.push({
        ...p, ordinary: r.answers[`ordinary_${i}`].noul, carries_meaning: r.answers[`carries_meaning_${i}`].noul,
      }));
    }));
  }
  await Promise.all(jobs);
  results.sort((a, b) => (b.ordinary + b.carries_meaning) - (a.ordinary + a.carries_meaning));
  writeFileSync(join(OUT, "phrases.json"), JSON.stringify(results, null, 1));
  return results;
}

async function runRules() {
  const rules = await import(join(PLUGIN, "scripts", "lib", "rules.mjs"));
  const all = [
    ...rules.DESIGN_PATTERNS.map((r) => ({ ...r, surface: "web markup, stylesheets and components" })),
    ...rules.NATIVE_PATTERNS.map((r) => ({ ...r, surface: "SwiftUI and UIKit source files" })),
    ...rules.CODE_PATTERNS.map((r) => ({ ...r, surface: "source code in any language" })),
    ...rules.TEXT_CONSTRUCTS.map((r) => ({ ...r, surface: "prose documents" })),
  ];
  const seen = new Set();
  const list = [];
  for (const r of all) {
    const key = `${r.name}|${r.surface}`;
    if (seen.has(key)) continue; seen.add(key);
    const sev = typeof r.severity === "function" ? "medium" : r.severity;
    // The finding as the CLI prints it: before 2.4.0 that was `[SEVERITY] desc`; from 2.4.0 the
    // rule id, the confidence class and a fix line follow. Scoring the printed form is what
    // makes a before/after comparison measure the output surface rather than one field.
    const finding = r.fix
      ? `[${sev.toUpperCase()}] ${r.desc}  (${r.name}, line 12, ${r.confidence})\n  fix: ${r.fix}`
      : `[${sev.toUpperCase()}] ${r.desc}`;
    list.push({
      name: r.name, surface: r.surface,
      severity: typeof r.severity === "function" ? "medium, escalating to high with count" : r.severity,
      confidence: r.confidence, mode: r.mode || "presence", minCount: r.minCount || 1, desc: r.desc, finding,
    });
  }
  console.error(`rules: ${list.length}`);
  const results = await Promise.all(list.map(async (rule) => {
    const state = { rule: { finding: rule.finding, surface: rule.surface } };
    const r = await jev(state, RULE_QUESTIONS, `rule ${rule.name}`);
    return {
      ...rule,
      desc_names_fix: r.answers.desc_names_fix.noul,
      defect_certain: r.answers.defect_certain.noul,
      cost: r.answers.cost_if_real.choice, cost_p: r.answers.cost_if_real.probabilities,
      reader_understands: r.answers.reader_understands.noul,
    };
  }));
  writeFileSync(join(OUT, "rules.json"), JSON.stringify(results, null, 1));
  return results;
}

function locateParagraph(id, ...needles) {
  const md = readFile(id);
  const paras = md.split(/\n\s*\n/);
  for (const needle of needles.filter(Boolean)) {
    const hit = paras.find((p) => p.includes(needle));
    if (hit) return hit.trim();
  }
  throw new Error(`pair locate failed in ${id}: ${needles[0].slice(0, 50)}`);
}

async function runPairs() {
  const results = await Promise.all(PAIRS.map(async (p) => {
    const a = { file: p.a.file, text: locateParagraph(p.a.file, p.a.locate, p.a.locateBefore) };
    const b = { file: p.b.file, text: locateParagraph(p.b.file, p.b.locate, p.b.locateBefore) };
    const state = { reader: READER, situation: p.situation, a, b };
    const r = await jev(state, PAIR_QUESTIONS, `pair ${p.id}`);
    return { id: p.id, situation: p.situation, a: p.a, b: p.b, conflict: r.answers.conflict.noul, needs_reconciling: r.answers.needs_reconciling.noul };
  }));
  results.sort((x, y) => (y.conflict + y.needs_reconciling) - (x.conflict + x.needs_reconciling));
  writeFileSync(join(OUT, "pairs.json"), JSON.stringify(results, null, 1));
  return results;
}

async function catalogue() {
  const entries = [];
  // The scanner's rules are part of what the plugin covers, so each one is a catalogue entry.
  const rules = await import(join(PLUGIN, "scripts", "lib", "rules.mjs"));
  for (const r of [...rules.DESIGN_PATTERNS, ...rules.NATIVE_PATTERNS, ...rules.CODE_PATTERNS, ...rules.TEXT_CONSTRUCTS]) {
    entries.push({ file: "scanner rule", section: r.name, summary: r.desc });
  }
  for (const f of FILES) {
    for (const c of chunk(f.id, readFileSync(f.path, "utf8"))) {
      const body = c.text.replace(/^#.*\n/, "").replace(/```[\s\S]*?```/g, " ").replace(/\s+/g, " ").trim();
      entries.push({ file: f.id.replace("references/", ""), section: c.heading, summary: body.split(" ").slice(0, 16).join(" ") });
    }
  }
  return entries;
}

async function runGaps() {
  const cat = await catalogue();
  const skill = readFile("SKILL.md");
  const scopeStart = skill.indexOf("## Scope and Limitations");
  const scopeEnd = skill.indexOf("## Context Exceptions");
  const scope = skill.slice(scopeStart, scopeEnd).trim();
  console.error(`gaps: ${GAP_CANDIDATES.length} candidates against ${cat.length} catalogue entries`);
  const BATCH = 8;
  const results = [];
  const jobs = [];
  for (let b = 0; b < GAP_CANDIDATES.length; b += BATCH) {
    const slice = GAP_CANDIDATES.slice(b, b + BATCH);
    const state = { scope, candidates: slice, catalogue: cat };
    let questions = {};
    slice.forEach((_, i) => Object.assign(questions, GAP_QUESTIONS(i)));
    jobs.push(jev(state, questions, `gaps ${b}`).then((r) => {
      slice.forEach((c, i) => results.push({ candidate: c, covered: r.answers[`covered_${i}`].noul, in_scope: r.answers[`in_scope_${i}`].noul }));
    }));
  }
  await Promise.all(jobs);
  results.sort((a, b) => (a.covered - b.covered));
  writeFileSync(join(OUT, "gaps.json"), JSON.stringify(results, null, 1));
  return results;
}

// ── Report ──
function fmt(n) { return n === undefined ? "-" : n.toFixed(2); }
function report(all) {
  const lines = [`# Jev audit: ${label}`, "", `Model ${MODEL}. Requests ${usage.requests} live, ${usage.cached} cached, ${usage.input_tokens} input tokens.`, ""];
  if (all.sections) {
    const s = all.sections;
    lines.push("## Sections", "");
    const byFile = new Map();
    for (const r of s) { if (!byFile.has(r.file)) byFile.set(r.file, []); byFile.get(r.file).push(r); }
    lines.push("| File | Chunks | Mean action (0 leave, 1 edit, 2 rewrite) | Chunks needing edit | Chunks needing rewrite | Mean forbids | Mean worse_if_literal | Mean padding | Mean gives_method |", "|---|--:|--:|--:|--:|--:|--:|--:|--:|");
    for (const [file, rows] of byFile) {
      const mean = (k) => rows.reduce((a, r) => a + r.nouls[k], 0) / rows.length;
      lines.push(`| ${file} | ${rows.length} | ${fmt(rows.reduce((a, r) => a + r.action, 0) / rows.length)} | ${rows.filter((r) => r.action >= ACTION_EDIT && r.action < ACTION_REWRITE).length} | ${rows.filter((r) => r.action >= ACTION_REWRITE).length} | ${fmt(mean("forbids_legitimate"))} | ${fmt(mean("worse_if_literal"))} | ${fmt(mean("padding"))} | ${fmt(mean("gives_method"))} |`);
    }
    const overall = s.reduce((a, r) => a + r.action, 0) / s.length;
    lines.push("", `Overall mean action: ${fmt(overall)} over ${s.length} chunks; ${s.filter((r) => r.action >= ACTION_EDIT).length} chunks at edit or above, ${s.filter((r) => r.action >= ACTION_REWRITE).length} at rewrite.`, "");
    lines.push("### Ranked chunks (action score, then flagged conditions)", "");
    const ranked = [...s].sort((x, y) => y.action - x.action || flags(y).length - flags(x).length);
    lines.push("| # | File | Section | Words | Action | Conf | Flags (>= 0.65) | Review band (0.45-0.65) |", "|--:|---|---|--:|--:|--:|---|---|");
    ranked.forEach((r, i) => {
      lines.push(`| ${i + 1} | ${r.file} | ${r.heading} | ${r.words} | ${fmt(r.action)} | ${fmt(r.action_conf)} | ${flags(r).join(", ")} | ${band(r).join(", ")} |`);
    });
    lines.push("");
    lines.push("### Condition frequency (share of chunks flagged >= 0.65)", "");
    for (const k of Object.keys(s[0].nouls)) {
      const n = s.filter((r) => r.nouls[k] >= FLAG).length;
      lines.push(`- ${k}: ${n}/${s.length} (${Math.round((100 * n) / s.length)}%)`);
    }
    lines.push("");
  }
  if (all.words) {
    lines.push("## Banned words: entries Jev reads as ordinary or precise (ordinary >= 0.65 or loses_meaning >= 0.65)", "");
    lines.push("| Word | Section | Ordinary | Loses meaning | Suggested |", "|---|---|--:|--:|---|");
    for (const w of all.words.filter((w) => w.ordinary >= FLAG || w.loses_meaning >= FLAG)) lines.push(`| ${w.word} | ${w.section} | ${fmt(w.ordinary)} | ${fmt(w.loses_meaning)} | ${w.suggested} |`);
    lines.push("", `Total words ${all.words.length}; flagged ${all.words.filter((w) => w.ordinary >= FLAG || w.loses_meaning >= FLAG).length}; mean ordinary ${fmt(all.words.reduce((a, w) => a + w.ordinary, 0) / all.words.length)}.`, "");
  }
  if (all.phrases) {
    lines.push("## Banned phrases: entries Jev reads as ordinary or meaningful (ordinary >= 0.65 or carries_meaning >= 0.65)", "");
    lines.push("| Phrase | Section | Ordinary | Carries meaning |", "|---|---|--:|--:|");
    for (const p of all.phrases.filter((p) => p.ordinary >= FLAG || p.carries_meaning >= FLAG)) lines.push(`| ${p.phrase} | ${p.section} | ${fmt(p.ordinary)} | ${fmt(p.carries_meaning)} |`);
    lines.push("", `Total phrases ${all.phrases.length}; flagged ${all.phrases.filter((p) => p.ordinary >= FLAG || p.carries_meaning >= FLAG).length}; mean ordinary ${fmt(all.phrases.reduce((a, p) => a + p.ordinary, 0) / all.phrases.length)}.`, "");
  }
  if (all.rules) {
    const r = all.rules;
    lines.push("## Scanner rules", "");
    lines.push(`Rules ${r.length}. Mean desc_names_fix ${fmt(r.reduce((a, x) => a + x.desc_names_fix, 0) / r.length)}; mean reader_understands ${fmt(r.reduce((a, x) => a + x.reader_understands, 0) / r.length)}.`, "");
    lines.push("| Rule | Surface | Severity | Confidence | desc_names_fix | defect_certain | Jev cost | reader_understands | Note |", "|---|---|---|---|--:|--:|---|--:|---|");
    for (const x of r) {
      const notes = [];
      if (x.confidence === "Hard defect" && x.defect_certain < REVIEW_LOW) notes.push("HARD but Jev doubts every match is a defect");
      if (x.confidence === "Pattern smell" && x.defect_certain >= FLAG) notes.push("SMELL but Jev reads every match as a defect");
      const sev = x.severity.startsWith("medium, escalating") ? "medium" : x.severity;
      if (x.cost !== sev && x.cost_p[x.cost] >= 0.6) notes.push(`Jev cost ${x.cost} vs severity ${sev}`);
      if (x.desc_names_fix < REVIEW_LOW) notes.push("no fix in desc");
      if (x.reader_understands < FLAG) notes.push("desc unclear");
      lines.push(`| ${x.name} | ${x.surface.split(" ")[0]} | ${sev} | ${x.confidence} | ${fmt(x.desc_names_fix)} | ${fmt(x.defect_certain)} | ${x.cost} (${fmt(x.cost_p[x.cost])}) | ${fmt(x.reader_understands)} | ${notes.join("; ")} |`);
    }
    lines.push("");
  }
  if (all.pairs) {
    lines.push("## Doctrine pairs", "");
    lines.push("| Pair | Conflict | Needs reconciling | Situation |", "|---|--:|--:|---|");
    for (const p of all.pairs) lines.push(`| ${p.id} | ${fmt(p.conflict)} | ${fmt(p.needs_reconciling)} | ${p.situation} |`);
    lines.push("");
  }
  if (all.gaps) {
    lines.push("## Coverage gaps (sorted by covered ascending)", "");
    lines.push("| Candidate | Covered | In scope |", "|---|--:|--:|");
    for (const g of all.gaps) lines.push(`| ${g.candidate} | ${fmt(g.covered)} | ${fmt(g.in_scope)} |`);
    lines.push("");
  }
  return lines.join("\n");
}
function flags(r) { return Object.entries(r.nouls).filter(([k, v]) => (k === "gives_method" ? v < REVIEW_LOW : v >= FLAG)).map(([k]) => (k === "gives_method" ? "no_method" : k)); }
function band(r) { return Object.entries(r.nouls).filter(([k, v]) => k !== "gives_method" && v >= REVIEW_LOW && v < FLAG).map(([k]) => k); }

const all = {};
const t0 = Date.now();
for (const b of batteries) {
  if (b === "sections") all.sections = await runSections();
  else if (b === "words") all.words = await runWords();
  else if (b === "phrases") all.phrases = await runPhrases();
  else if (b === "rules") all.rules = await runRules();
  else if (b === "pairs") all.pairs = await runPairs();
  else if (b === "gaps") all.gaps = await runGaps();
  else throw new Error(`unknown battery ${b}`);
}
const md = report(all);
writeFileSync(join(OUT, "report.md"), md);
writeFileSync(join(OUT, "usage.json"), JSON.stringify({ ...usage, request_ids: usage.request_ids.length, ms: Date.now() - t0 }, null, 1));
console.error(`done in ${Date.now() - t0} ms: ${usage.requests} live requests, ${usage.cached} cached, ${usage.input_tokens} input tokens`);
console.log(join(OUT, "report.md"));
