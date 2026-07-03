import { extname } from "path";
import { loadProjectConfig } from "./store.mjs";
import {
  BANNED_WORDS,
  BANNED_WORD_REGEXES,
  LOW_CONFIDENCE_WORDS,
  BANNED_PHRASES,
  DESIGN_PATTERNS,
  CODE_PATTERNS,
  TEXT_CONSTRUCTS,
  CONTEXT_EXCEPTIONS,
  ESCAPE_HATCH,
  EMDASH_MIN_COUNT,
  EMDASH_MIN_DENSITY,
  EMOJI_REGEX,
  PROSE_EXTENSIONS,
  CODE_EXTENSIONS,
  STYLE_EXTENSIONS,
} from "./rules.mjs";

// ── Prose noise-stripping: keep only the author's own prose. Blanks fenced code,
// inline code, double-quoted spans, blockquotes, YAML frontmatter, and any line
// carrying the escape-hatch marker. Line count is preserved so line numbers hold. ──
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
    line = line.replace(/`[^`]*`/g, " ").replace(/"[^"\n]*"/g, " ");
    out.push(line);
  }
  return out.join("\n");
}

// ── Comment lines only (for scanning code files for prose-style tells) ──
function extractComments(content) {
  return content.split("\n")
    .filter(l => /^\s*(\/\/|#|\*|\/\*|<!--|--)/.test(l) && !ESCAPE_HATCH.test(l))
    .join("\n");
}

// ── Blank any line carrying the escape-hatch marker (preserves line count) ──
function stripEscapeHatchLines(content) {
  return content.split("\n").map(l => (ESCAPE_HATCH.test(l) ? "" : l)).join("\n");
}

function globalize(re) {
  return re.flags.includes("g") ? re : new RegExp(re.source, re.flags + "g");
}

function resolveSeverity(sev, count) {
  return typeof sev === "function" ? sev(count) : sev;
}

// ── Count regex matches per non-suppressed, non-escaped line ──
function countLinePattern(lines, pat) {
  const g = globalize(pat.pattern);
  let count = 0;
  for (const line of lines) {
    if (ESCAPE_HATCH.test(line)) continue;
    if (pat.suppress && pat.suppress.test(line)) continue;
    const m = line.match(g);
    if (m) count += m.length;
  }
  return count;
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
    line = line.replace(/`[^`]*`/g, " ").replace(/"[^"\n]*"/g, " ");
    out.push(line);
  }
  return out.join("\n");
}

// Mirror of extractComments that selects only the escape-hatched comment lines.
function extractEscapeHatchedComments(content) {
  return content.split("\n")
    .filter(l => /^\s*(\/\/|#|\*|\/\*|<!--|--)/.test(l) && ESCAPE_HATCH.test(l))
    .join("\n");
}

// Mirror of countLinePattern that counts only escape-hatched lines. A suppress-regex
// guard still applies: if it matches, the rule would not have fired even without the
// escape hatch, so that hit is a rule-internal exclusion, not a suppressed finding.
function countLinePatternOnEscapedLines(lines, pat) {
  const g = globalize(pat.pattern);
  let count = 0;
  for (const line of lines) {
    if (!ESCAPE_HATCH.test(line)) continue;
    if (pat.suppress && pat.suppress.test(line)) continue;
    const m = line.match(g);
    if (m) count += m.length;
  }
  return count;
}

// Additive-only: computes what WOULD have fired for two deliberate-suppression paths
// -- (a) escape-hatched lines, (b) an allowedWords config entry -- so the dashboard can
// show suppressed activity without ever touching the active `violations` array above it.
// Scope is the four rule families keyed by a stable violation `type`: banned-word,
// banned-phrase, design-tell, code-pattern. text-construct and emoji are deferred:
// their per-line escape semantics differ (density/whole-document rules), so counting
// a hatched line as one suppressed construct would misstate what was avoided.
function collectSuppressedViolations({ content, lines, isProse, isCode, isStyle, isTestFile, proseScan, allowedWords, contentLower }) {
  const suppressed = [];

  // (a) escape-hatch: words/phrases/design/code hits confined to escape-hatched lines.
  if (isProse || isCode) {
    const hatchedText = isProse ? extractEscapeHatchedProse(content) : extractEscapeHatchedComments(content);
    for (const word of BANNED_WORDS) {
      const lw = word.toLowerCase();
      // Allowed words are counted under (b) against the active text; a hatched-only
      // occurrence of an allowed word is deliberately counted nowhere (double-suppressed).
      if (allowedWords.has(lw)) continue;
      const exceptions = CONTEXT_EXCEPTIONS[lw];
      if (exceptions && exceptions.some(e => contentLower.includes(e))) continue;
      const matches = hatchedText.match(BANNED_WORD_REGEXES.get(word));
      if (!matches) continue;
      const count = matches.length;
      const lowConf = LOW_CONFIDENCE_WORDS.has(lw);
      if (lowConf && count < 2) continue;
      suppressed.push({
        type: "banned-word", word, count,
        severity: lowConf ? "low" : "medium",
        desc: `Banned AI-tell word "${word}" found ${count}x`,
        suppressed: true, suppressedBy: "escape-hatch",
      });
    }
  }

  if (isProse) {
    const hatchedHay = extractEscapeHatchedProse(content).toLowerCase();
    for (const phrase of BANNED_PHRASES) {
      if (!phrase) continue;
      const firstIdx = hatchedHay.indexOf(phrase);
      if (firstIdx === -1) continue;
      let count = 0;
      let searchFrom = 0;
      let idx;
      while ((idx = hatchedHay.indexOf(phrase, searchFrom)) !== -1) {
        count++;
        searchFrom = idx + phrase.length;
      }
      const lineNum = hatchedHay.substring(0, firstIdx).split("\n").length;
      suppressed.push({
        type: "banned-phrase", phrase, line: lineNum, count,
        severity: "medium",
        desc: `Banned phrase "${phrase}" found ${count}x (first at line ${lineNum})`,
        suppressed: true, suppressedBy: "escape-hatch",
      });
    }
  }

  if (isStyle) {
    for (const pat of DESIGN_PATTERNS) {
      const count = countLinePatternOnEscapedLines(lines, pat);
      if (count > 0) {
        suppressed.push({
          type: "design-tell", name: pat.name, count,
          severity: resolveSeverity(pat.severity, count),
          desc: `${pat.desc} (${count}x)`,
          suppressed: true, suppressedBy: "escape-hatch",
        });
      }
    }
  }

  if (isCode) {
    for (const pat of CODE_PATTERNS) {
      if (isTestFile && pat.skipInTests) continue;
      const count = countLinePatternOnEscapedLines(lines, pat);
      if (count > 0) {
        suppressed.push({
          type: "code-pattern", name: pat.name, count,
          severity: resolveSeverity(pat.severity, count),
          desc: `${pat.desc} (${count}x)`,
          suppressed: true, suppressedBy: "escape-hatch",
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
      const exceptions = CONTEXT_EXCEPTIONS[lw];
      if (exceptions && exceptions.some(e => contentLower.includes(e))) continue;
      const matches = textToScan.match(BANNED_WORD_REGEXES.get(word));
      if (!matches) continue;
      const count = matches.length;
      const lowConf = LOW_CONFIDENCE_WORDS.has(lw);
      if (lowConf && count < 2) continue;
      suppressed.push({
        type: "banned-word", word, count,
        severity: lowConf ? "low" : "medium",
        desc: `Banned AI-tell word "${word}" found ${count}x`,
        suppressed: true, suppressedBy: "allowed-words",
      });
    }
  }

  return suppressed;
}

// ── Scanner ──
// opts.collectSuppressed (default false): when true, additionally appends entries for
// findings that a deliberate suppression choice hid -- an escape-hatched line or an
// allowedWords config entry -- flagged { suppressed: true, suppressedBy }. Default-off
// behavior is byte-identical to calling scanContent(content, filePath) with no opts.
export function scanContent(content, filePath, opts = {}) {
  const violations = [];
  const ext = extname(filePath).toLowerCase();
  const isProse = PROSE_EXTENSIONS.has(ext);
  const isCode = CODE_EXTENSIONS.has(ext);
  const isStyle = STYLE_EXTENSIONS.has(ext) || isCode;
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
      const exceptions = CONTEXT_EXCEPTIONS[lw];
      if (exceptions && exceptions.some(e => contentLower.includes(e))) continue;
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
        severity: lowConf ? "low" : "medium",
        desc: `Banned AI-tell word "${word}" found ${count}x`,
      });
    }
  }

  // ── Banned phrases ──
  if (isProse || isCode) {
    const hay = (isProse ? proseScan : content).toLowerCase();
    for (const phrase of BANNED_PHRASES) {
      if (!phrase) continue; // indexOf("") returns 0, which would loop forever below
      const firstIdx = hay.indexOf(phrase);
      if (firstIdx === -1) continue;
      let count = 0;
      let searchFrom = 0;
      let idx;
      while ((idx = hay.indexOf(phrase, searchFrom)) !== -1) {
        count++;
        searchFrom = idx + phrase.length;
      }
      const lineNum = hay.substring(0, firstIdx).split("\n").length;
      violations.push({
        type: "banned-phrase",
        phrase,
        line: lineNum,
        count,
        severity: "medium",
        desc: `Banned phrase "${phrase}" found ${count}x (first at line ${lineNum})`,
      });
    }
  }

  // ── Text constructs + em-dash density (prose only) ──
  if (isProse) {
    for (const pat of TEXT_CONSTRUCTS) {
      const matches = proseScan.match(globalize(pat.pattern));
      if (matches) {
        violations.push({
          type: "text-construct",
          name: pat.name,
          count: matches.length,
          severity: pat.severity,
          desc: `${pat.desc} (${matches.length}x)`,
        });
      }
    }
    const emdashes = (proseScan.match(/—/g) || []).length;
    const words = (proseScan.match(/\S+/g) || []).length || 1;
    const density = (emdashes / words) * 1000;
    if (emdashes >= EMDASH_MIN_COUNT && density >= EMDASH_MIN_DENSITY) {
      violations.push({
        type: "text-construct",
        name: "em-dash-density",
        count: emdashes,
        severity: density >= EMDASH_MIN_DENSITY * 2 ? "medium" : "low",
        desc: `High em dash density (${emdashes} dashes, ${density.toFixed(1)}/1k words) -- the #1 AI writing tell`,
      });
    }
  }

  // ── Emoji (skips escape-hatch lines so an intentional CLI glyph can opt out) ──
  const emojiMatches = stripEscapeHatchLines(content).match(EMOJI_REGEX);
  if (emojiMatches) {
    violations.push({
      type: "emoji",
      count: emojiMatches.length,
      severity: "low",
      desc: `${emojiMatches.length} emoji found in ${filePath}`,
    });
  }

  // ── Design + code patterns (per-line, with suppress + escape hatch) ──
  const lines = content.split("\n");
  if (isStyle) {
    for (const pat of DESIGN_PATTERNS) {
      const count = countLinePattern(lines, pat);
      if (count > 0) {
        violations.push({
          type: "design-tell",
          name: pat.name,
          count,
          severity: resolveSeverity(pat.severity, count),
          desc: `${pat.desc} (${count}x)`,
        });
      }
    }
  }
  if (isCode) {
    for (const pat of CODE_PATTERNS) {
      if (isTestFile && pat.skipInTests) continue;
      const count = countLinePattern(lines, pat);
      if (count > 0) {
        violations.push({
          type: "code-pattern",
          name: pat.name,
          count,
          severity: resolveSeverity(pat.severity, count),
          desc: `${pat.desc} (${count}x)`,
        });
      }
    }
  }

  if (opts.collectSuppressed) {
    violations.push(...collectSuppressedViolations({
      content, lines, isProse, isCode, isStyle, isTestFile, proseScan, allowedWords, contentLower,
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
