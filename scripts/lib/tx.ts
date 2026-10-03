// Sending. Everything else in scripts/lib only builds instructions.
import {
  ComputeBudgetProgram,
  Connection,
  Keypair,
  Transaction,
  type TransactionInstruction,
} from "@solana/web3.js";

/** Builds an unsigned legacy transaction; the first signer pays the fee. */
export function buildTx(
  instructions: TransactionInstruction[],
  feePayer: Keypair,
  blockhash: string,
): Transaction {
  const tx = new Transaction({
    feePayer: feePayer.publicKey,
    recentBlockhash: blockhash,
  });
  tx.add(...instructions);
  return tx;
}

export const computeUnits = (units: number): TransactionInstruction =>
  ComputeBudgetProgram.setComputeUnitLimit({ units });

/**
 * Signs and sends one transaction and waits for `confirmed`.
 * `signers[0]` pays the fee. Throws with the program logs on failure.
 */
export async function sendTx(
  connection: Connection,
  instructions: TransactionInstruction[],
  signers: Keypair[],
): Promise<string> {
  if (signers.length === 0) throw new Error("sendTx needs at least one signer");
  const latest = await connection.getLatestBlockhash("confirmed");
  const tx = buildTx(instructions, signers[0], latest.blockhash);
  tx.sign(...dedupe(signers));
  return sendSigned(connection, tx, latest);
}

/** Sends already-signed transactions one after the other (e.g. proof, then settle). */
export async function sendSignedSequence(
  connection: Connection,
  txs: Transaction[],
  latest: { blockhash: string; lastValidBlockHeight: number },
): Promise<string[]> {
  const signatures: string[] = [];
  for (const tx of txs)
    signatures.push(await sendSigned(connection, tx, latest));
  return signatures;
}

async function sendSigned(
  connection: Connection,
  tx: Transaction,
  latest: { blockhash: string; lastValidBlockHeight: number },
): Promise<string> {
  const signature = await connection.sendRawTransaction(tx.serialize(), {
    preflightCommitment: "confirmed",
  });
  const result = await connection.confirmTransaction(
    { signature, ...latest },
    "confirmed",
  );
  if (result.value.err) {
    throw new Error(
      `transaction ${signature} failed: ${JSON.stringify(result.value.err)}`,
    );
  }
  return signature;
}

function dedupe(signers: Keypair[]): Keypair[] {
  const seen = new Set<string>();
  return signers.filter((s) => {
    const key = s.publicKey.toBase58();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
