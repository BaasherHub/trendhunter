import axios from "axios";
import FormData from "form-data";
import fs from "fs";
import path from "path";
import { sendSol } from "./solana.js";

const BASE_URL = "https://clawpump.tech";
const AGENT_ID = process.env.CLAWPUMP_AGENT_ID || "trendhunter-001";
const AGENT_NAME = process.env.CLAWPUMP_AGENT_NAME || "TrendHunter";
const WALLET_ADDRESS = process.env.SOLANA_WALLET_ADDRESS;

// Twitter handle — strip everything, send ONLY the raw username
// ClawPump expects: "Thebaasher"  NOT "@Thebaasher" or "x.com/Thebaasher"
const raw = process.env.TWITTER_HANDLE || "";
const TWITTER_HANDLE = raw
  .replace(/https?:\/\//gi, "")   // remove https://
  .replace(/x\.com\//gi, "")      // remove x.com/
  .replace(/twitter\.com\//gi, "") // remove twitter.com/
  .replace(/@/g, "")              // remove @
  .split(/[/?#]/)[0]              // strip any query params
  .trim() || null;

// Dev buy — how much SOL to buy your own token at launch to seed market cap
// Set DEV_BUY_SOL=0.1 in Railway for a ~$15 initial buy (raises mcap above 2.5k)
// Set to 0 to disable. Default 0.05 SOL
const DEV_BUY_SOL = parseFloat(process.env.DEV_BUY_SOL || "0.03");

export async function uploadImage(imagePath) {
  console.log(`📤 Uploading image to ClawPump...`);
  const ext = path.extname(imagePath).toLowerCase();
  const mimeType = [".jpg", ".jpeg"].includes(ext) ? "image/jpeg" :
                   ext === ".gif" ? "image/gif" : "image/png";
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

  // Add Twitter handle — just raw username
  if (TWITTER_HANDLE) {
    payload.twitter = TWITTER_HANDLE;
    console.log(`   Twitter handle: "${TWITTER_HANDLE}" (raw env value was: "${process.env.TWITTER_HANDLE}")`);
  } else {
    console.log(`   ⚠️  No Twitter handle set — add TWITTER_HANDLE=Thebaasher to Railway vars`);
  }

  console.log(`   Name: ${payload.name} | Symbol: ${payload.symbol} | Desc: ${payload.description.length} chars`);
  if (DEV_BUY_SOL > 0) console.log(`   Dev buy: ${DEV_BUY_SOL} SOL`);

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
      console.log(`⚠️  Gasless unavailable — auto-paying...`);
      return await launchWithAutoPayment(payload, err.response.data);
    }
    if (err.response) {
      console.error(`   HTTP ${err.response.status}: ${JSON.stringify(err.response.data)}`);
    }
    throw err;
  }
}

async function launchWithAutoPayment(payload, errorData) {
  const paymentWallet = errorData?.suggestions?.paymentFallback?.selfFunded?.paymentWallet;
  const baseSol = errorData?.suggestions?.paymentFallback?.selfFunded?.amountSol || 0.03;

  if (!paymentWallet) throw new Error("Could not extract payment wallet from ClawPump response");

  if (!process.env.SOLANA_PRIVATE_KEY) {
    const txSignature = process.env.TX_SIGNATURE;
    if (txSignature) return await submitSelfFunded(payload, txSignature);
    throw new Error(`SOLANA_PRIVATE_KEY not set. Send ${baseSol} SOL to ${paymentWallet} and set TX_SIGNATURE.`);
  }

  // Total = base launch fee + dev buy
  const totalSol = baseSol + DEV_BUY_SOL;
  console.log(`   Auto-sending ${totalSol} SOL (${baseSol} launch + ${DEV_BUY_SOL} dev buy)...`);
  const txSignature = await sendSol(paymentWallet, totalSol);

  // Wait for confirmation
  await sleep(5000);

  // Include dev buy in payload if set
  const finalPayload = DEV_BUY_SOL > 0
    ? { ...payload, devBuySol: DEV_BUY_SOL }
    : payload;

  return await submitSelfFunded(finalPayload, txSignature);
}

async function submitSelfFunded(payload, txSignature) {
  console.log(`   Submitting self-funded launch...`);
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
    return response.data;
  } catch (err) {
    if (err.response) console.error(`   Self-funded error: ${JSON.stringify(err.response.data)}`);
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

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
