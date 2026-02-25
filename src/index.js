import cron from "node-cron";
import { getTrendingTopics, pickBestTopic } from "./trends.js";
import { generateTokenConcept } from "./generator.js";
import { generateTokenImage } from "./imagegen.js";
import { uploadImage, launchToken, checkEarnings, checkTreasury } from "./clawpump.js";
import { savelaunch, loadHistory, printSummary } from "./logger.js";
import fs from "fs";

// ─── Validate environment on startup ───────────────────────────────────────
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

// ─── Main daily job ─────────────────────────────────────────────────────────
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
    // Step 1: Check ClawPump treasury health
    console.log("\n[1/6] Checking ClawPump treasury...");
    try {
      const treasury = await checkTreasury();
      console.log(`   Treasury status: ${treasury.status}`);
      console.log(`   Launches affordable: ${treasury.wallet?.launchesAffordable}`);
      if (treasury.status !== "healthy") {
        console.warn("⚠️  Treasury not healthy — launch may fail, proceeding anyway");
      }
    } catch {
      console.log("   Treasury check skipped (non-critical)");
    }

    // Step 2: Get trending topics
    console.log("\n[2/6] Fetching trending topics...");
    const topics = await getTrendingTopics("US");
    const trend = pickBestTopic(topics);
    record.trend = trend;
    console.log(`   Selected trend: "${trend}"`);

    // Step 3: Generate token concept with Claude
    console.log("\n[3/6] Generating token concept...");
    const concept = await generateTokenConcept(trend);
    record.name = concept.name;
    record.symbol = concept.symbol;

    // Step 4: Generate banner image
    console.log("\n[4/6] Generating banner image...");
    imagePath = await generateTokenImage(concept.imagePrompt, concept.symbol);

    // Step 5: Upload image to ClawPump
    console.log("\n[5/6] Uploading image...");
    const imageUrl = await uploadImage(imagePath);

    // Step 6: Launch token
    console.log("\n[6/6] Launching token...");
    const launch = await launchToken(concept, imageUrl);
    record.pumpUrl = launch.pumpUrl;
    record.mintAddress = launch.mintAddress;
    record.success = true;

    // Print social template
    console.log("\n" + "─".repeat(60));
    console.log("🐦 SOCIAL TEMPLATE (post this on Twitter/X):");
    console.log("─".repeat(60));
    console.log(`🚀 Riding the $${trend.toUpperCase()} wave!`);
    console.log(`\n$${concept.symbol} — ${concept.name} just launched via @clawpumptech`);
    console.log(`\nCA: ${launch.mintAddress}`);
    console.log(`\nTrade: ${launch.pumpUrl}`);
    console.log(`\n#ClawPump #Solana #${concept.symbol}`);
    console.log("─".repeat(60));

    // Check earnings
    try {
      const earnings = await checkEarnings();
      console.log(`\n💰 EARNINGS UPDATE:`);
      console.log(`   Total earned: ${earnings.totalEarned} SOL`);
      console.log(`   Pending: ${earnings.totalPending} SOL`);
      console.log(`   Total sent: ${earnings.totalSent} SOL`);
    } catch {
      console.log("   (Earnings check skipped)");
    }

  } catch (error) {
    record.error = error.message;
    console.error(`\n❌ Launch failed: ${error.message}`);

    // Handle rate limit gracefully
    if (error.response?.status === 429) {
      const retryHours = error.response.data?.retryAfterHours || "unknown";
      console.log(`⏳ Rate limited. Can retry in ${retryHours} hours.`);
      record.error = `Rate limited — retry in ${retryHours}h`;
    }
  } finally {
    // Clean up temp image file
    if (imagePath && fs.existsSync(imagePath)) {
      fs.unlinkSync(imagePath);
    }

    // Save record regardless of success/failure
    savelaunch(record);

    const status = record.success ? "✅ SUCCESS" : "❌ FAILED";
    console.log(`\n${status} — ${new Date().toISOString()}`);
    console.log("═".repeat(60) + "\n");
  }
}

// ─── Entry point ────────────────────────────────────────────────────────────
validateEnv();

const args = process.argv.slice(2);

if (args.includes("--now")) {
  // Run immediately (useful for testing)
  console.log("🔥 Running immediately (--now flag detected)");
  runDailyLaunch();
} else if (args.includes("--history")) {
  // Print launch history
  const history = loadHistory();
  printSummary(history);
} else {
  // Schedule to run every day at 9:30 AM EST (14:30 UTC) — peak US trading hours
  const CRON_SCHEDULE = process.env.CRON_SCHEDULE || "30 14 * * *";
  console.log(`⏰ TrendHunter Bot started — scheduled: ${CRON_SCHEDULE} (UTC = 9:30 AM EST)`);
  console.log(`   Launches at peak US trading hours daily`);
  console.log(`   Agent ID: ${process.env.CLAWPUMP_AGENT_ID || "trendhunter-001"}`);
  console.log(`   Wallet: ${process.env.SOLANA_WALLET_ADDRESS?.slice(0, 8)}...`);

  cron.schedule(CRON_SCHEDULE, runDailyLaunch, {
    timezone: "UTC",
  });

  // Keep the process alive
  console.log("\n✅ Bot is running. Waiting for scheduled time...");
}
