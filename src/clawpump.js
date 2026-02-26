import axios from "axios";
import FormData from "form-data";
import fs from "fs";
import path from "path";

const BASE_URL = "https://clawpump.tech";
const AGENT_ID = process.env.CLAWPUMP_AGENT_ID || "trendhunter-001";
const AGENT_NAME = process.env.CLAWPUMP_AGENT_NAME || "TrendHunter";
const WALLET_ADDRESS = process.env.SOLANA_WALLET_ADDRESS;
const TWITTER_HANDLE = process.env.TWITTER_HANDLE || null; // e.g. "yourhandle" without @

export async function uploadImage(imagePath) {
  console.log(`📤 Uploading image to ClawPump...`);

  const ext = path.extname(imagePath).toLowerCase();
  const mimeType = [".jpg", ".jpeg"].includes(ext) ? "image/jpeg" :
                   ext === ".gif" ? "image/gif" :
                   ext === ".webp" ? "image/webp" : "image/png";

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

  // Add Twitter handle if configured — shows up on the coin's pump.fun page
  if (TWITTER_HANDLE) {
    payload.twitter = TWITTER_HANDLE.replace("@", "");
    console.log(`   Twitter: @${payload.twitter}`);
  }

  console.log(`   Name: ${payload.name} | Symbol: ${payload.symbol} | Desc: ${payload.description.length} chars`);

  // Try gasless first
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
      console.log(`⚠️  Gasless unavailable — switching to self-funded`);
      return await launchSelfFunded(payload, err.response.data);
    }
    if (err.response) {
      console.error(`   HTTP ${err.response.status}: ${JSON.stringify(err.response.data)}`);
    }
    throw err;
  }
}

async function launchSelfFunded(payload, errorData) {
  const paymentWallet = errorData?.suggestions?.paymentFallback?.selfFunded?.paymentWallet;
  const amountSol = errorData?.suggestions?.paymentFallback?.selfFunded?.amountSol || 0.03;
  const txSignature = process.env.TX_SIGNATURE;

  if (!txSignature) {
    console.error(`\n${"═".repeat(60)}`);
    console.error(`💸 SELF-FUND REQUIRED`);
    console.error(`  1. Send exactly ${amountSol} SOL to: ${paymentWallet}`);
    console.error(`  2. Add TX_SIGNATURE to Railway Variables`);
    console.error(`${"═".repeat(60)}\n`);
    throw new Error(`Self-fund required: send ${amountSol} SOL to ${paymentWallet}`);
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
    console.log(`\n⚠️  IMPORTANT: Delete TX_SIGNATURE from Railway Variables now!`);
    return response.data;
  } catch (err) {
    if (err.response) {
      console.error(`   Self-funded error: ${JSON.stringify(err.response.data)}`);
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
