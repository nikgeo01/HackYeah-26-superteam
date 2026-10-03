// Keypair files and the wallet wrapper the Anchor client expects.
import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { dirname } from "node:path";
import { Keypair, Transaction, VersionedTransaction } from "@solana/web3.js";
import type { Wallet } from "@anchor-lang/core";

/** Secret keys are stored as the Solana CLI does: a JSON array of 64 numbers. */
export type SecretKeyJson = number[];

export function keypairFromJson(secret: SecretKeyJson): Keypair {
  if (!Array.isArray(secret) || secret.length !== 64) {
    throw new Error("a secret key must be a JSON array of 64 numbers");
  }
  return Keypair.fromSecretKey(Uint8Array.from(secret));
}

export const keypairToJson = (kp: Keypair): SecretKeyJson =>
  Array.from(kp.secretKey);

export function loadKeypair(path: string): Keypair {
  if (!existsSync(path)) throw new Error(`wallet file not found: ${path}`);
  return keypairFromJson(
    JSON.parse(readFileSync(path, "utf8")) as SecretKeyJson,
  );
}

/** Writes a file readable only by the current user (keys and env files with secrets). */
export function writePrivateFile(path: string, content: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content, { mode: 0o600 });
  chmodSync(path, 0o600);
}

/** Wraps a keypair as an Anchor `Wallet` (the same shape wallet-adapter provides). */
export function keypairWallet(kp: Keypair): Wallet {
  const sign = <T extends Transaction | VersionedTransaction>(tx: T): T => {
    if (tx instanceof VersionedTransaction) tx.sign([kp]);
    else tx.partialSign(kp);
    return tx;
  };
  return {
    publicKey: kp.publicKey,
    payer: kp,
    signTransaction: async (tx) => sign(tx),
    signAllTransactions: async (txs) => txs.map(sign),
  };
}
