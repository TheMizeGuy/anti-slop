import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { readFileSync } from "fs";
import { pathToFileURL } from "url";

export {
  BANNED_WORDS,
  LOW_CONFIDENCE_WORDS,
  BANNED_PHRASES,
  DESIGN_PATTERNS,
  CODE_PATTERNS,
  TEXT_CONSTRUCTS,
} from "./lib/rules.mjs";

import { scanContent, calculateScore, verdict } from "./lib/scan.mjs";
export { scanContent, calculateScore, verdict };

import { loadLog, saveLog, loadScores, saveScore } from "./lib/store.mjs";
import { ensureDashboard, filterAllowedViolations } from "./lib/dashboard.mjs";
import { computeRuleStats } from "./lib/stats.mjs";
import { runCli } from "./lib/cli.mjs";

// ── MCP Server ──
const mcpServer = new Server(
  { name: "anti-slop-scanner", version: "1.6.0" },
  { capabilities: { tools: {} } }
);

mcpServer.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "scan_file",
      description: "Scan a file for anti-slop violations (banned words, phrases, emoji, design tells, code patterns, security issues). Returns only violations found. Empty result means clean.",
      inputSchema: {
        type: "object",
        properties: {
          file_path: { type: "string", description: "Path to the file to scan" },
          content: { type: "string", description: "File content to scan (if file_path not accessible)" },
        },
        required: [],
      },
    },
    {
      name: "get_dashboard_url",
      description: "Get the URL of the anti-slop web dashboard for this project. Starts the dashboard on demand on first call (later calls reuse it); disable entirely via .anti-slop/config.json { \"dashboard\": false }.",
      inputSchema: { type: "object", properties: {} },
    },
    {
      name: "get_score_history",
      description: "Get the scan score history for this project.",
      inputSchema: { type: "object", properties: {} },
    },
    {
      name: "get_rule_stats",
      description: "Get per-rule statistics for this project: how many times each rule has fired live (active) versus been deliberately suppressed (escape hatch or an allowedWords config entry), worst severity seen, and when it last fired. Use this to see which AI-tell patterns show up most often in this codebase.",
      inputSchema: { type: "object", properties: {} },
    },
  ],
}));

mcpServer.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (name === "scan_file") {
    let content = args.content || "";
    let filePath = args.file_path || "unknown";

    if (!content && args.file_path) {
      try { content = readFileSync(args.file_path, "utf8"); }
      catch { return { content: [{ type: "text", text: `Cannot read file: ${args.file_path}` }] }; }
    }

    if (!content) {
      return { content: [{ type: "text", text: "No content to scan." }] };
    }

    // Suppressed entries (escape hatch / allowedWords) are logged for rule stats but
    // never reach the report text or the score.
    const allEntries = scanContent(content, filePath, { collectSuppressed: true });
    const activeViolations = allEntries.filter(v => !v.suppressed);
    const score = calculateScore(activeViolations);

    if (allEntries.length > 0) {
      const log = loadLog();
      for (const v of allEntries) {
        log.push({ ...v, file: filePath, timestamp: new Date().toISOString() });
      }
      saveLog(log);
    }

    saveScore({ score, file: filePath, violations: activeViolations.length });

    if (activeViolations.length === 0) {
      return { content: [{ type: "text", text: "" }] };
    }

    const ext = (filePath.match(/\.[^./\\]+$/) || [""])[0].toLowerCase();
    const isProseFile = [".md", ".mdx", ".txt", ".rst"].includes(ext);
    const tier = verdict(activeViolations, isProseFile ? (content.match(/\S+/g) || []).length : 0);
    const report = activeViolations.map(v => `[${v.severity.toUpperCase()}] ${v.desc}`).join("\n");
    return {
      content: [{
        type: "text",
        text: `Scan score: ${score}/50 | ${tier} | ${activeViolations.length} violation(s) in ${filePath.split("/").pop().split("\\").pop()}\n\n${report}`,
      }],
    };
  }

  if (name === "get_dashboard_url") {
    const result = await ensureDashboard();
    if (result.disabled) {
      return { content: [{ type: "text", text: 'Dashboard is disabled by .anti-slop/config.json ("dashboard": false).' }] };
    }
    if (!result.port) {
      return { content: [{ type: "text", text: "Dashboard could not be started (no available port)." }] };
    }
    return { content: [{ type: "text", text: `Dashboard: http://127.0.0.1:${result.port}` }] };
  }

  if (name === "get_score_history") {
    const scores = loadScores();
    if (!scores.length) return { content: [{ type: "text", text: "No scores recorded yet." }] };
    const recent = scores.slice(-10);
    const text = recent.map(s =>
      `${new Date(s.timestamp).toLocaleString()} | Scan score: ${s.score}/50 | ${s.violations} violations | ${s.file || "scan"}`
    ).join("\n");
    return { content: [{ type: "text", text: `Last ${recent.length} scans:\n${text}` }] };
  }

  if (name === "get_rule_stats") {
    // Same stale-entry filter the dashboard applies, so both surfaces agree on "active".
    const { rules, totals } = computeRuleStats(filterAllowedViolations(loadLog()));
    if (!rules.length) return { content: [{ type: "text", text: "No findings recorded yet." }] };
    const lines = rules.map(r =>
      `${r.rule}: ${r.active} active, ${r.suppressed} suppressed, worst=${r.worstSeverity}, last=${r.lastSeen === null ? "unknown" : new Date(r.lastSeen).toLocaleString()}`
    );
    return { content: [{ type: "text", text: `${totals.active} active / ${totals.suppressed} suppressed across ${rules.length} rules\n\n${lines.join("\n")}` }] };
  }

  return { content: [{ type: "text", text: `Unknown tool: ${name}` }] };
});

// ── Start ──
async function main() {
  const transport = new StdioServerTransport();
  await mcpServer.connect(transport);
}

// Only start the server when run directly; importing the module (for tests) must not.
// With subcommand args present ("scan ..."), dispatch to the CI-facing CLI instead of
// starting the MCP stdio server; zero args keeps the MCP-server behavior unchanged.
const invokedDirectly = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedDirectly) {
  const argv = process.argv.slice(2);
  if (argv.length > 0) {
    const exitCode = await runCli(argv);
    process.exit(exitCode);
  } else {
    main();
  }
}
