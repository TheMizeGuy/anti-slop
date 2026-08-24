// ── The scanner CLI ──
// The plugin's only executable surface. `scan` is the deterministic, side-effect-free
// (by default) checker for CI gates and pre-commit hooks; `history`, `stats` and
// `dashboard` read back what `--record` wrote. Files only: no glob or directory
// recursion, so callers compose with their own shell tools, e.g.
// `git diff --name-only | xargs node .../slop-scanner.mjs scan`.

import { readFileSync } from "fs";
import { extname } from "path";
import { scanContent, calculateScore, verdict } from "./scan.mjs";
import { PROSE_EXTENSIONS } from "./rules.mjs";
import { loadLog, saveLog, saveScores, loadScores } from "./store.mjs";

const FAIL_ON_LEVELS = ["any", "high", "medium", "low", "none"];
const SEVERITY_RANK = { high: 3, medium: 2, low: 1 };

const USAGE = `Usage: slop-scanner.mjs <command> [options]

Commands:
  scan [options] <file...>   Scan files for anti-slop findings
  history                    Recent scan scores for this project
  stats                      Per-rule active vs suppressed counts
  dashboard                  Start the local dashboard and print its URL

Scan options:
  --format text|json   Output format (default: text)
  --fail-on LEVEL      any|high|medium|low|none -- minimum severity that
                       triggers a nonzero exit (default: any)
  --record             Write findings to .anti-slop/scan-log.json and
                       scores.json (default: no side effects). history and
                       stats read what this writes
  --quiet              Suppress all output; exit code only
  -h, --help           Show this message

Scans take files only -- no glob or directory recursion; pipe a file list in:

  git diff --name-only --diff-filter=d | xargs node .../slop-scanner.mjs scan

Exit codes:
  0  no findings at or above --fail-on threshold
  1  findings at or above threshold
  2  usage error or unreadable file
`;

class UsageError extends Error {}

function parseArgs(argv) {
  const opts = { format: "text", failOn: "any", record: false, quiet: false, help: false, files: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "-h" || a === "--help") {
      opts.help = true;
    } else if (a === "--format") {
      const v = argv[++i];
      if (v !== "text" && v !== "json") throw new UsageError(`--format must be "text" or "json" (got ${v ?? "nothing"})`);
      opts.format = v;
    } else if (a === "--fail-on") {
      const v = argv[++i];
      if (!FAIL_ON_LEVELS.includes(v)) throw new UsageError(`--fail-on must be one of ${FAIL_ON_LEVELS.join("|")} (got ${v ?? "nothing"})`);
      opts.failOn = v;
    } else if (a === "--record") {
      opts.record = true;
    } else if (a === "--quiet") {
      opts.quiet = true;
    } else if (a.startsWith("--")) {
      throw new UsageError(`Unknown option: ${a}`);
    } else {
      opts.files.push(a);
    }
  }
  return opts;
}

// Prose files are scored against their word count so a long, lightly flecked document is
// not over-escalated (the concentration guard in verdict()). PROSE_EXTENSIONS and extname
// come from the same places the scanner uses them: a second local copy of either meant
// adding an extension to rules.mjs silently gave it prose RULES but not prose verdict
// weighting.
export function classifyVerdict(content, filePath, violations) {
  const isProseFile = PROSE_EXTENSIONS.has(extname(filePath).toLowerCase());
  return verdict(violations, isProseFile ? (content.match(/\S+/g) || []).length : 0);
}

function meetsThreshold(violations, failOn) {
  if (failOn === "none") return false;
  if (failOn === "any") return violations.length > 0;
  const minRank = SEVERITY_RANK[failOn];
  return violations.some((v) => (SEVERITY_RANK[v.severity] || 0) >= minRank);
}

// ── --record, batched to one load/save cycle per INVOCATION ──
// Recording per file meant an N-file scan did 2N JSON parse+stringify+write round trips
// over the whole log, and -- because both retention caps count ENTRIES, not runs -- a
// CI-sized scan evicted its own rows and every earlier run's before it finished. The log
// still keeps one row per finding (cap 500, unchanged); scores now keep ONE row per
// invocation, which is what `history`'s "Last N scans" always claimed to show.
//
// The aggregate row reports the WORST file's score, so a single bad file in a large run
// cannot be averaged away, and the total active findings across the run.
function recordRun(results, allEntriesByFile) {
  const logRows = [];
  const timestamp = new Date().toISOString();
  for (const [filePath, entries] of allEntriesByFile) {
    for (const v of entries) logRows.push({ ...v, file: filePath, timestamp });
  }
  if (logRows.length > 0) saveLog([...loadLog(), ...logRows]);

  const worst = results.reduce((min, r) => Math.min(min, r.score), 50);
  const violations = results.reduce((n, r) => n + r.violations.length, 0);
  const file = results.length === 1 ? results[0].file : `${results.length} files`;
  saveScores([{ score: worst, file, violations }]);
}

function formatTextReport(result) {
  if (result.violations.length === 0) {
    return `${result.file}: clean\n`;
  }
  const report = result.violations.map((v) => `[${v.severity.toUpperCase()}] ${v.desc}`).join("\n");
  return `${result.file}\nScan score: ${result.score}/50 | ${result.verdict} | ${result.violations.length} violation(s)\n\n${report}\n\n`;
}

function formatTotalsLine(totals) {
  const { high, medium, low } = totals.bySeverity;
  return `Total: ${totals.violations} violation(s) across ${totals.files} files ` +
    `(${high} high, ${medium} medium, ${low} low)\n`;
}

// ── history: the scores `scan --record` wrote ──
function runHistory() {
  const scores = loadScores();
  if (!scores.length) {
    process.stdout.write("No scores recorded yet. Run `scan --record <file...>` first.\n");
    return 0;
  }
  const recent = scores.slice(-10);
  const lines = recent.map((s) =>
    `${new Date(s.timestamp).toLocaleString()} | Scan score: ${s.score}/50 | ${s.violations} violations | ${s.file || "scan"}`,
  );
  process.stdout.write(`Last ${recent.length} scans:\n${lines.join("\n")}\n`);
  return 0;
}

// ── stats: which rules actually fire in this codebase, and which get suppressed ──
// dashboard.mjs and stats.mjs are imported lazily so the scan path -- the one CI runs on
// every commit -- never loads the HTTP module at all.
async function runStats() {
  const [{ filterAllowedViolations }, { computeRuleStats }] = await Promise.all([
    import("./dashboard.mjs"),
    import("./stats.mjs"),
  ]);
  const { rules, totals } = computeRuleStats(filterAllowedViolations(loadLog()));
  if (!rules.length) {
    process.stdout.write("No findings recorded yet. Run `scan --record <file...>` first.\n");
    return 0;
  }
  const lines = rules.map((r) =>
    `${r.rule}: ${r.active} active, ${r.suppressed} suppressed, worst=${r.worstSeverity}, ` +
    `last=${r.lastSeen === null ? "unknown" : new Date(r.lastSeen).toLocaleString()}`,
  );
  process.stdout.write(
    `${totals.active} active / ${totals.suppressed} suppressed across ${rules.length} rules\n\n${lines.join("\n")}\n`,
  );
  return 0;
}

// ── dashboard: the ONLY command permitted to open a port ──
// The v1.5.0 invariant survives the MCP removal unchanged in spirit: nothing starts an
// HTTP listener except an explicit request for one, and the config switch still wins.
async function runDashboard() {
  const { ensureDashboard } = await import("./dashboard.mjs");
  const result = await ensureDashboard();
  if (result.disabled) {
    process.stdout.write('Dashboard is disabled by .anti-slop/config.json ("dashboard": false).\n');
    return 0;
  }
  if (!result.port) {
    process.stderr.write("Dashboard could not be started (no available port).\n");
    return 2;
  }
  process.stdout.write(`Dashboard: http://127.0.0.1:${result.port}\n`);
  return 0;
}

export async function runCli(argv) {
  const command = argv[0];

  if (command === "-h" || command === "--help") {
    process.stdout.write(USAGE);
    return 0;
  }
  // These three take no options. Dispatching before parseArgs used to mean
  // `history --format json` silently ran the default text output instead of erroring.
  if (command === "history" || command === "stats" || command === "dashboard") {
    if (argv.length > 1) {
      process.stderr.write(`${command} takes no arguments (got ${argv.slice(1).join(" ")})\n\n${USAGE}`);
      return 2;
    }
    if (command === "history") return runHistory();
    if (command === "stats") return runStats();
    return runDashboard();
  }

  if (command !== "scan") {
    process.stderr.write(`Unknown command: ${command ?? "(none)"}\n\n${USAGE}`);
    return 2;
  }

  let opts;
  try {
    opts = parseArgs(argv.slice(1));
  } catch (err) {
    if (!(err instanceof UsageError)) throw err;
    process.stderr.write(`${err.message}\n\n${USAGE}`);
    return 2;
  }

  if (opts.help) {
    process.stdout.write(USAGE);
    return 0;
  }

  if (opts.files.length === 0) {
    process.stderr.write(`No files given.\n\n${USAGE}`);
    return 2;
  }

  // `git diff --name-only` over a range can legitimately emit the same path twice, which
  // used to scan it twice, record it twice, and double-count it in the totals.
  opts.files = [...new Set(opts.files)];

  // Read everything up front so an unreadable file aborts BEFORE any scan is
  // recorded -- exit 2 must leave no partial --record side effects behind.
  const contents = new Map();
  for (const filePath of opts.files) {
    try {
      contents.set(filePath, readFileSync(filePath, "utf8"));
    } catch {
      process.stderr.write(`Cannot read file: ${filePath}\n\n${USAGE}`);
      return 2;
    }
  }

  const results = [];
  const allEntriesByFile = new Map();
  for (const filePath of opts.files) {
    const content = contents.get(filePath);
    // Suppressed entries (escape hatch / allowedWords) are logged under --record for rule
    // stats, but never reach output, score, or exit code.
    const allEntries = scanContent(content, filePath, { collectSuppressed: true });
    const violations = allEntries.filter((v) => !v.suppressed);
    const score = calculateScore(violations);
    const tier = classifyVerdict(content, filePath, violations);
    if (opts.record) allEntriesByFile.set(filePath, allEntries);
    results.push({ file: filePath, score, verdict: tier, violations });
  }
  if (opts.record) recordRun(results, allEntriesByFile);

  const totals = { files: results.length, violations: 0, bySeverity: { high: 0, medium: 0, low: 0 } };
  for (const r of results) {
    totals.violations += r.violations.length;
    for (const v of r.violations) {
      if (v.severity === "high") totals.bySeverity.high += 1;
      else if (v.severity === "medium") totals.bySeverity.medium += 1;
      else totals.bySeverity.low += 1;
    }
  }

  const shouldFail = results.some((r) => meetsThreshold(r.violations, opts.failOn));

  if (!opts.quiet) {
    if (opts.format === "json") {
      process.stdout.write(`${JSON.stringify({ files: results, totals })}\n`);
    } else {
      for (const r of results) process.stdout.write(formatTextReport(r));
      // The aggregate was computed and then thrown away in text mode, so a multi-file CI
      // run printed per-file reports and no total. One file needs no summary of itself.
      if (results.length > 1) process.stdout.write(formatTotalsLine(totals));
    }
  }

  return shouldFail ? 1 : 0;
}
