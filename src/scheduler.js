import fs from "fs";

const HISTORY_FILE = process.env.LAUNCH_HISTORY_FILE || "./launches.json";
const COOLDOWN_MS = 24 * 60 * 60 * 1000 + 60 * 1000; // 24 hours + 1 minute
const STARTUP_GRACE_MS = 5 * 60 * 1000; // 5 minutes — trigger immediately if due within this window

let pendingTimer = null;

/**
 * Get the timestamp of the last launch attempt (success or failure).
 * Reads from the persistent launch history file.
 */
export function getLastLaunchTime() {
  if (!fs.existsSync(HISTORY_FILE)) return null;
  try {
    const history = JSON.parse(fs.readFileSync(HISTORY_FILE, "utf8"));
    if (Array.isArray(history) && history.length > 0) {
      return new Date(history[0].timestamp);
    }
  } catch (err) {
    console.warn(`⚠️  Could not read launch history (${HISTORY_FILE}): ${err.message}`);
  }
  return null;
}

/**
 * Calculate when the next launch should run.
 * - If there is a prior launch: nextLaunch = lastLaunchTime + 24h + 1min
 * - If no prior launch: default to 16:01 UTC today, or tomorrow if already past
 */
export function getNextLaunchTime() {
  const last = getLastLaunchTime();
  if (last) {
    return new Date(last.getTime() + COOLDOWN_MS);
  }
  // No prior launch — use default schedule: 16:01 UTC (12:01 PM EST)
  const now = new Date();
  const defaultTime = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 16, 1, 0, 0)
  );
  if (defaultTime <= now) {
    defaultTime.setUTCDate(defaultTime.getUTCDate() + 1);
  }
  return defaultTime;
}

/**
 * Cancel any pending scheduled launch and schedule the next one.
 * After each launch completes (success or failure), this is called automatically
 * so the next launch is always exactly 24h+1min from the last attempt.
 */
export function scheduleNext(launchFn) {
  if (pendingTimer) {
    clearTimeout(pendingTimer);
    pendingTimer = null;
  }

  const nextTime = getNextLaunchTime();
  const delayMs = Math.max(0, nextTime.getTime() - Date.now());
  const delayMin = Math.round(delayMs / 60000);
  const delayHours = (delayMs / 3600000).toFixed(1);
  const delayLabel = delayMs === 0 ? "running immediately" : `in ${delayHours}h / ${delayMin} min`;

  console.log(`⏰ Next launch scheduled: ${nextTime.toISOString()} (${delayLabel})`);

  pendingTimer = setTimeout(async () => {
    pendingTimer = null;
    try {
      await launchFn();
    } catch (err) {
      console.error(`❌ Unhandled scheduler error: ${err.message}`);
    } finally {
      scheduleNext(launchFn);
    }
  }, delayMs);
}

/**
 * Start the dynamic scheduler.
 * On startup, if a launch is due within STARTUP_GRACE_MS (5 min) or is overdue,
 * it triggers immediately instead of waiting. Otherwise schedules normally.
 * Reads last launch time from the history file to survive process restarts.
 */
export function startScheduler(launchFn) {
  const nextTime = getNextLaunchTime();
  const delayMs = nextTime.getTime() - Date.now();

  if (delayMs <= STARTUP_GRACE_MS) {
    if (delayMs <= 0) {
      console.log(`⏰ Launch was due at ${nextTime.toISOString()} — running immediately (overdue by ${Math.round(-delayMs / 60000)} min)`);
    } else {
      console.log(`⏰ Launch due in ${Math.round(delayMs / 1000)}s — triggering immediately`);
    }
    setImmediate(async () => {
      try {
        await launchFn();
      } catch (err) {
        console.error(`❌ Unhandled scheduler error: ${err.message}`);
      } finally {
        scheduleNext(launchFn);
      }
    });
  } else {
    scheduleNext(launchFn);
  }
}
