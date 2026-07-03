// ── CI-facing scan CLI ──
// `node slop-scanner.mjs scan [options] <file...>` -- a deterministic, side-effect-free
// (by default) way to run the scanner outside the MCP protocol, for CI gates and
// pre-commit hooks. Files only: no glob or directory recursion, so callers compose
// with their own shell tools, e.g. `git diff --name-only | xargs node .../slop-scanner.mjs scan`.

import { readFileSync } from "fs";
import { scanContent, calculateScore, verdict } from "./scan.mjs";
import { loadLog, saveLog, saveScore } from "./store.mjs";

const PROSE_EXTENSIONS_FOR_VERDICT = new Set([".md", ".mdx", ".txt", ".rst"]);
const FAIL_ON_LEVELS = ["any", "high", "medium", "low", "none"];
const SEVERITY_RANK = { high: 3, medium: 2, low: 1 };

const USAGE = `Usage: slop-scanner.mjs scan [options] <file...>

Scans one or more files with the anti-slop deterministic scanner. Files only --
no glob or directory recursion; pipe a file list in, e.g.:

  git diff --name-only | xargs node .../slop-scanner.mjs scan

Options:
  --format text|json   Output format (default: text)
  --fail-on LEVEL      any|high|medium|low|none -- minimum severity that
                       triggers a nonzero exit (default: any)
  --record             Write findings to .anti-slop/scan-log.json and
                       scores.json, same as an MCP scan_file call
                       (default: no side effects)
  --quiet              Suppress all output; exit code only
  -h, --help           Show this message

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

// Mirrors the isProseFile/word-count logic scan_file uses so the CLI's verdict tier
// matches the MCP tool's for the same file.
function classifyVerdict(content, filePath, violations) {
  const ext = (filePath.match(/\.[^./\\]+$/) || [""])[0].toLowerCase();
  const isProseFile = PROSE_EXTENSIONS_FOR_VERDICT.has(ext);
  return verdict(violations, isProseFile ? (content.match(/\S+/g) || []).length : 0);
}

function meetsThreshold(violations, failOn) {
  if (failOn === "none") return false;
  if (failOn === "any") return violations.length > 0;
  const minRank = SEVERITY_RANK[failOn];
  return violations.some((v) => (SEVERITY_RANK[v.severity] || 0) >= minRank);
}

// Writes exactly what an MCP scan_file call would write, so --record output is
// indistinguishable from data produced through the MCP tool.
function recordScan(filePath, violations, score) {
  if (violations.length > 0) {
    const log = loadLog();
    for (const v of violations) {
      log.push({ ...v, file: filePath, timestamp: new Date().toISOString() });
    }
    saveLog(log);
  }
  saveScore({ score, file: filePath, violations: violations.length });
}

function formatTextReport(result) {
  if (result.violations.length === 0) {
    return `${result.file}: clean\n`;
  }
  const report = result.violations.map((v) => `[${v.severity.toUpperCase()}] ${v.desc}`).join("\n");
  return `${result.file}\nScan score: ${result.score}/50 | ${result.verdict} | ${result.violations.length} violation(s)\n\n${report}\n\n`;
}

export async function runCli(argv) {
  if (argv[0] !== "scan") {
    process.stderr.write(`Unknown command: ${argv[0] ?? "(none)"}\n\n${USAGE}`);
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

  const results = [];
  for (const filePath of opts.files) {
    let content;
    try {
      content = readFileSync(filePath, "utf8");
    } catch {
      process.stderr.write(`Cannot read file: ${filePath}\n\n${USAGE}`);
      return 2;
    }
    const violations = scanContent(content, filePath);
    const score = calculateScore(violations);
    const tier = classifyVerdict(content, filePath, violations);
    if (opts.record) recordScan(filePath, violations, score);
    results.push({ file: filePath, score, verdict: tier, violations });
  }

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
    }
  }

  return shouldFail ? 1 : 0;
}
