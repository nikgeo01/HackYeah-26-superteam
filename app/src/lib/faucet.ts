// "Get test dollars" (ADR-13, PLAN 4.7): one transaction, fee paid by the user, co-signed by the
// embedded faucet key (the tUSDC mint authority): idempotent ATA creation + mintTo.
import { createMintToInstruction } from "@solana/spl-token";
import { PublicKey, type Keypair } from "@solana/web3.js";
import { FAUCET_SECRET, TUSDC_MINT } from "./env";
import { tryParseSecretKey } from "./keys";
import { ata, toPublicKey } from "./pdas";
import { TUSDC_DECIMALS } from "./format";
import type { TxSpec } from "./tx";

/** 1,000 tUSDC in base units. */
export const FAUCET_AMOUNT = 1_000n * 10n ** BigInt(TUSDC_DECIMALS);

export const FAUCET_KEYPAIR: Keypair | null = tryParseSecretKey(
  FAUCET_SECRET,
  "VITE_FAUCET_SECRET",
);
export const TUSDC_MINT_KEY: PublicKey | null = toPublicKey(TUSDC_MINT);

/** Why the faucet cannot be used in this build, or null when it can. */
export function faucetUnavailableReason(): string | null {
  if (!TUSDC_MINT_KEY)
    return "The test-dollar mint is not configured (VITE_TUSDC_MINT).";
  if (!FAUCET_KEYPAIR)
    return "The faucet key is not configured (VITE_FAUCET_SECRET).";
  return null;
}

/** Builds (never sends) the faucet transaction for `user`. */
export function faucetTxSpec(
  user: PublicKey,
  mint: PublicKey = TUSDC_MINT_KEY!,
  faucet: Keypair = FAUCET_KEYPAIR!,
  amount: bigint = FAUCET_AMOUNT,
): TxSpec {
  return {
    atas: [{ owner: user, mint }],
    instructions: [
      createMintToInstruction(mint, ata(mint, user), faucet.publicKey, amount),
    ],
    signers: [faucet],
  };
}
