import fs from "fs";
import path from "path";

const LAUNCH_HISTORY_FILE = process.env.LAUNCH_HISTORY_FILE || "./launches.json";
let currentSchedule = null;

/**
 * Load launch history to get the last launch timestamp
 */
function loadLaunchHistory() {
  try {
    if (fs.existsSync(LAUNCH_HISTORY_FILE)) {
      const data = fs.readFileSync(LAUNCH_HISTORY_FILE, "utf8");
      return JSON.parse(data);
    }
  } catch (err) {
    console.warn(`⚠️  Could not load launch history: ${err.message}`);
  }
  return [];
}

/**
 * Calculate next launch time: 24 hours + 1 minute from last attempt
 */
function calculateNextLaunchTime() {
  const history = loadLaunchHistory();
  
  if (history.length === 0) {
    // First launch: now
    return new Date();
  }

  // Get the most recent launch (successful or failed)
  const lastLaunch = new Date(history[0].timestamp);
  const nextLaunch = new Date(lastLaunch.getTime() + 24 * 60 * 60 * 1000 + 60 * 1000); // 24h + 1min

  const now = new Date();
  
  // If next launch is in the past, launch immediately
  if (nextLaunch <= now) {
    console.log(`📍 Last launch was: ${lastLaunch.toISOString()}`);
    console.log(`📍 Next launch due now (was scheduled for ${nextLaunch.toISOString()})`);
    return now;
  }

  console.log(`📍 Last launch: ${lastLaunch.toISOString()}`);
  console.log(`⏰ Next launch scheduled: ${nextLaunch.toISOString()}`);
  return nextLaunch;
}

/**
 * Wait until the scheduled time and then execute the callback
 */
async function waitUntilScheduledTime(scheduledTime, callback) {
  const now = new Date();
  const delay = scheduledTime.getTime() - now.getTime();

  if (delay <= 0) {
    console.log("🚀 Launching immediately (scheduled time has passed)");
    callback();
    return;
  }

  const hours = Math.floor(delay / (1000 * 60 * 60));
  const minutes = Math.floor((delay % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((delay % (1000 * 60)) / 1000);

  console.log(`⏳ Waiting ${hours}h ${minutes}m ${seconds}s until next launch...`);

  setTimeout(() => {
    console.log("🔔 Scheduled time reached!");
    callback();
  }, delay);
}

/**
 * Initialize scheduler on bot startup
 * Checks if a launch is due and starts the wait for the next one
 */
export function initScheduler(launchCallback) {
  const nextTime = calculateNextLaunchTime();
  
  // Check if a launch is due within the next 2 minutes
  const now = new Date();
  const timeUntilLaunch = nextTime.getTime() - now.getTime();
  
  if (timeUntilLaunch <= 2 * 60 * 1000) {
    console.log("🚀 Launch is due soon, will trigger now");
    launchCallback();
  } else {
    waitUntilScheduledTime(nextTime, launchCallback);
  }
}

/**
 * Schedule the next launch after current launch completes
 * Called from the finally block in index.js
 */
export function scheduleNextLaunch() {
  const nextTime = calculateNextLaunchTime();
  
  if (currentSchedule) {
    clearTimeout(currentSchedule);
  }

  const delay = nextTime.getTime() - new Date().getTime();

  if (delay > 0) {
    console.log(`✅ Next launch scheduled for: ${nextTime.toISOString()}`);
    console.log(`   (${Math.floor(delay / (1000 * 60 * 60))}h ${Math.floor((delay % (1000 * 60 * 60)) / (1000 * 60))}m from now)`);

    currentSchedule = setTimeout(() => {
      // Re-import to get fresh callback reference
      import("./index.js").then(module => {
        if (module.runDailyLaunch) {
          module.runDailyLaunch();
        }
      });
    }, delay);
  } else {
    console.log("⚠️  Next launch time is in the past, will launch immediately on restart");
  }
}

export function getCurrentSchedule() {
  return currentSchedule;
}
