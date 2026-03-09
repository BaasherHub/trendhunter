import cron from "node-cron";
import { getTrendingTopics, pickBestTopic } from "./trends.js";
import { generateTokenConcept } from "./generator.js";
import { generateTokenImage } from "./imagegen.js";
import { uploadImage, launchToken, checkEarnings, checkTreasury } from "./clawpump.js";
import { savelaunch, loadHistory, printSummary } from "./logger.js";
import { initScheduler, scheduleNextLaunch } from "./scheduler.js";
import fs from "fs";

function validateEnv() {
  const required = ["ANTHROPIC_API_KEY", "SOLANA_WALLET_ADDRESS"];
  const missing = required.filter((k) => !process.env[k]);
  if (missing.length > 0) {
    console.error("❌ Missing required environment variables:");
    missing.forEach((k) => console.error(`   - ${k}`));
    process.exit(1);
  }
  console.log("✅ Environment variables validated");
}

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function runDailyLaunch() {
  console.log("\n" + "═".repeat(60));
  console.log(`🚀 TRENDHUNTER BOT — ${new Date().toISOString()}`);
  console.log("═".repeat(60));

  const record = {
    timestamp: new Date().toISOString(),
    success: false,
    trend: null,
    name: null,
    symbol: null,
    pumpUrl: null,
    error: null,
  };

  let imagePath = null;

  try {
    // Step 1: Check treasury
    console.log("\n[1/6] Checking ClawPump treasury...");
    try {
      const treasury = await checkTreasury();
      console.log(`   Treasury status: ${treasury.status}`);
      if (treasury.status !== "healthy") {
        console.warn("⚠️  Treasury not healthy — will self-fund if needed");
      }
    } catch {
      console.log("   Treasury check skipped");
    }

    // Step 2: Get trending animal topic
    console.log("\n[2/6] Fetching trending animal topics...");
    const topics = await getTrendingTopics();
    const trend = pickBestTopic(topics);
    record.trend = trend;

    // Step 3: Generate coin concept (with built-in retries)
    console.log("\n[3/6] Generating token concept...");
    const concept = await generateTokenConcept(trend);
    record.name = concept.name;
    record.symbol = concept.symbol;

    // Step 4: Generate banner image
    console.log("\n[4/6] Generating banner image...");
    imagePath = await generateTokenImage(concept.imagePrompt, concept.symbol, concept.name);

    // Step 5: Upload image
    console.log("\n[5/6] Uploading image...");
    const imageUrl = await uploadImage(imagePath);

    // Step 6: Launch token (with retry on overload)
    console.log("\n[6/6] Launching token...");
    let launch;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        launch = await launchToken(concept, imageUrl);
        break;
      } catch (err) {
        const isOverloaded = err.status === 529 || err.message?.includes("overloaded");
        if (isOverloaded && attempt < 3) {
          console.log(`   ⚠️  Overloaded, retrying in ${attempt * 20}s...`);
          await sleep(attempt * 20000);
          continue;
        }
        throw err;
      }
    }

    record.pumpUrl = launch.pumpUrl;
    record.mintAddress = launch.mintAddress;
    record.success = true;

    // Social template
    console.log("\n" + "─".repeat(60));
    console.log("🐾 SOCIAL TEMPLATE:");
    console.log("─".repeat(60));
    console.log(`🚀 Meet $${concept.symbol} — ${concept.name}!`);
    console.log(`\n${concept.description}`);
    console.log(`\nCA: ${launch.mintAddress}`);
    console.log(`Trade: ${launch.pumpUrl}`);
    console.log(`\n#${concept.symbol} #Solana #ClawPump #MemeCoin`);
    console.log("─".repeat(60));

    // Earnings
    try {
      const earnings = await checkEarnings();
      console.log(`\n💰 EARNINGS: ${earnings.totalEarned} SOL earned | ${earnings.totalPending} SOL pending`);
    } catch {}

  } catch (error) {
    record.error = error.message;
    if (error.response?.status === 429) {
      const h = error.response.data?.retryAfterHours || "?";
      console.log(`⏳ Rate limited — already launched today. Next in ${h}h.`);
      record.error = `Rate limited — retry in ${h}h`;
    } else {
      console.error(`\n❌ Launch failed: ${error.message}`);
    }
  } finally {
    if (imagePath && fs.existsSync(imagePath)) fs.unlinkSync(imagePath);
    savelaunch(record);
    const status = record.success ? "✅ SUCCESS" : "❌ FAILED";
    console.log(`\n${status} — ${new Date().toISOString()}`);
    console.log("═".repeat(60) + "\n");
    
    // Schedule next launch (24h + 1min from now, or from last successful/failed attempt)
    scheduleNextLaunch();
  }
}

// ─── Entry point ────────────────────────────────────────────────────────────
validateEnv();

const args = process.argv.slice(2);

if (args.includes("--now") || process.env.RUN_NOW === "true") {
  console.log("🔥 Running immediately (--now or RUN_NOW=true)");
  runDailyLaunch();
} else if (args.includes("--history")) {
  printSummary(loadHistory());
} else {
  // Initialize dynamic scheduler on startup
  console.log("⏰ TrendHunter Bot starting with dynamic 24-hour scheduling...");
  console.log(`   Agent ID: ${process.env.CLAWPUMP_AGENT_ID || "trendhunter-001"}`);
  console.log(`   Wallet: ${process.env.SOLANA_WALLET_ADDRESS?.slice(0, 8)}...`);
  
  initScheduler(runDailyLaunch);
  console.log("\n✅ Bot is running. Waiting for scheduled time...");
}
