import axios from "axios";
import FormData from "form-data";
import fs from "fs";
import path from "path";
import { sendSol } from "./solana.js";

const BASE_URL = "https://clawpump.tech";
const AGENT_ID = process.env.CLAWPUMP_AGENT_ID || "trendhunter-001";
const AGENT_NAME = process.env.CLAWPUMP_AGENT_NAME || "TrendHunter";
const WALLET_ADDRESS = process.env.SOLANA_WALLET_ADDRESS;
const TWITTER_HANDLE = process.env.TWITTER_HANDLE || null;

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
      console.log(`⚠️  Gasless unavailable — auto-paying 0.03 SOL...`);
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
  const amountSol = errorData?.suggestions?.paymentFallback?.selfFunded?.amountSol || 0.03;

  if (!paymentWallet) {
    throw new Error("Could not extract payment wallet from ClawPump error response");
  }

  // Check if we have private key for auto-payment
  if (!process.env.SOLANA_PRIVATE_KEY) {
    // Fall back to manual TX_SIGNATURE if set
    const txSignature = process.env.TX_SIGNATURE;
    if (txSignature) {
      console.log(`   Using manual TX_SIGNATURE...`);
      return await submitSelfFunded(payload, txSignature);
    }
    console.error(`\n${"═".repeat(60)}`);
    console.error(`💸 PAYMENT NEEDED: Send ${amountSol} SOL to ${paymentWallet}`);
    console.error(`   Then add TX_SIGNATURE to Railway Variables`);
    console.error(`   Or set SOLANA_PRIVATE_KEY for fully automatic payments`);
    console.error(`${"═".repeat(60)}\n`);
    throw new Error(`Payment required. Set SOLANA_PRIVATE_KEY for auto-payment.`);
  }

  // Auto-send SOL from wallet
  console.log(`   Auto-sending ${amountSol} SOL for launch...`);
  const txSignature = await sendSol(paymentWallet, amountSol);

  return await submitSelfFunded(payload, txSignature);
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
