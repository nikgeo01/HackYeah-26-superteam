// Program-derived addresses of the escrow program.
import { PublicKey } from "@solana/web3.js";

export const DEAL_SEED = new TextEncoder().encode("deal");
export const VAULT_SEED = new TextEncoder().encode("vault");

/// Size of every `Deal` account; use it as a `dataSize` filter.
export const DEAL_ACCOUNT_SIZE = 843;

/// Byte offsets for `memcmp` filters on `Deal` accounts.
export const DEAL_OFFSETS = {
  client: 8,
  worker: 40,
  judges: [72, 104, 136],
  mint: 168,
} as const;

function u64le(value: bigint): Uint8Array {
  const bytes = new Uint8Array(8);
  new DataView(bytes.buffer).setBigUint64(0, value, true);
  return bytes;
}

export function dealAddress(
  programId: PublicKey,
  client: PublicKey,
  dealId: bigint,
): PublicKey {
  return PublicKey.findProgramAddressSync(
    [DEAL_SEED, client.toBytes(), u64le(dealId)],
    programId,
  )[0];
}

export function vaultAddress(programId: PublicKey, deal: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [VAULT_SEED, deal.toBytes()],
    programId,
  )[0];
}
