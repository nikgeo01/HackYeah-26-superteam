// Transaction pipeline (PLAN 4.5): build -> sign with the active actor -> send -> confirm.
// `buildTransaction` only builds; `sendBuilt`, `sendInstructions` and `sendAllSequential` send.
import { createAssociatedTokenAccountIdempotentInstruction } from "@solana/spl-token";
import {
  SendTransactionError,
  Transaction,
  type Commitment,
  type Connection,
  type Keypair,
  type PublicKey,
  type TransactionInstruction,
  type VersionedTransaction,
} from "@solana/web3.js";
import { ata } from "./pdas";

/** What the active actor (wallet or demo key) provides. Same shape as Anchor's `Wallet`. */
export interface TxSigner {
  publicKey: PublicKey;
  signTransaction<T extends Transaction | VersionedTransaction>(
    tx: T,
  ): Promise<T>;
  signAllTransactions<T extends Transaction | VersionedTransaction>(
    txs: T[],
  ): Promise<T[]>;
}

/** An associated token account to create (idempotently) before the instructions run. */
export interface AtaSpec {
  owner: PublicKey;
  mint: PublicKey;
}

export interface TxSpec {
  instructions: TransactionInstruction[];
  /** Recipient accounts to create first, deduplicated; the fee payer pays the rent. */
  atas?: AtaSpec[];
  /** Extra co-signers, e.g. the faucet key. They sign before the actor. */
  signers?: Keypair[];
}

export interface BuiltTx {
  tx: Transaction;
  blockhash: string;
  lastValidBlockHeight: number;
}

export const CONFIRM_COMMITMENT = "confirmed" satisfies Commitment;

/** Thrown when a transaction landed but failed; carries the signature for the receipt link. */
export class TxFailedError extends Error {
  readonly signature: string;
  readonly logs: string[];
  constructor(signature: string, err: unknown, logs: string[] = []) {
    super(
      `Transaction failed: ${JSON.stringify(err)}${logs.length ? `\n${logs.join("\n")}` : ""}`,
    );
    this.name = "TxFailedError";
    this.signature = signature;
    this.logs = logs;
  }
}

/** Idempotent ATA creations for the given owners, deduplicated. */
export function ataInstructions(
  payer: PublicKey,
  specs: AtaSpec[] = [],
): TransactionInstruction[] {
  const seen = new Set<string>();
  const out: TransactionInstruction[] = [];
  for (const { owner, mint } of specs) {
    const address = ata(mint, owner);
    const key = address.toBase58();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(
      createAssociatedTokenAccountIdempotentInstruction(
        payer,
        address,
        owner,
        mint,
      ),
    );
  }
  return out;
}

/** Builds (never sends) a legacy transaction: ATA creations + instructions, fresh blockhash. */
export async function buildTransaction(
  connection: Connection,
  payer: PublicKey,
  spec: TxSpec,
): Promise<BuiltTx> {
  const { blockhash, lastValidBlockHeight } =
    await connection.getLatestBlockhash(CONFIRM_COMMITMENT);
  const tx = new Transaction({
    feePayer: payer,
    blockhash,
    lastValidBlockHeight,
  });
  tx.add(...ataInstructions(payer, spec.atas), ...spec.instructions);
  if (spec.signers?.length) tx.partialSign(...spec.signers);
  return { tx, blockhash, lastValidBlockHeight };
}

async function sendSigned(
  connection: Connection,
  signed: Transaction,
  built: BuiltTx,
): Promise<string> {
  const signature = await connection.sendRawTransaction(signed.serialize(), {
    preflightCommitment: CONFIRM_COMMITMENT,
  });
  const result = await connection.confirmTransaction(
    {
      signature,
      blockhash: built.blockhash,
      lastValidBlockHeight: built.lastValidBlockHeight,
    },
    CONFIRM_COMMITMENT,
  );
  if (result.value.err) {
    let logs: string[] = [];
    try {
      const info = await connection.getTransaction(signature, {
        commitment: CONFIRM_COMMITMENT,
        maxSupportedTransactionVersion: 0,
      });
      logs = info?.meta?.logMessages ?? [];
    } catch {
      // Logs are a nice-to-have for the Details section.
    }
    throw new TxFailedError(signature, result.value.err, logs);
  }
  return signature;
}

/** Signs a built transaction with the actor, sends it and waits for `confirmed`. Returns the signature. */
export async function sendBuilt(
  connection: Connection,
  signer: TxSigner,
  built: BuiltTx,
): Promise<string> {
  const signed = await signer.signTransaction(built.tx);
  return sendSigned(connection, signed, built);
}

/** Build + sign + send + confirm one transaction. */
export async function sendInstructions(
  connection: Connection,
  signer: TxSigner,
  spec: TxSpec,
): Promise<string> {
  const built = await buildTransaction(connection, signer.publicKey, spec);
  return sendBuilt(connection, signer, built);
}

/**
 * Several transactions, one wallet prompt: signs all with `signAllTransactions`, then sends and
 * confirms them one after another (stops at the first failure). Returns the signatures sent.
 */
export async function sendAllSequential(
  connection: Connection,
  signer: TxSigner,
  specs: TxSpec[],
  onConfirmed?: (signature: string, index: number) => void,
): Promise<string[]> {
  const built = await Promise.all(
    specs.map((s) => buildTransaction(connection, signer.publicKey, s)),
  );
  const signed = await signer.signAllTransactions(built.map((b) => b.tx));
  const signatures: string[] = [];
  for (let i = 0; i < signed.length; i++) {
    const sig = await sendSigned(connection, signed[i], built[i]);
    signatures.push(sig);
    onConfirmed?.(sig, i);
  }
  return signatures;
}

/** Best-effort program logs from a send or confirm error, for error mapping. */
export async function errorLogs(
  err: unknown,
  connection?: Connection,
): Promise<string[]> {
  if (err instanceof TxFailedError) return err.logs;
  if (err instanceof SendTransactionError) {
    try {
      if (connection) return (await err.getLogs(connection)) ?? [];
    } catch {
      // fall through
    }
    return err.logs ?? [];
  }
  const logs = (err as { logs?: unknown } | null)?.logs;
  return Array.isArray(logs) ? (logs as string[]) : [];
}
