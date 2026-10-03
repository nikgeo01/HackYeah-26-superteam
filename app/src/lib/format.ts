// The ONLY place amounts, enums, addresses and durations are turned into text (PLAN 4.5, 5.2).
import type { PublicKey } from "@solana/web3.js";
import type BN from "bn.js";
import { CLUSTER } from "./env";

// ---------------------------------------------------------------- amounts

export const TUSDC_DECIMALS = 6;
export const TUSDC_SYMBOL = "tUSDC";
const UNIT = 10n ** BigInt(TUSDC_DECIMALS);

/** Any on-chain integer amount to bigint. */
export function toBigInt(value: bigint | BN | number | string): bigint {
  if (typeof value === "bigint") return value;
  if (typeof value === "number") return BigInt(Math.trunc(value));
  if (typeof value === "string") return BigInt(value);
  return BigInt(value.toString());
}

/**
 * Raw base units (6 decimals) to text, e.g. 1_500_000n -> "1.50 tUSDC".
 * Shows at least 2 and at most 6 decimals, trailing zeros trimmed.
 */
export function formatAmount(
  raw: bigint | BN | number,
  opts: { symbol?: boolean; minDecimals?: number } = {},
): string {
  const { symbol = true, minDecimals = 2 } = opts;
  const value = toBigInt(raw);
  const negative = value < 0n;
  const abs = negative ? -value : value;
  const whole = (abs / UNIT).toLocaleString("en-US");
  let frac = (abs % UNIT).toString().padStart(TUSDC_DECIMALS, "0");
  while (frac.length > minDecimals && frac.endsWith("0"))
    frac = frac.slice(0, -1);
  const text = `${negative ? "-" : ""}${whole}${frac ? `.${frac}` : ""}`;
  return symbol ? `${text} ${TUSDC_SYMBOL}` : text;
}

/** User input such as "1,000.5" to raw base units; null when invalid or over 6 decimals. */
export function parseAmount(input: string): bigint | null {
  const text = input.trim().replace(/,/g, "").replace(/_/g, "");
  if (!/^\d+(\.\d*)?$|^\.\d+$/.test(text)) return null;
  const [whole = "0", frac = ""] = text.split(".");
  if (frac.length > TUSDC_DECIMALS) return null;
  return (
    BigInt(whole || "0") * UNIT +
    BigInt(frac.padEnd(TUSDC_DECIMALS, "0") || "0")
  );
}

/** Lamports to a short SOL string, e.g. "0.05 SOL". */
export function formatSol(lamports: number | bigint): string {
  const sol = Number(lamports) / 1e9;
  return `${sol.toLocaleString("en-US", { maximumFractionDigits: 4 })} SOL`;
}

// ---------------------------------------------------------------- enums

/**
 * Anchor decodes enums as objects (`{ submitted: {} }`). Returns the variant name in
 * camelCase ("submitted", "workerPaid"). Strings pass through with the first letter lowered.
 */
export function enumName(value: unknown): string {
  if (typeof value === "string")
    return value.charAt(0).toLowerCase() + value.slice(1);
  if (value && typeof value === "object") {
    const key = Object.keys(value)[0];
    if (key) return key.charAt(0).toLowerCase() + key.slice(1);
  }
  throw new Error(`Not an enum value: ${JSON.stringify(value)}`);
}

/** The inverse: "submitted" -> `{ submitted: {} }`, for instruction arguments. */
export type EnumValue<T extends string> = T extends string
  ? { [K in T]: Record<string, never> }
  : never;
export function enumValue<T extends string>(name: T): EnumValue<T> {
  return { [name]: {} } as EnumValue<T>;
}

const MILESTONE_STATUS_LABEL: Record<string, string> = {
  pending: "Waiting for delivery",
  submitted: "Delivered, in review",
  disputed: "Objection raised",
  approved: "Payment approved",
  settled: "Paid out",
};

const DEAL_STATUS_LABEL: Record<string, string> = {
  open: "Waiting for the freelancer to accept",
  active: "In progress",
  cancelled: "Cancelled",
};

const OUTCOME_LABEL: Record<string, string> = {
  unset: "Not decided yet",
  workerPaid: "The freelancer was paid",
  clientRefunded: "The client was refunded",
  split: "Split 50/50",
  cancelled: "Refunded after cancellation",
};

export const milestoneStatusLabel = (s: string): string =>
  MILESTONE_STATUS_LABEL[s] ?? s;
export const dealStatusLabel = (s: string): string => DEAL_STATUS_LABEL[s] ?? s;
export const outcomeLabel = (s: string): string => OUTCOME_LABEL[s] ?? s;

// ---------------------------------------------------------------- addresses and links

/** "AbCd…WxYz". */
export function shortAddress(
  address: PublicKey | string | null | undefined,
  chars = 4,
): string {
  if (!address) return "";
  const text = typeof address === "string" ? address : address.toBase58();
  if (text.length <= chars * 2 + 1) return text;
  return `${text.slice(0, chars)}…${text.slice(-chars)}`;
}

function clusterQuery(): string {
  return CLUSTER === "mainnet-beta"
    ? ""
    : `?cluster=${encodeURIComponent(CLUSTER)}`;
}

export function explorerTxUrl(signature: string): string {
  return `https://explorer.solana.com/tx/${signature}${clusterQuery()}`;
}

export function explorerAddressUrl(address: PublicKey | string): string {
  const text = typeof address === "string" ? address : address.toBase58();
  return `https://explorer.solana.com/address/${text}${clusterQuery()}`;
}

// ---------------------------------------------------------------- time

/** Seconds to "mm:ss" under an hour, "1h 02m" under a day, "2d 3h" above. Negative counts as 0. */
export function formatCountdown(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const pad = (n: number) => n.toString().padStart(2, "0");
  if (s < 3600) return `${pad(Math.floor(s / 60))}:${pad(s % 60)}`;
  if (s < 86400)
    return `${Math.floor(s / 3600)}h ${pad(Math.floor((s % 3600) / 60))}m`;
  return `${Math.floor(s / 86400)}d ${Math.floor((s % 86400) / 3600)}h`;
}

/** A window length in words: 45 -> "45 seconds", 3600 -> "1 hour", 90000 -> "1 day 1 hour". */
export function formatDuration(seconds: number): string {
  const parts: string[] = [];
  let s = Math.max(0, Math.floor(seconds));
  const units: [number, string][] = [
    [86400, "day"],
    [3600, "hour"],
    [60, "minute"],
    [1, "second"],
  ];
  for (const [size, name] of units) {
    const n = Math.floor(s / size);
    if (n > 0) {
      parts.push(`${n} ${name}${n === 1 ? "" : "s"}`);
      s -= n * size;
    }
    if (parts.length === 2) break;
  }
  return parts.length ? parts.join(" ") : "0 seconds";
}

/** Unix seconds to a local date and time. */
export function formatDateTime(unixSeconds: number): string {
  if (!unixSeconds) return "";
  return new Date(unixSeconds * 1000).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}
