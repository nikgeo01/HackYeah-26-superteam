// Configuration for the Node scripts and the prover, read from the environment.
// A root `.env` (gitignored) is loaded first when present; real environment
// variables win over it.
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PublicKey } from "@solana/web3.js";
import idl from "../../idl/milestone_escrow.json" with { type: "json" };

/** Repository root (two levels above this file). */
export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
/** Gitignored directory for demo keys, proofs and reports. */
export const DEMO_DIR = join(ROOT, ".demo");

const dotenv = join(ROOT, ".env");
if (existsSync(dotenv)) {
  try {
    process.loadEnvFile(dotenv);
  } catch (error) {
    console.warn(`warning: could not read ${dotenv}: ${String(error)}`);
  }
}

function opt(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

export function expandHome(path: string): string {
  return path.startsWith("~/") ? join(homedir(), path.slice(2)) : path;
}

export const DEFAULT_RPC_URL = "https://api.devnet.solana.com";
export const DEFAULT_APP_URL = "http://localhost:5173";

export const env = {
  rpcUrl: (): string => opt("RPC_URL") ?? DEFAULT_RPC_URL,
  /** `PROGRAM_ID` overrides the address in the committed IDL. */
  programId: (): PublicKey => new PublicKey(opt("PROGRAM_ID") ?? idl.address),
  /** Deployer / payer wallet file: `ANCHOR_WALLET`, else `WALLET`, else the Solana CLI default. */
  walletPath: (): string =>
    expandHome(
      opt("ANCHOR_WALLET") ?? opt("WALLET") ?? "~/.config/solana/id.json",
    ),
  /** tUSDC mint from `TUSDC_MINT`, or undefined (callers may fall back to `.demo/faucet.json`). */
  tusdcMint: (): PublicKey | undefined => {
    const value = opt("TUSDC_MINT");
    return value ? new PublicKey(value) : undefined;
  },
  appUrl: (): string => (opt("APP_URL") ?? DEFAULT_APP_URL).replace(/\/+$/, ""),
  explorerCluster: (): string => opt("EXPLORER_CLUSTER") ?? "devnet",
  optional: opt,
  required(name: string): string {
    const value = opt(name);
    if (!value)
      throw new Error(
        `missing environment variable ${name} (see .env.example)`,
      );
    return value;
  },
};
