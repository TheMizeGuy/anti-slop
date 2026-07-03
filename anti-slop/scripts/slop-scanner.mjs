import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { readFileSync } from "fs";
import { dirname } from "path";
import { fileURLToPath, pathToFileURL } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

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

import { PROJECT_PATH, loadLog, saveLog, loadScores, saveScore, loadRegistry } from "./lib/store.mjs";
import { startDashboardIfNeeded, DASHBOARD_PORT } from "./lib/dashboard.mjs";

// ── MCP Server ──
const mcpServer = new Server(
  { name: "anti-slop-scanner", version: "1.4.1" },
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
      description: "Get the URL of the anti-slop web dashboard for this project.",
      inputSchema: { type: "object", properties: {} },
    },
    {
      name: "get_score_history",
      description: "Get the score history for this project.",
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

    const violations = scanContent(content, filePath);
    const score = calculateScore(violations);

    if (violations.length > 0) {
      const log = loadLog();
      for (const v of violations) {
        log.push({ ...v, file: filePath, timestamp: new Date().toISOString() });
      }
      saveLog(log);
    }

    saveScore({ score, file: filePath, violations: violations.length });

    if (violations.length === 0) {
      return { content: [{ type: "text", text: "" }] };
    }

    const ext = (filePath.match(/\.[^./\\]+$/) || [""])[0].toLowerCase();
    const isProseFile = [".md", ".mdx", ".txt", ".rst"].includes(ext);
    const tier = verdict(violations, isProseFile ? (content.match(/\S+/g) || []).length : 0);
    const report = violations.map(v => `[${v.severity.toUpperCase()}] ${v.desc}`).join("\n");
    return {
      content: [{
        type: "text",
        text: `Score: ${score}/50 | ${tier} | ${violations.length} violation(s) in ${filePath.split("/").pop().split("\\").pop()}\n\n${report}`,
      }],
    };
  }

  if (name === "get_dashboard_url") {
    const port = DASHBOARD_PORT || loadRegistry()[PROJECT_PATH]?.port;
    if (!port) return { content: [{ type: "text", text: "Dashboard not started." }] };
    return { content: [{ type: "text", text: `Dashboard: http://127.0.0.1:${port}` }] };
  }

  if (name === "get_score_history") {
    const scores = loadScores();
    if (!scores.length) return { content: [{ type: "text", text: "No scores recorded yet." }] };
    const recent = scores.slice(-10);
    const text = recent.map(s =>
      `${new Date(s.timestamp).toLocaleString()} | ${s.score}/50 | ${s.violations} violations | ${s.file || "scan"}`
    ).join("\n");
    return { content: [{ type: "text", text: `Last ${recent.length} scans:\n${text}` }] };
  }

  return { content: [{ type: "text", text: `Unknown tool: ${name}` }] };
});

// ── Start ──
async function main() {
  await startDashboardIfNeeded();
  const transport = new StdioServerTransport();
  await mcpServer.connect(transport);
}

// Only start the server when run directly; importing the module (for tests) must not.
const invokedDirectly = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedDirectly) {
  main();
}
