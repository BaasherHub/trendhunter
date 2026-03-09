import fs from "fs";
import path from "path";

const LOG_FILE = process.env.LAUNCH_HISTORY_FILE || "./launches.json";

/**
 * Load launch history from file
 */
export function loadHistory() {
  if (!fs.existsSync(LOG_FILE)) return [];
  try {
    return JSON.parse(fs.readFileSync(LOG_FILE, "utf8"));
  } catch {
    return [];
  }
}

/**
 * Save a launch record to history
 */
export function savelaunch(record) {
  const history = loadHistory();
  history.unshift(record); // newest first
  fs.writeFileSync(LOG_FILE, JSON.stringify(history, null, 2));
  console.log(`📝 Launch saved to history (total: ${history.length})`);
}

/**
 * Print a summary of all launches and earnings
 */
export function printSummary(history) {
  if (history.length === 0) {
    console.log("No launches yet.");
    return;
  }

  console.log(`\n📊 LAUNCH HISTORY (${history.length} total)\n`);
  console.log("─".repeat(60));

  history.slice(0, 10).forEach((launch, i) => {
    const date = new Date(launch.timestamp).toLocaleDateString();
    const status = launch.success ? "✅" : "❌";
    console.log(`${status} [${date}] $${launch.symbol} — ${launch.name}`);
    if (launch.pumpUrl) console.log(`   🔗 ${launch.pumpUrl}`);
    if (launch.trend) console.log(`   📈 Trend: ${launch.trend}`);
    if (i < history.length - 1) console.log("");
  });

  console.log("─".repeat(60));
}
