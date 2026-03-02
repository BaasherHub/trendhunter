import { Keypair, Connection, PublicKey, SystemProgram, Transaction, sendAndConfirmTransaction, LAMPORTS_PER_SOL } from "@solana/web3.js";
import bs58 from "bs58";

const RPC_URL = process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";

/**
 * Load keypair from private key — handles multiple formats:
 * - Base58 string (Phantom, Solflare export)
 * - JSON array of numbers (Solana CLI export)
 * - Hex string
 */
function getKeypair() {
  const rawKey = process.env.SOLANA_PRIVATE_KEY;
  if (!rawKey) throw new Error("SOLANA_PRIVATE_KEY not set in environment variables");

  // Clean up the key — remove whitespace, newlines
  const key = rawKey.trim();

  // Try JSON array format: [1,2,3,...] (64 numbers)
  if (key.startsWith("[")) {
    try {
      const arr = JSON.parse(key);
      return Keypair.fromSecretKey(Uint8Array.from(arr));
    } catch {
      throw new Error("SOLANA_PRIVATE_KEY looks like JSON array but failed to parse");
    }
  }

  // Try hex string (128 chars)
  if (key.length === 128 && /^[0-9a-fA-F]+$/.test(key)) {
    try {
      const bytes = Buffer.from(key, "hex");
      return Keypair.fromSecretKey(bytes);
    } catch {
      throw new Error("SOLANA_PRIVATE_KEY looks like hex but failed to parse");
    }
  }

  // Try base58 string (Phantom/Solflare default export)
  try {
    const secretKey = bs58.decode(key);
    return Keypair.fromSecretKey(secretKey);
  } catch (err) {
    throw new Error(
      `SOLANA_PRIVATE_KEY format not recognized. ` +
      `Expected base58 string, JSON array, or hex. Got ${key.length} chars starting with: ${key.slice(0, 10)}...`
    );
  }
}

/**
 * Send SOL to a destination wallet and return the transaction signature
 */
export async function sendSol(destinationAddress, amountSol) {
  console.log(`   💸 Sending ${amountSol} SOL to ${destinationAddress.slice(0, 8)}...`);

  const keypair = getKeypair();
  const connection = new Connection(RPC_URL, "confirmed");

  // Check balance first
  const balance = await connection.getBalance(keypair.publicKey);
  const balanceSol = balance / LAMPORTS_PER_SOL;
  console.log(`   Wallet balance: ${balanceSol.toFixed(4)} SOL`);

  if (balanceSol < amountSol + 0.001) {
    throw new Error(`Insufficient balance: have ${balanceSol.toFixed(4)} SOL, need ${(amountSol + 0.001).toFixed(4)} SOL`);
  }

  const destination = new PublicKey(destinationAddress);
  const lamports = Math.round(amountSol * LAMPORTS_PER_SOL);

  const transaction = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: keypair.publicKey,
      toPubkey: destination,
      lamports,
    })
  );

  const signature = await sendAndConfirmTransaction(connection, transaction, [keypair]);
  console.log(`   ✅ SOL sent! TX: ${signature.slice(0, 20)}...`);
  return signature;
}
