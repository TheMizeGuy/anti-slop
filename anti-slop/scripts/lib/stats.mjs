// ── Pure aggregation over scan-log entries (see store.mjs loadLog/saveLog) into ──
// per-rule stats: how many times each rule fired live (active) vs. was deliberately
// suppressed (escape hatch / allowedWords, see scan.mjs opts.collectSuppressed). No
// I/O here -- callers pass in whatever log entries they already loaded. Consumed by
// the dashboard and, post-merge, a get_rule_stats MCP tool.

const SEVERITY_RANK = { high: 3, medium: 2, low: 1 };

// Same rule-key convention the dashboard already uses: the first identifying field
// a violation carries, in this priority order.
function ruleKey(entry) {
  return entry.name || entry.word || entry.phrase || entry.type || "unknown";
}

function worseSeverity(a, b) {
  return (SEVERITY_RANK[b] || 0) > (SEVERITY_RANK[a] || 0) ? b : a;
}

export function computeRuleStats(logEntries) {
  const byRule = new Map();
  let totalActive = 0;
  let totalSuppressed = 0;

  for (const entry of logEntries) {
    const key = ruleKey(entry);
    let stats = byRule.get(key);
    if (!stats) {
      stats = { rule: key, active: 0, suppressed: 0, worstSeverity: null, lastSeen: null };
      byRule.set(key, stats);
    }

    if (entry.suppressed === true) {
      stats.suppressed += 1;
      totalSuppressed += 1;
    } else {
      stats.active += 1;
      totalActive += 1;
    }

    const sev = entry.severity || "low";
    stats.worstSeverity = stats.worstSeverity === null ? sev : worseSeverity(stats.worstSeverity, sev);

    const ts = entry.timestamp;
    if (ts && (stats.lastSeen === null || new Date(ts).getTime() > new Date(stats.lastSeen).getTime())) {
      stats.lastSeen = ts;
    }
  }

  const rules = Array.from(byRule.values())
    .sort((a, b) => (b.active + b.suppressed) - (a.active + a.suppressed));

  return { rules, totals: { active: totalActive, suppressed: totalSuppressed } };
}
