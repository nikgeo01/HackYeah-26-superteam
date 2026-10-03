// App-side address helpers: thin wrappers over the shared client/pdas.ts, bound to the
// configured program ID, plus associated token accounts. No derivation logic is duplicated.
import { PublicKey } from "@solana/web3.js";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import { dealAddress, vaultAddress } from "@client/pdas";
import { PROGRAM_ID } from "./idl";

export { DEAL_ACCOUNT_SIZE, DEAL_OFFSETS } from "@client/pdas";

/** Deal PDA: `[b"deal", client, deal_id u64 LE]`. */
export function dealPda(
  client: PublicKey,
  dealId: bigint,
  programId: PublicKey = PROGRAM_ID,
): PublicKey {
  return dealAddress(programId, client, dealId);
}

/** Vault token account PDA: `[b"vault", deal]`. */
export function vaultPda(
  deal: PublicKey,
  programId: PublicKey = PROGRAM_ID,
): PublicKey {
  return vaultAddress(programId, deal);
}

/** The owner's associated token account for `mint` (classic SPL Token). */
export function ata(mint: PublicKey, owner: PublicKey): PublicKey {
  return getAssociatedTokenAddressSync(mint, owner, true);
}

/** A fresh deal id. Time-based, so a closed deal's address is never re-created by accident. */
export function newDealId(): bigint {
  return BigInt(Date.now());
}

/** Parses a base58 address, or returns null. */
export function toPublicKey(
  value: string | PublicKey | null | undefined,
): PublicKey | null {
  if (!value) return null;
  if (value instanceof PublicKey) return value;
  try {
    return new PublicKey(value);
  } catch {
    return null;
  }
}
