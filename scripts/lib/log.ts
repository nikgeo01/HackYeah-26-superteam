// Console output: explorer links and token amounts are formatted here only.
import { env } from "./env.ts";

export const TUSDC_DECIMALS = 6;
export const UNIT = 10n ** BigInt(TUSDC_DECIMALS);

export function explorerTx(signature: string): string {
  return `https://explorer.solana.com/tx/${signature}?cluster=${env.explorerCluster()}`;
}

export function explorerAddress(address: string): string {
  return `https://explorer.solana.com/address/${address}?cluster=${env.explorerCluster()}`;
}

export function dealUrl(deal: string): string {
  return `${env.appUrl()}/#/deal/${deal}`;
}

/** Base units to a decimal string, e.g. 1500000n -> "1.5". */
export function formatTokens(
  amount: bigint,
  decimals = TUSDC_DECIMALS,
): string {
  const neg = amount < 0n;
  const abs = neg ? -amount : amount;
  const base = 10n ** BigInt(decimals);
  const whole = abs / base;
  const frac = (abs % base)
    .toString()
    .padStart(decimals, "0")
    .replace(/0+$/, "");
  return `${neg ? "-" : ""}${whole}${frac ? "." + frac : ""}`;
}

/** Decimal string to base units, e.g. "2000" -> 2000000000n. */
export function parseTokens(text: string, decimals = TUSDC_DECIMALS): bigint {
  const match = /^(\d+)(?:\.(\d+))?$/.exec(text.trim());
  if (!match || (match[2] ?? "").length > decimals)
    throw new Error(`not a token amount: ${text}`);
  return (
    BigInt(match[1]) * 10n ** BigInt(decimals) +
    BigInt((match[2] ?? "").padEnd(decimals, "0"))
  );
}

export function formatSol(lamports: number | bigint): string {
  return formatTokens(BigInt(lamports), 9);
}

export const info = (message: string): void => console.log(message);
export const step = (message: string): void => console.log(`- ${message}`);

export function sent(label: string, signature: string): void {
  console.log(`  ok  ${label}\n      ${explorerTx(signature)}`);
}

export function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}
