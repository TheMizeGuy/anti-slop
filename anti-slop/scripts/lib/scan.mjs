import { extname, isAbsolute, relative, sep } from "path";
import { realpathSync } from "fs";
import { loadProjectConfig } from "./store.mjs";
import {
  BANNED_WORDS,
  BANNED_WORD_REGEXES,
  LOW_CONFIDENCE_WORDS,
  BANNED_PHRASES,
  BANNED_PHRASE_REGEXES,
  DESIGN_PATTERNS,
  CODE_PATTERNS,
  TEXT_CONSTRUCTS,
  NATIVE_PATTERNS,
  CONTEXT_EXCEPTION_REGEXES,
  ESCAPE_HATCH,
  EMDASH_MIN_COUNT,
  EMDASH_MIN_DENSITY,
  EMOJI_REGEX,
  EMOJI_FILE_GUARD,
  EMOJI_ESCALATE_COUNT,
  PROSE_EXTENSIONS,
  PROSE_SCOPES,
  DEFAULT_PROSE_SCOPE,
  CODE_SURFACE_EXTENSIONS,
  WEB_SURFACE_EXTENSIONS,
  NATIVE_UI_EXTENSIONS,
  CONCENTRATION,
  KNOWN_RULE_IDS,
  BANNED_WORD_CONFIDENCE,
  BANNED_PHRASE_CONFIDENCE,
  EMDASH_CONFIDENCE,
  EMOJI_CONFIDENCE,
  BANNED_WORD_FIX,
  BANNED_PHRASE_FIX,
  EMDASH_FIX,
  EMOJI_FIX,
} from "./rules.mjs";
import { makeContext, matchingClassSets, parseWaiver, waiverCovers } from "./design-detect.mjs";

// ── Concentration gate ──
// A rule declaring mode CONCENTRATION reports nothing until its match count reaches
// minCount. Below the threshold the technique was used once, which is a choice, not a
// pattern -- reporting it is the false positive that trains people to ignore the scanner.
function meetsThreshold(pat, count) {
  if (count === 0) return false;
  return pat.mode === CONCENTRATION ? count >= pat.minCount : true;
}

// ── Prose noise-stripping: keep only the author's own prose. Blanks fenced code,
// inline code, double-quoted spans (straight or typographic), blockquotes, YAML frontmatter,
// and any line carrying the escape-hatch marker. Line count is preserved so line numbers hold. ──
function stripProseNoise(content) {
  const lines = content.split("\n");
  const out = [];
  let inFence = false;
  let inFrontmatter = false;
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    if (i === 0 && line.trim() === "---") { inFrontmatter = true; out.push(""); continue; }
    if (inFrontmatter) { if (line.trim() === "---") inFrontmatter = false; out.push(""); continue; }
    if (/^\s*(```|~~~)/.test(line)) { inFence = !inFence; out.push(""); continue; }
    if (inFence) { out.push(""); continue; }
    if (/^\s*>/.test(line)) { out.push(""); continue; }
    if (ESCAPE_HATCH.test(line)) { out.push(""); continue; }
    line = line.replace(/`[^`]*`/g, " ").replace(/"[^"\n]*"/g, " ").replace(/\u201C[^\u201D\n]*\u201D/g, " ");
    out.push(line);
  }
  return out.join("\n");
}

const LEADING_COMMENT = /^\s*(\/\/|#|\*|\/\*|<!--|--)/;
const TRAILING_COMMENT = /(?:\/\/|\/\*|<!--|#|--).*$/;

// ── Blank every string literal on a line ──
// A `//` inside "http://example" is not a comment marker, and a banned word inside a UI
// copy string is not a comment. Both are handled by removing the literals first.
function stripStringLiterals(line) {
  return line
    .replace(/`(?:\\.|[^`\\])*`/g, "``")
    .replace(/"(?:\\.|[^"\\])*"/g, '""')
    .replace(/'(?:\\.|[^'\\])*'/g, "''");
}

// ── Comment text only (for scanning code files for prose-style tells) ──
// Both comment shapes count: a whole line whose first token is a marker, and the tail of
// a line after an unquoted marker. Trailing comments are the most common comment form in
// real code, and scanning only full-line comments made every one of them invisible.
// Line count is PRESERVED (a line contributing no comment becomes ""), the same way
// stripProseNoise preserves it: a finding reports the line it was found on, and dropping
// the non-comment lines made every code-surface line number off by however many lines of
// actual code preceded the match. Blank lines change no match count.
function extractComments(content) {
  const out = [];
  for (const line of content.split("\n")) {
    if (ESCAPE_HATCH.test(line)) { out.push(""); continue; }
    if (LEADING_COMMENT.test(line)) { out.push(line); continue; }
    const tail = stripStringLiterals(line).match(TRAILING_COMMENT);
    out.push(tail ? tail[0] : "");
  }
  return out.join("\n");
}

// ── Blank any line carrying the escape-hatch marker (preserves line count) ──
function stripEscapeHatchLines(content) {
  return content.split("\n").map(l => (ESCAPE_HATCH.test(l) ? "" : l)).join("\n");
}

// ── Mirror of stripEscapeHatchLines that KEEPS only the escape-hatched lines ──
function extractEscapeHatchedLines(content) {
  return content.split("\n").map(l => (ESCAPE_HATCH.test(l) ? l : "")).join("\n");
}

// ── File-scope guards (rules.mjs `requires` / `requiresMinCount` / `unless`) ──
// Evaluated ONCE per file, before the per-line loop: a rule whose file-level precondition
// fails never runs at all. A rule declaring neither field is always allowed.
export function fileGuardOk(pat, content) {
  if (pat.unless && pat.unless.test(content)) return false;
  if (pat.requires) {
    const found = content.match(globalize(pat.requires));
    if (!found || found.length < (pat.requiresMinCount || 1)) return false;
  }
  return true;
}

// ── Class-attribute token sets ──
// Utility-class order inside a class source is arbitrary, so a fingerprint rule matches the
// token SET, not a sequence, and one source at a time: a whole-line AND would match
// `class="rounded-xl"` on one element and `class="shadow-sm border"` on the next. Sources
// come from design-detect's classTokenSets (class=, className=, cn/clsx/twMerge, multi-line
// attributes), and the two arms of a ternary never pair.
function classAllMatches(ctx, required) {
  return matchingClassSets(ctx.classSets, (tokens) => required.every((req) =>
    typeof req === "string" ? tokens.includes(req) : tokens.some((t) => req.test(t))));
}

function globalize(re) {
  return re.flags.includes("g") ? re : new RegExp(re.source, re.flags + "g");
}

// ── Where a finding is (the remediation floor's other half) ──
// A finding that names no location is one the reader has to go looking for, which is the
// same failure as a finding that names no fix. Every violation object carries `line`: the
// 1-based line of its FIRST contributing match, counted against a haystack that preserves
// the original line count (stripProseNoise, extractComments and the per-line loops all do).
//
// A fresh RegExp per call rather than globalize(): exec() advances lastIndex, and the
// per-word and per-rule regexes are module-level objects shared across every scan.
function freshGlobal(re) {
  return new RegExp(re.source, re.flags.includes("g") ? re.flags : re.flags + "g");
}

function lineAtIndex(text, index) {
  return text.slice(0, index).split("\n").length;
}

function firstMatchLine(text, re) {
  const m = freshGlobal(re).exec(text);
  return m ? lineAtIndex(text, m.index) : null;
}

// Whole-word phrase matches (rules.mjs BANNED_PHRASE_REGEXES): the count and the line of
// the first one, or null.
function phraseMatches(hay, phrase) {
  const re = BANNED_PHRASE_REGEXES.get(phrase);
  if (!phrase || !re) return null;
  const g = freshGlobal(re);
  let count = 0;
  let first = -1;
  let m;
  while ((m = g.exec(hay)) !== null) {
    if (first === -1) first = m.index;
    count++;
    if (m[0].length === 0) g.lastIndex++;
  }
  return count ? { count, line: lineAtIndex(hay, first) } : null;
}

function resolveSeverity(sev, count) {
  return typeof sev === "function" ? sev(count) : sev;
}

// ── Domain-context exception ──
// Word-start anchored (see rules.mjs CONTEXT_EXCEPTION_REGEXES). The old raw
// `contentLower.includes(entry)` was an unanchored substring test over the whole file, so
// the word "important" excused a banned word whose exception list contains "port", and
// "settings" excused one whose list contains "set", in almost every real document.
function hasContextException(lowerWord, contentLower) {
  const exceptions = CONTEXT_EXCEPTION_REGEXES.get(lowerWord);
  return Boolean(exceptions && exceptions.some((re) => re.test(contentLower)));
}

// ── Count a table rule's hits on the lines it may see ──
// Four counting shapes, in precedence order: `hits` (a file-level detector over the shared
// design-detect context, for tells that need the stylesheet rather than a line: a colour
// pair, a block's font metrics), `classAll` (unordered class-token set), `count` (a per-line
// predicate for tells whose arithmetic a regex cannot state -- see `token-drift-spacing`,
// which has to know that 13 is off a 4px grid and 16 is not), and the default `pattern`
// match count.
// Returns { count, line, lines, evidence }: the total, the 1-based line of the first hit
// (what the finding reports), every contributing line (sorted, at most 20) and the first
// hit's matched text. `escapedOnly` inverts the hatch test for the suppressed capture.
const MAX_LINES = 20;

function summariseHits(hits) {
  hits.sort((a, b) => a.line - b.line);
  const lines = [...new Set(hits.map((h) => h.line))].slice(0, MAX_LINES);
  const first = hits[0];
  const evidence = first && first.evidence ? String(first.evidence).replace(/\s+/g, " ").trim().slice(0, 120) : null;
  return { count: hits.length, line: first ? first.line : null, lines, evidence };
}

function countLinePattern(src, pat, escapedOnly = false) {
  const lineOk = (n) => waiverCovers(src.waiverAt(n), pat.name) === escapedOnly;
  if (pat.hits) {
    // `gate(hits)` runs after the hatch: a rule whose verdict is a combination or a
    // repetition decides it on the hits that survive, so a hatched leg completes nothing.
    const kept = (pat.hits(src.ctx) || []).filter((h) => Number.isInteger(h.line) && lineOk(h.line));
    return summariseHits(pat.gate ? pat.gate(kept) : kept);
  }
  if (pat.classAll) {
    return summariseHits(classAllMatches(src.ctx, pat.classAll)
      .filter((set) => lineOk(set.line) && !(pat.suppress && pat.suppress.test(src.lines[set.line - 1] || "")))
      .map((set) => ({ line: set.line, evidence: set.tokens.join(" ") })));
  }
  const g = pat.count ? null : globalize(pat.pattern);
  const hits = [];
  for (let i = 0; i < src.lines.length; i++) {
    if (!lineOk(i + 1)) continue;
    const text = src.lines[i];
    if (pat.suppress && pat.suppress.test(text)) continue;
    if (pat.count) {
      const n = pat.count(text);
      for (let k = 0; k < n; k++) hits.push({ line: i + 1, evidence: text });
    } else {
      for (const m of text.match(g) || []) hits.push({ line: i + 1, evidence: m });
    }
  }
  return summariseHits(hits);
}

// The per-file views the table rules read. UI tells (and a code rule that declares
// `blankComments`) match the comment-blanked text, since a commented-out declaration is not
// on the page; every other code rule matches raw lines, because comments are what several of
// them exist to read. Both views read the escape hatch from the RAW line, where the marker
// lives, and share one design-detect context, built on first use so a file no rule reaches
// past its raw lines never pays for it.
function ruleSources(content, ext, designSystem) {
  const rawLines = content.split("\n");
  let ctx = null;
  const context = () => ctx || (ctx = makeContext(content, ext, { designSystem }));
  const waivers = new Map();
  const waiverAt = (n) => {
    if (!waivers.has(n)) waivers.set(n, parseWaiver(rawLines[n - 1] ?? "", KNOWN_RULE_IDS));
    return waivers.get(n);
  };
  return {
    waiverAt,
    raw: { lines: rawLines, rawLines, text: content, waiverAt, get ctx() { return context(); } },
    blanked: { get lines() { return context().lines; }, rawLines, waiverAt, get text() { return context().text; }, get ctx() { return context(); } },
  };
}

// How a suppressed finding was waived: the line-wide hatch or a waiver naming the rule.
function suppressedBy(src, line) {
  const w = line ? src.waiverAt(line) : null;
  return w && !w.all ? `waiver:${[...w.rules].join(",")}` : "escape-hatch";
}

// A scoped waiver naming an id no rule has suppresses nothing; the caller hears about it.
function unknownWaivers(rawLines) {
  const out = [];
  rawLines.forEach((raw, i) => {
    const w = parseWaiver(raw, KNOWN_RULE_IDS);
    if (w && w.unknown && w.unknown.length) out.push({ line: i + 1, unknown: w.unknown });
  });
  return out;
}

// ── Suppressed-finding capture (opts.collectSuppressed) ──
// Mirror of stripProseNoise that KEEPS only the escape-hatched lines (blanking
// everything else, including fence/frontmatter/blockquote lines per the same
// precedence as the active path) so callers can measure what an escape-hatched
// line would have tripped had the marker not been there.
function extractEscapeHatchedProse(content) {
  const lines = content.split("\n");
  const out = [];
  let inFence = false;
  let inFrontmatter = false;
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    if (i === 0 && line.trim() === "---") { inFrontmatter = true; out.push(""); continue; }
    if (inFrontmatter) { if (line.trim() === "---") inFrontmatter = false; out.push(""); continue; }
    if (/^\s*(```|~~~)/.test(line)) { inFence = !inFence; out.push(""); continue; }
    if (inFence) { out.push(""); continue; }
    if (/^\s*>/.test(line)) { out.push(""); continue; }
    if (!ESCAPE_HATCH.test(line)) { out.push(""); continue; }
    line = line.replace(/`[^`]*`/g, " ").replace(/"[^"\n]*"/g, " ").replace(/\u201C[^\u201D\n]*\u201D/g, " ");
    out.push(line);
  }
  return out.join("\n");
}

// Mirror of extractComments that selects only the escape-hatched comment lines, and
// preserves the line count for the same reason it does.
function extractEscapeHatchedComments(content) {
  return content.split("\n")
    .map(l => (/^\s*(\/\/|#|\*|\/\*|<!--|--)/.test(l) && ESCAPE_HATCH.test(l) ? l : ""))
    .join("\n");
}

// Additive-only: computes what WOULD have fired for two deliberate-suppression paths
// -- (a) escape-hatched lines, (b) an allowedWords config entry -- so the dashboard can
// show suppressed activity without ever touching the active `violations` array above it.
// Scope is the four rule families keyed by a stable violation `type`: banned-word,
// banned-phrase, design-tell, code-pattern. text-construct and emoji are deferred:
// their per-line escape semantics differ (density/whole-document rules), so counting
// a hatched line as one suppressed construct would misstate what was avoided.
function collectSuppressedViolations({ content, sources, isProse, isCode, isStyle, isTestFile, proseScan, allowedWords, contentLower }) {
  const suppressed = [];

  // (a) escape-hatch: words/phrases/design/code hits confined to escape-hatched lines.
  if (isProse || isCode) {
    const hatchedText = isProse ? extractEscapeHatchedProse(content) : extractEscapeHatchedComments(content);
    for (const word of BANNED_WORDS) {
      const lw = word.toLowerCase();
      // Allowed words are counted under (b) against the active text; a hatched-only
      // occurrence of an allowed word is deliberately counted nowhere (double-suppressed).
      if (allowedWords.has(lw)) continue;
      if (hasContextException(lw, contentLower)) continue;
      const matches = hatchedText.match(BANNED_WORD_REGEXES.get(word));
      if (!matches) continue;
      const count = matches.length;
      const lowConf = LOW_CONFIDENCE_WORDS.has(lw);
      if (lowConf && count < 2) continue;
      suppressed.push({
        type: "banned-word", word, count,
        line: firstMatchLine(hatchedText, BANNED_WORD_REGEXES.get(word)),
        severity: lowConf ? "low" : "medium",
        confidence: BANNED_WORD_CONFIDENCE,
        fix: BANNED_WORD_FIX,
        desc: `Banned AI-tell word "${word}" found ${count}x`,
        suppressed: true, suppressedBy: "escape-hatch",
      });
    }
  }

  // Phrases mirror the active path on BOTH surfaces. Guarding this branch on isProse alone
  // meant an escape-hatched phrase in a code file could not even be reported as suppressed.
  if (isProse || isCode) {
    const hatchedHay = isProse ? extractEscapeHatchedProse(content) : extractEscapeHatchedLines(content);
    for (const phrase of BANNED_PHRASES) {
      const found = phraseMatches(hatchedHay, phrase);
      if (!found) continue;
      const { count, line: lineNum } = found;
      suppressed.push({
        type: "banned-phrase", phrase, line: lineNum, count,
        severity: "medium",
        confidence: BANNED_PHRASE_CONFIDENCE,
        fix: BANNED_PHRASE_FIX,
        desc: `Banned phrase "${phrase}" found ${count}x (first at line ${lineNum})`,
        suppressed: true, suppressedBy: "escape-hatch",
      });
    }
  }

  if (isStyle) {
    for (const pat of DESIGN_PATTERNS) {
      if (!fileGuardOk(pat, sources.blanked.text)) continue;
      // A suppress-regex guard still applies inside: if it matches, the rule would not have
      // fired even without the escape hatch, so that hit is a rule-internal exclusion.
      const { count, line } = countLinePattern(sources.blanked, pat, true);
      if (meetsThreshold(pat, count)) {
        suppressed.push({
          type: "design-tell", name: pat.name, count, line,
          severity: resolveSeverity(pat.severity, count),
          confidence: pat.confidence, mode: pat.mode,
          fix: pat.fix,
          desc: `${pat.desc} (${count}x)`,
          suppressed: true, suppressedBy: suppressedBy(sources.blanked, line),
        });
      }
    }
  }

  if (isCode) {
    for (const pat of CODE_PATTERNS) {
      if (isTestFile && pat.skipInTests) continue;
      const source = pat.blankComments ? sources.blanked : sources.raw;
      if (!fileGuardOk(pat, source.text)) continue;
      const { count, line } = countLinePattern(source, pat, true);
      if (meetsThreshold(pat, count)) {
        suppressed.push({
          type: "code-pattern", name: pat.name, count, line,
          severity: resolveSeverity(pat.severity, count),
          confidence: pat.confidence,
          fix: pat.fix,
          desc: `${pat.desc} (${count}x)`,
          suppressed: true, suppressedBy: suppressedBy(source, line),
        });
      }
    }
  }

  // (b) allowedWords: uses the SAME active textToScan (hatch lines already excluded
  // there), so this never double-counts against (a).
  if ((isProse || isCode) && allowedWords.size > 0) {
    const textToScan = isProse ? proseScan : extractComments(content);
    for (const word of BANNED_WORDS) {
      const lw = word.toLowerCase();
      if (!allowedWords.has(lw)) continue;
      if (hasContextException(lw, contentLower)) continue;
      const matches = textToScan.match(BANNED_WORD_REGEXES.get(word));
      if (!matches) continue;
      const count = matches.length;
      const lowConf = LOW_CONFIDENCE_WORDS.has(lw);
      if (lowConf && count < 2) continue;
      suppressed.push({
        type: "banned-word", word, count,
        line: firstMatchLine(textToScan, BANNED_WORD_REGEXES.get(word)),
        severity: lowConf ? "low" : "medium",
        confidence: BANNED_WORD_CONFIDENCE,
        fix: BANNED_WORD_FIX,
        desc: `Banned AI-tell word "${word}" found ${count}x`,
        suppressed: true, suppressedBy: "allowed-words",
      });
    }
  }

  return suppressed;
}

// ── Prose scope (rules.mjs PROSE_SCOPES) ──
// Precedence: the caller's opts (the CLI flag), then ANTI_SLOP_PROSE_SCOPE, then the
// project config, then the default. An unrecognised value at any level is ignored rather
// than failing the scan, the same way a malformed config file reads as empty.
function resolveProseScope(opts, config) {
  for (const candidate of [opts.proseScope, process.env.ANTI_SLOP_PROSE_SCOPE, config.proseScope]) {
    if (PROSE_SCOPES.includes(candidate)) return candidate;
  }
  return DEFAULT_PROSE_SCOPE;
}

export function proseScope(opts = {}) {
  return resolveProseScope(opts, loadProjectConfig());
}

// A small glob dialect, enough for a config file: `**` crosses directories, `*` and `?`
// stay inside one segment, everything else is literal. Anchored to the whole path, so
// `docs/**` takes a directory, `**/*.md` takes every markdown file, and `README.md` takes
// the root README and nothing else. No dependency, and no `path.matchesGlob`, which
// still prints an experimental warning on Node 22. Case-insensitive, because the
// filesystems most projects sit on fold case and `README.md` has to opt in `Readme.md`.
export function globToRegExp(glob) {
  // `**/**/` is `**/`. Uncollapsed, each segment compiled to an optional greedy group and a
  // chain of them backtracked exponentially on a non-match (twelve segments: nine seconds
  // on a 42-character path, from the 2.3.1 review). A segment run compiles to whole
  // segments, `(?:[^/]+/)*`, which a `/` delimits and the engine cannot re-partition.
  const collapsed = String(glob).replace(/(?:\*\*\/)+/g, "**/").replace(/\*{3,}/g, "**");
  let source = "";
  for (let i = 0; i < collapsed.length; i++) {
    const c = collapsed[i];
    if (c === "*" && collapsed[i + 1] === "*") {
      i += 1;
      if (collapsed[i + 1] === "/") { i += 1; source += "(?:[^/]+/)*"; } else source += ".*";
    } else if (c === "*") {
      source += "[^/]*";
    } else if (c === "?") {
      source += "[^/]";
    } else {
      source += c.replace(/[.+^${}()|[\]\\]/g, "\\$&");
    }
  }
  return new RegExp(`^${source}$`, "i");
}

function toPosix(p) {
  return String(p).split(sep).join("/").replace(/^\.\//, "");
}

// The path as the caller gave it, plus its project-relative form when it was absolute:
// `git diff --name-only` hands the CLI relative paths, an editor or a command hands it
// absolute ones, and one config has to match both. Both ends are also resolved through
// realpath, because macOS hands out symlinked temp and volume paths (/var, /tmp) while
// getcwd() returns the resolved form, and `relative()` across that seam yields `../..`.
function candidatePaths(filePath) {
  const paths = new Set([toPosix(filePath)]);
  if (!isAbsolute(filePath)) return [...paths];
  const roots = new Set([process.cwd()]);
  const targets = new Set([filePath]);
  try { roots.add(realpathSync(process.cwd())); } catch { /* cwd gone: the given path still counts */ }
  try { targets.add(realpathSync(filePath)); } catch { /* not on disk: an embedder scanning a buffer */ }
  for (const root of roots) {
    for (const target of targets) {
      const rel = relative(root, target);
      if (rel && !rel.startsWith("..") && !isAbsolute(rel)) paths.add(toPosix(rel));
    }
  }
  return [...paths];
}

// Exported for the CLI, which reports a skipped prose file as skipped rather than clean:
// a "clean" line claims the file was read.
export function proseScopeFor(filePath, opts = {}) {
  const prose = PROSE_EXTENSIONS.has(extname(filePath).toLowerCase());
  const config = loadProjectConfig();
  const scope = resolveProseScope(opts, config);
  if (!prose || scope === "all") return { scope, prose, inScope: true };
  const globs = Array.isArray(config.userFacingProse) ? config.userFacingProse : [];
  const paths = candidatePaths(filePath);
  const inScope = globs.some((glob) => {
    const re = globToRegExp(toPosix(glob));
    return paths.some((p) => re.test(p));
  });
  return { scope, prose, inScope };
}

// ── Scanner ──
// opts.proseScope ("user-facing" | "all", default per proseScopeFor): under "user-facing"
// a prose file the project has not opted in returns no findings at all, suppressed
// entries included, so nothing is scored or recorded for it.
// opts.collectSuppressed (default false): when true, additionally appends entries for
// findings that a deliberate suppression choice hid -- an escape-hatched line or an
// allowedWords config entry -- flagged { suppressed: true, suppressedBy }. Default-off
// behavior is byte-identical to calling scanContent(content, filePath) with no opts.
// opts.warnings (an array): receives { file, line, unknown } for each scoped waiver that names
// a rule id no rule has, which therefore suppresses nothing.
// opts.designSystem: the file's DESIGN.md as design-detect readDesignSystem() returns it, or
// null. The CLI and the corpus harness resolve it per file; an embedder may pass its own.
export function scanContent(content, filePath, opts = {}) {
  const violations = [];
  // Binary read as UTF-8 (a PNG, a font, an archive) decodes to replacement characters and
  // stray code points that satisfy Unicode property escapes; text never carries a NUL byte
  // and binary carries one within its first few bytes. No rule applies to it.
  if (content.includes("\u0000")) return violations;
  const ext = extname(filePath).toLowerCase();
  const isProse = PROSE_EXTENSIONS.has(ext);
  if (isProse && !proseScopeFor(filePath, opts).inScope) return violations;
  // Markup-with-script surfaces (.html/.htm/.vue/.svelte/.astro) are code surfaces too:
  // their <script> blocks are the most common home for the very defects the code table
  // exists to catch, and <img> -- the whole target syntax of img-no-dimensions -- lives
  // there and nowhere else.
  const isCode = CODE_SURFACE_EXTENSIONS.has(ext);
  // Design tells run on web surfaces only and native tells on Apple surfaces only. Before
  // this split every code extension got the web table, so a .swift or .py file was being
  // matched against Tailwind class names -- harmless while no rule happened to collide,
  // and a guaranteed false positive as soon as one did.
  const isStyle = WEB_SURFACE_EXTENSIONS.has(ext);
  const isNative = NATIVE_UI_EXTENSIONS.has(ext);
  // Test/fixture files carry fake creds, example.com, and innerHTML scaffolding -- skip the
  // security / dummy-data patterns there so real findings are not drowned in test noise.
  const isTestFile = /\.(test|spec)\.[mc]?[jt]sx?$|(^|\/)(__tests__|__mocks__|fixtures|e2e)\/|\.stories\.[mc]?[jt]sx?$/i.test(filePath);
  const config = loadProjectConfig();
  const allowedWords = new Set((config.allowedWords || []).map(w => w.toLowerCase()));
  const contentLower = content.toLowerCase();

  // Prose scans the author's own text with noise stripped; code scans comment lines.
  const proseScan = isProse ? stripProseNoise(content) : null;

  // ── Banned words ──
  if (isProse || isCode) {
    const textToScan = isProse ? proseScan : extractComments(content);
    for (const word of BANNED_WORDS) {
      const lw = word.toLowerCase();
      if (allowedWords.has(lw)) continue;
      if (hasContextException(lw, contentLower)) continue;
      const matches = textToScan.match(BANNED_WORD_REGEXES.get(word));
      if (!matches) continue;
      const count = matches.length;
      // Concentration rule: a lone low-confidence word is the writer's own prose, not a tell.
      const lowConf = LOW_CONFIDENCE_WORDS.has(lw);
      if (lowConf && count < 2) continue;
      violations.push({
        type: "banned-word",
        word,
        count,
        line: firstMatchLine(textToScan, BANNED_WORD_REGEXES.get(word)),
        severity: lowConf ? "low" : "medium",
        confidence: BANNED_WORD_CONFIDENCE,
        fix: BANNED_WORD_FIX,
        desc: `Banned AI-tell word "${word}" found ${count}x`,
      });
    }
  }

  // ── Banned phrases ──
  // Code scans the WHOLE file, not just comments: assistant boilerplate leaks into UI copy
  // strings and identifiers as readily as into comments, and an assistant-voice greeting left
  // in a copy constant ships to a user. Escape-hatched lines are removed on both surfaces --
  // routing code through the raw content was the one rule family the hatch did not reach.
  if (isProse || isCode) {
    const hay = isProse ? proseScan : stripEscapeHatchLines(content);
    for (const phrase of BANNED_PHRASES) {
      const found = phraseMatches(hay, phrase);
      if (!found) continue;
      const { count, line: lineNum } = found;
      violations.push({
        type: "banned-phrase",
        phrase,
        line: lineNum,
        count,
        severity: "medium",
        confidence: BANNED_PHRASE_CONFIDENCE,
        fix: BANNED_PHRASE_FIX,
        desc: `Banned phrase "${phrase}" found ${count}x (first at line ${lineNum})`,
      });
    }
  }

  // ── Text constructs + em-dash density (prose only) ──
  if (isProse) {
    for (const pat of TEXT_CONSTRUCTS) {
      const matches = proseScan.match(globalize(pat.pattern));
      const count = matches ? matches.length : 0;
      // The concentration gate applies here too. Every construct shipped before 2.1.0
      // declares no mode, for which meetsThreshold is exactly the old `if (matches)`;
      // a construct that only reads as a tell in bulk (plain-aiism-collocation) needs it.
      if (meetsThreshold(pat, count)) {
        violations.push({
          type: "text-construct",
          name: pat.name,
          count,
          line: firstMatchLine(proseScan, pat.pattern),
          severity: pat.severity,
          confidence: pat.confidence,
          fix: pat.fix,
          desc: `${pat.desc} (${count}x)`,
        });
      }
    }
    // A dash alone in a table cell is the table's "none", not a sentence's em dash.
    const dashText = proseScan.split("\n").map((l) => (/^\s*\|/.test(l) ? l.replace(/\|\s*[\u2014\u2013]\s*(?=\||$)/g, "| ") : l)).join("\n");
    const emdashes = (dashText.match(/—/g) || []).length;
    const words = (proseScan.match(/\S+/g) || []).length || 1;
    const density = (emdashes / words) * 1000;
    if (emdashes >= EMDASH_MIN_COUNT && density >= EMDASH_MIN_DENSITY) {
      violations.push({
        type: "text-construct",
        name: "em-dash-density",
        count: emdashes,
        line: firstMatchLine(dashText, /—/g),
        severity: density >= EMDASH_MIN_DENSITY * 2 ? "medium" : "low",
        confidence: EMDASH_CONFIDENCE,
        fix: EMDASH_FIX,
        desc: `High em dash density (${emdashes} dashes, ${density.toFixed(1)}/1k words) -- the #1 AI writing tell`,
      });
    }
  }

  // ── Emoji (skips escape-hatch lines so an intentional CLI glyph can opt out) ──
  // The file-scope guard is scoped to PROSE: a document that names emoji is documenting
  // the tell (this plugin's own writing-patterns.md reference failed its own scanner over
  // exactly that), whereas a `.emoji` CSS class or an EMOJI_MAP constant is a source file
  // naming a symbol while shipping the glyphs. Code and markup opt out per line instead.
  // Data and config files (.json, .yml, .toml, .csv, .lock, .svg, .xml) are not a surface a
  // reader meets the glyph on, and every other family already stays off them.
  const emojiSurface = isProse || isCode || isStyle || isNative;
  const emojiSilenced = !emojiSurface || (isProse && !fileGuardOk(EMOJI_FILE_GUARD, content));
  const emojiHaystack = emojiSilenced ? null : stripEscapeHatchLines(content);
  const emojiMatches = emojiHaystack === null ? null : emojiHaystack.match(EMOJI_REGEX);
  if (emojiMatches) {
    violations.push({
      type: "emoji",
      count: emojiMatches.length,
      line: firstMatchLine(emojiHaystack, EMOJI_REGEX),
      severity: emojiMatches.length > EMOJI_ESCALATE_COUNT ? "medium" : "low",
      confidence: EMOJI_CONFIDENCE,
      fix: EMOJI_FIX,
      desc: `${emojiMatches.length} emoji found in ${filePath}`,
    });
  }

  // ── Design + code patterns (per-line or per-file, with suppress + escape hatch) ──
  const sources = ruleSources(content, ext, opts.designSystem || null);
  const codeSource = (pat) => (pat.blankComments ? sources.blanked : sources.raw);
  if (isStyle) {
    for (const pat of DESIGN_PATTERNS) {
      if (!fileGuardOk(pat, sources.blanked.text)) continue;
      const { count, line, lines: hitLines, evidence } = countLinePattern(sources.blanked, pat);
      if (meetsThreshold(pat, count)) {
        violations.push({
          type: "design-tell",
          name: pat.name,
          count,
          line,
          lines: hitLines,
          evidence,
          severity: resolveSeverity(pat.severity, count),
          confidence: pat.confidence,
          mode: pat.mode,
          fix: pat.fix,
          desc: `${pat.desc} (${count}x)`,
        });
      }
    }
  }
  if (isNative) {
    for (const pat of NATIVE_PATTERNS) {
      if (!fileGuardOk(pat, sources.blanked.text)) continue;
      const { count, line, lines: hitLines, evidence } = countLinePattern(sources.blanked, pat);
      if (meetsThreshold(pat, count)) {
        violations.push({
          type: "native-tell",
          name: pat.name,
          count,
          line,
          lines: hitLines,
          evidence,
          severity: resolveSeverity(pat.severity, count),
          confidence: pat.confidence,
          mode: pat.mode,
          fix: pat.fix,
          desc: `${pat.desc} (${count}x)`,
        });
      }
    }
  }
  if (isCode) {
    for (const pat of CODE_PATTERNS) {
      if (isTestFile && pat.skipInTests) continue;
      if (!fileGuardOk(pat, codeSource(pat).text)) continue;
      const { count, line, lines: hitLines } = countLinePattern(codeSource(pat), pat);
      // Same gate as the design table: every code rule shipped before 2.1.0 declares no
      // mode and behaves exactly as the old `count > 0`, while `banner-comment` -- a Taste
      // note whose whole claim is "this file is divided by ASCII art" -- needs two.
      if (meetsThreshold(pat, count)) {
        violations.push({
          type: "code-pattern",
          name: pat.name,
          count,
          line,
          lines: hitLines,
          severity: resolveSeverity(pat.severity, count),
          confidence: pat.confidence,
          fix: pat.fix,
          desc: `${pat.desc} (${count}x)`,
        });
      }
    }
  }

  if (Array.isArray(opts.warnings) && (isStyle || isNative || isCode)) {
    for (const w of unknownWaivers(sources.raw.rawLines)) opts.warnings.push({ file: filePath, ...w });
  }

  if (opts.collectSuppressed) {
    violations.push(...collectSuppressedViolations({
      sources, isProse, isCode, isStyle, isTestFile, proseScan, allowedWords, contentLower, content,
    }));
  }

  return violations;
}

// ── Score calculation ──
export function calculateScore(violations) {
  let score = 50;
  for (const v of violations) {
    if (v.severity === "high") score -= 5;
    else if (v.severity === "medium") score -= 2;
    else score -= 1;
  }
  return Math.max(0, Math.min(50, score));
}

// ── Verdict ladder (source-aligned): a weighted-count tier for the scan summary. ──
// Uses the source scanners' additive weights (high=3, medium=2, low=1), which are
// distinct from the /50 score. For prose, pass the word count so a long, lightly
// flecked document is not over-escalated (the concentration guard).
export function verdict(violations, words = 0) {
  const W = { high: 3, medium: 2, low: 1 };
  let weighted = 0, high = 0, medium = 0;
  for (const v of violations) {
    weighted += W[v.severity] || 1;
    if (v.severity === "high") high++;
    else if (v.severity === "medium") medium++;
  }
  if (weighted === 0) return "CLEAN";
  if (high === 0 && medium === 0) return "MINOR";
  if (high >= 3 || weighted >= 15) return "STRONG";
  if (high >= 1) return "SOME";
  const density = words > 0 ? (weighted / words) * 1000 : 0;
  if (weighted >= 6 && !(words >= 600 && density < 2.0)) return "SOME";
  return "MINOR";
}
