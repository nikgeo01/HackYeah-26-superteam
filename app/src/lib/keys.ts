// Parsing of embedded throwaway keys (faucet, demo actors). Devnet test money only.
import { Keypair } from "@solana/web3.js";
import bs58 from "bs58";

/** Accepts a JSON byte array (solana-keygen format) or a base58 string. Throws on bad input. */
export function parseSecretKey(input: unknown): Keypair {
  if (Array.isArray(input))
    return Keypair.fromSecretKey(Uint8Array.from(input as number[]));
  if (typeof input !== "string")
    throw new Error("Secret key must be a byte array or a base58 string");
  const text = input.trim();
  if (text.startsWith("[")) return parseSecretKey(JSON.parse(text) as unknown);
  return Keypair.fromSecretKey(bs58.decode(text));
}

/** Like parseSecretKey but returns null (and logs) instead of throwing. */
export function tryParseSecretKey(
  input: unknown,
  what: string,
): Keypair | null {
  if (input === undefined || input === null || input === "") return null;
  try {
    return parseSecretKey(input);
  } catch (err) {
    console.warn(`Could not read ${what}:`, err);
    return null;
  }
}
