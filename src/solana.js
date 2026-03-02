import { Keypair, Connection, PublicKey, SystemProgram, Transaction, sendAndConfirmTransaction, LAMPORTS_PER_SOL } from "@solana/web3.js";
import bs58 from "bs58";

const RPC_URL = process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";

function getKeypair() {
  const rawKey = process.env.SOLANA_PRIVATE_KEY;
  if (!rawKey) throw new Error("SOLANA_PRIVATE_KEY not set");

  // Aggressively clean the key - remove all whitespace, quotes, backticks
  const key = rawKey.trim().replace(/['"``]/g, "");

  // Try base58 first (Phantom/Solflare string export ~88 chars)
  if (!key.startsWith("[") && !key.includes(",")) {
    try {
      const secretKey = bs58.decode(key);
      if (secretKey.length === 64) {
        return Keypair.fromSecretKey(secretKey);
      }
    } catch {}
  }

  // Try JSON array - handle with or without brackets, with spaces
  try {
    // Normalize: ensure it has brackets, clean any weird chars
    let jsonStr = key;
    if (!jsonStr.startsWith("[")) jsonStr = "[" + jsonStr;
    if (!jsonStr.endsWith("]")) jsonStr = jsonStr + "]";
    
    // Remove any non-numeric/comma/bracket chars that might have crept in
    jsonStr = jsonStr.replace(/[^\d,\[\]\s-]/g, "");
    
    const arr = JSON.parse(jsonStr);
    if (!Array.isArray(arr) || arr.length !== 64) {
      throw new Error(`Expected 64 numbers, got ${arr.length}`);
    }
    return Keypair.fromSecretKey(Uint8Array.from(arr));
  } catch (err) {
    throw new Error(`Failed to parse private key: ${err.message}. Key starts with: ${key.slice(0, 20)}`);
  }
}

export async function sendSol(destinationAddress, amountSol) {
  console.log(`   💸 Sending ${amountSol} SOL to ${destinationAddress.slice(0, 8)}...`);

  const keypair = getKeypair();
  const connection = new Connection(RPC_URL, "confirmed");

  const balance = await connection.getBalance(keypair.publicKey);
  const balanceSol = balance / LAMPORTS_PER_SOL;
  console.log(`   Wallet balance: ${balanceSol.toFixed(4)} SOL`);

  if (balanceSol < amountSol + 0.001) {
    throw new Error(`Insufficient balance: have ${balanceSol.toFixed(4)} SOL, need ${(amountSol + 0.001).toFixed(4)} SOL`);
  }

  const transaction = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: keypair.publicKey,
      toPubkey: new PublicKey(destinationAddress),
      lamports: Math.round(amountSol * LAMPORTS_PER_SOL),
    })
  );

  const signature = await sendAndConfirmTransaction(connection, transaction, [keypair]);
  console.log(`   ✅ SOL sent! TX: ${signature.slice(0, 20)}...`);
  return signature;
}
