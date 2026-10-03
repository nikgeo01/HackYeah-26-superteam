// Demo actors (ADR-10) and the tUSDC faucet key, stored under the gitignored `.demo/`.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Keypair, PublicKey } from "@solana/web3.js";
import { DEMO_DIR, env } from "./env.ts";
import {
  keypairFromJson,
  keypairToJson,
  writePrivateFile,
  type SecretKeyJson,
} from "./keys.ts";

export const ROLES = [
  { role: "client", label: "Client" },
  { role: "worker", label: "Worker" },
  { role: "arbiter1", label: "Arbiter 1" },
  { role: "arbiter2", label: "Arbiter 2" },
  { role: "arbiter3", label: "Arbiter 3" },
  { role: "passerBy", label: "Passer-by" },
] as const;

export type Role = (typeof ROLES)[number]["role"];
export type SetName = "pitch" | "hosted";
export const SET_NAMES: readonly SetName[] = ["pitch", "hosted"];

/** One entry of `.demo/actors.json` and of `VITE_DEMO_ACTORS`. */
export interface ActorEntry {
  role: Role;
  label: string;
  publicKey: string;
  /** Solana CLI format: JSON array of 64 numbers. Throwaway devnet keys only. */
  secretKey: SecretKeyJson;
}

export interface ActorsFile {
  version: 1;
  sets: Partial<Record<SetName, ActorEntry[]>>;
}

export const ACTORS_PATH = join(DEMO_DIR, "actors.json");
export const FAUCET_PATH = join(DEMO_DIR, "faucet.json");

export function readActorsFile(): ActorsFile {
  if (!existsSync(ACTORS_PATH)) return { version: 1, sets: {} };
  return JSON.parse(readFileSync(ACTORS_PATH, "utf8")) as ActorsFile;
}

export function writeActorsFile(file: ActorsFile): void {
  writePrivateFile(ACTORS_PATH, JSON.stringify(file, null, 2) + "\n");
}

/** The set's six actors, reusing stored keys and generating only missing roles. */
export function ensureActorSet(
  file: ActorsFile,
  set: SetName,
): { entries: ActorEntry[]; created: Role[] } {
  const existing = new Map((file.sets[set] ?? []).map((e) => [e.role, e]));
  const created: Role[] = [];
  const entries = ROLES.map(({ role, label }): ActorEntry => {
    const found = existing.get(role);
    if (found) {
      const kp = keypairFromJson(found.secretKey);
      return {
        role,
        label,
        publicKey: kp.publicKey.toBase58(),
        secretKey: found.secretKey,
      };
    }
    created.push(role);
    const kp = Keypair.generate();
    return {
      role,
      label,
      publicKey: kp.publicKey.toBase58(),
      secretKey: keypairToJson(kp),
    };
  });
  return { entries, created };
}

export type ActorKeys = Record<Role, Keypair>;

export function loadActorSet(set: SetName): ActorKeys {
  const entries = readActorsFile().sets[set];
  if (!entries || entries.length !== ROLES.length) {
    throw new Error(
      `no "${set}" actor set in ${ACTORS_PATH}; run node scripts/demo-setup.ts first`,
    );
  }
  const out = {} as ActorKeys;
  for (const e of entries) out[e.role] = keypairFromJson(e.secretKey);
  return out;
}

/** `VITE_DEMO_ACTORS` value: one-line JSON `[{ label, secretKey }, ...]` (Client, Worker, Arbiter 1-3, Passer-by). */
export function demoActorsEnvValue(entries: ActorEntry[]): string {
  // The app's contract: `{ label, secretKey }` only, in role order.
  return JSON.stringify(
    entries.map(({ label, secretKey }) => ({ label, secretKey })),
  );
}

export interface FaucetFile {
  mint: string;
  faucetPublicKey: string;
  /** Mint authority of tUSDC: a throwaway key that is embedded in the app on purpose. */
  faucetSecretKey: SecretKeyJson;
  createdAt: string;
}

export function readFaucetFile(): FaucetFile | undefined {
  if (!existsSync(FAUCET_PATH)) return undefined;
  return JSON.parse(readFileSync(FAUCET_PATH, "utf8")) as FaucetFile;
}

/** The tUSDC mint: `TUSDC_MINT`, else the one recorded by create-test-mint. */
export function resolveMint(): PublicKey {
  const fromEnv = env.tusdcMint();
  if (fromEnv) return fromEnv;
  const faucet = readFaucetFile();
  if (faucet) return new PublicKey(faucet.mint);
  throw new Error(
    "no tUSDC mint: set TUSDC_MINT or run node scripts/create-test-mint.ts",
  );
}

/** Quotes a value for a dotenv file (single quotes; the JSON values contain no single quote). */
export function dotenvLine(key: string, value: string): string {
  if (value.includes("'")) throw new Error(`${key} contains a single quote`);
  return /^[A-Za-z0-9_.:/@+-]*$/.test(value)
    ? `${key}=${value}`
    : `${key}='${value}'`;
}

/** Sets `updates` in a dotenv file's text, keeping every other line as it was. */
export function mergeDotenv(
  text: string,
  updates: Record<string, string>,
): string {
  const remaining = new Map(Object.entries(updates));
  const lines = text.split("\n").map((line) => {
    const key = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=/.exec(line)?.[1];
    if (key && remaining.has(key)) {
      const value = remaining.get(key) as string;
      remaining.delete(key);
      return dotenvLine(key, value);
    }
    return line;
  });
  while (lines.length && lines[lines.length - 1] === "") lines.pop();
  for (const [key, value] of remaining) lines.push(dotenvLine(key, value));
  return lines.join("\n") + "\n";
}
