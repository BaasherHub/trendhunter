import axios from "axios";
import FormData from "form-data";
import fs from "fs";
import path from "path";

const BASE_URL = "https://clawpump.tech";
const AGENT_ID = process.env.CLAWPUMP_AGENT_ID || "trendhunter-001";
const AGENT_NAME = process.env.CLAWPUMP_AGENT_NAME || "TrendHunter";
const WALLET_ADDRESS = process.env.SOLANA_WALLET_ADDRESS;

export async function uploadImage(imagePath) {
  console.log(`📤 Uploading image to ClawPump...`);

  const ext = path.extname(imagePath).toLowerCase();
  const mimeType = ext === ".svg" ? "image/png" : (
    ext === ".jpg" || ext === ".jpeg" ? "image/jpeg" : "image/png"
  );

  const form = new FormData();
  form.append("image", fs.createReadStream(imagePath), {
    filename: `banner_${Date.now()}.png`,
    contentType: mimeType,
  });

  try {
    const response = await axios.post(`${BASE_URL}/api/upload`, form, {
      headers: form.getHeaders(),
      timeout: 30000,
    });
    if (!response.data.success) throw new Error(JSON.stringify(response.data));
    console.log(`✅ Image uploaded: ${response.data.imageUrl}`);
    return response.data.imageUrl;
  } catch (err) {
    if (err.response) console.error(`   Upload error: ${JSON.stringify(err.response.data)}`);
    throw err;
  }
}

/**
 * Get the self-funded payment wallet address from ClawPump
 */
export async function getSelfFundedWallet() {
  const response = await axios.get(`${BASE_URL}/api/launch/self-funded`, { timeout: 10000 });
  return response.data;
}

/**
 * Launch token — tries gasless first, falls back to self-funded if 503
 */
export async function launchToken(concept, imageUrl) {
  console.log(`🚀 Launching $${concept.symbol} on pump.fun...`);

  if (!WALLET_ADDRESS) throw new Error("SOLANA_WALLET_ADDRESS not set!");

  const payload = {
    name: concept.name,
    symbol: concept.symbol,
    description: concept.description,
    imageUrl,
    agentId: AGENT_ID,
    agentName: AGENT_NAME,
    walletAddress: WALLET_ADDRESS,
  };

  console.log(`   Name: ${payload.name} | Symbol: ${payload.symbol} | Desc: ${payload.description.length} chars`);

  // Try gasless launch first
  try {
    const response = await axios.post(`${BASE_URL}/api/launch`, payload, {
      headers: { "Content-Type": "application/json" },
      timeout: 60000,
    });
    if (!response.data.success) throw new Error(JSON.stringify(response.data));
    console.log(`✅ Token launched (gasless)!`);
    console.log(`   Mint: ${response.data.mintAddress}`);
    console.log(`   pump.fun: ${response.data.pumpUrl}`);
    return response.data;
  } catch (err) {
    if (err.response?.status === 503) {
      // Gasless budget empty — need self-funded launch
      console.log(`⚠️  Gasless unavailable — switching to self-funded launch`);
      return await launchSelfFunded(payload, err.response.data);
    }
    if (err.response) {
      console.error(`   HTTP ${err.response.status}: ${JSON.stringify(err.response.data)}`);
    }
    throw err;
  }
}

/**
 * Self-funded launch path — requires TX_SIGNATURE env var to be set
 */
async function launchSelfFunded(payload, errorData) {
  const paymentWallet = errorData?.suggestions?.paymentFallback?.selfFunded?.paymentWallet;
  const amountSol = errorData?.suggestions?.paymentFallback?.selfFunded?.amountSol || 0.03;

  // Check if we have a pre-provided tx signature
  const txSignature = process.env.TX_SIGNATURE;

  if (!txSignature) {
    // Can't auto-pay — inform the user clearly
    console.error(`\n${"═".repeat(60)}`);
    console.error(`💸 SELF-FUND REQUIRED — Bot cannot launch without payment`);
    console.error(`═`.repeat(60));
    console.error(`ClawPump's free gas is empty. To launch, you need to:`);
    console.error(``);
    console.error(`  1. Send exactly ${amountSol} SOL to:`);
    console.error(`     ${paymentWallet}`);
    console.error(``);
    console.error(`  2. Copy the transaction signature from your wallet`);
    console.error(``);
    console.error(`  3. Add it to Railway Variables:`);
    console.error(`     Key:   TX_SIGNATURE`);
    console.error(`     Value: <paste transaction signature here>`);
    console.error(``);
    console.error(`  4. Redeploy — the bot will use it automatically`);
    console.error(`${"═".repeat(60)}\n`);
    throw new Error(`Self-fund required: send ${amountSol} SOL to ${paymentWallet} then set TX_SIGNATURE in Railway`);
  }

  console.log(`   Using TX_SIGNATURE for self-funded launch...`);

  try {
    const response = await axios.post(
      `${BASE_URL}/api/launch/self-funded`,
      { ...payload, txSignature },
      { headers: { "Content-Type": "application/json" }, timeout: 60000 }
    );

    if (!response.data.success) throw new Error(JSON.stringify(response.data));

    console.log(`✅ Token launched (self-funded)!`);
    console.log(`   Mint: ${response.data.mintAddress}`);
    console.log(`   pump.fun: ${response.data.pumpUrl}`);

    // Clear the used signature reminder
    console.log(`\n⚠️  IMPORTANT: Remove TX_SIGNATURE from Railway Variables now!`);
    console.log(`   It's been used and will fail if reused.`);

    return response.data;
  } catch (err) {
    if (err.response) {
      console.error(`   Self-funded HTTP ${err.response.status}: ${JSON.stringify(err.response.data)}`);
    }
    throw err;
  }
}

export async function checkEarnings() {
  const response = await axios.get(
    `${BASE_URL}/api/fees/earnings?agentId=${AGENT_ID}`,
    { timeout: 10000 }
  );
  return response.data;
}

export async function checkTreasury() {
  const response = await axios.get(`${BASE_URL}/api/treasury`, { timeout: 10000 });
  return response.data;
}
