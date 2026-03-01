import { Keypair, Connection, PublicKey, Transaction, SystemProgram, sendAndConfirmTransaction, LAMPORTS_PER_SOL } from "@solana/web3.js";
import bs58 from "bs58";

const RPC_URL = process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";

/**
 * Load keypair from base58 private key stored in env
 */
function getKeypair() {
  const privateKey = process.env.SOLANA_PRIVATE_KEY;
  if (!privateKey) throw new Error("SOLANA_PRIVATE_KEY not set in environment variables");
  try {
    const decoded = bs58.decode(privateKey);
    return Keypair.fromSecretKey(decoded);
  } catch {
    // Try JSON array format as fallback
    try {
      const arr = JSON.parse(privateKey);
      return Keypair.fromSecretKey(Uint8Array.from(arr));
    } catch {
      throw new Error("SOLANA_PRIVATE_KEY must be a base58 string or JSON array");
    }
  }
}

/**
 * Send SOL from wallet to recipient and return transaction signature
 */
export async function sendSol(recipientAddress, amountSol) {
  console.log(`💸 Sending ${amountSol} SOL to ${recipientAddress}...`);

  const connection = new Connection(RPC_URL, "confirmed");
  const keypair = getKeypair();
  const recipient = new PublicKey(recipientAddress);

  // Check balance first
  const balance = await connection.getBalance(keypair.publicKey);
  const balanceSol = balance / LAMPORTS_PER_SOL;
  console.log(`   Wallet balance: ${balanceSol.toFixed(4)} SOL`);

  const requiredLamports = Math.ceil(amountSol * LAMPORTS_PER_SOL) + 10000; // +fee buffer
  if (balance < requiredLamports) {
    throw new Error(`Insufficient balance: have ${balanceSol.toFixed(4)} SOL, need ${amountSol + 0.00001} SOL`);
  }

  const transaction = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: keypair.publicKey,
      toPubkey: recipient,
      lamports: Math.ceil(amountSol * LAMPORTS_PER_SOL),
    })
  );

  const signature = await sendAndConfirmTransaction(connection, transaction, [keypair]);
  console.log(`✅ SOL sent! Signature: ${signature}`);
  console.log(`   Explorer: https://solscan.io/tx/${signature}`);

  // Wait a moment for the transaction to be indexed
  await sleep(3000);

  return signature;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
