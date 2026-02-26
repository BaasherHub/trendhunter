import axios from "axios";
import FormData from "form-data";
import fs from "fs";

const BASE_URL = "https://clawpump.tech";
const AGENT_ID = process.env.CLAWPUMP_AGENT_ID || "trendhunter-001";
const AGENT_NAME = process.env.CLAWPUMP_AGENT_NAME || "TrendHunter";
const WALLET_ADDRESS = process.env.SOLANA_WALLET_ADDRESS;

export async function uploadImage(imagePath) {
  console.log(`📤 Uploading image to ClawPump...`);
  const form = new FormData();
  form.append("image", fs.createReadStream(imagePath));
  const response = await axios.post(`${BASE_URL}/api/upload`, form, {
    headers: form.getHeaders(),
    timeout: 30000,
  });
  if (!response.data.success) {
    throw new Error(`Image upload failed: ${JSON.stringify(response.data)}`);
  }
  console.log(`✅ Image uploaded: ${response.data.imageUrl}`);
  return response.data.imageUrl;
}

export async function launchToken(concept, imageUrl) {
  console.log(`🚀 Launching $${concept.symbol} on pump.fun...`);
  if (!WALLET_ADDRESS) {
    throw new Error("SOLANA_WALLET_ADDRESS environment variable is not set!");
  }
  const payload = {
    name: concept.name,
    symbol: concept.symbol,
    description: concept.description,
    imageUrl,
    agentId: AGENT_ID,
    agentName: AGENT_NAME,
    walletAddress: WALLET_ADDRESS,
  };
  console.log(`   Payload: ${JSON.stringify(payload, null, 2)}`);
  try {
    const response = await axios.post(`${BASE_URL}/api/launch`, payload, {
      headers: { "Content-Type": "application/json" },
      timeout: 60000,
    });
    if (!response.data.success) {
      throw new Error(`Token launch failed: ${JSON.stringify(response.data)}`);
    }
    console.log(`✅ Token launched!`);
    console.log(`   Mint: ${response.data.mintAddress}`);
    console.log(`   pump.fun: ${response.data.pumpUrl}`);
    return response.data;
  } catch (err) {
    if (err.response) {
      console.error(`   HTTP ${err.response.status} from ClawPump:`);
      console.error(`   Body: ${JSON.stringify(err.response.data)}`);
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
