// Demo actors (ADR-10): throwaway devnet keys embedded in the page, only when VITE_DEMO_MODE=true.
import {
  Transaction,
  VersionedTransaction,
  type Keypair,
  type PublicKey,
} from "@solana/web3.js";
import { DEMO_ACTORS_RAW, DEMO_MODE } from "./env";
import { tryParseSecretKey } from "./keys";
import type { TxSigner } from "./tx";

export type DemoRoleId =
  "client" | "worker" | "arbiter1" | "arbiter2" | "arbiter3" | "passerby";

export interface DemoRole {
  id: DemoRoleId;
  label: string;
  /** Tailwind classes for the role tag (roles differ by shape mark, not hue; see RoleMark). */
  badge: string;
  /** Plain explanation shown on /demo. */
  blurb: string;
}

export const DEMO_ROLES: readonly DemoRole[] = [
  {
    id: "client",
    label: "Client",
    badge: "border-ink/60 text-ink",
    blurb: "The startup paying for the work.",
  },
  {
    id: "worker",
    label: "Worker",
    badge: "border-ink/60 text-ink",
    blurb: "Kasia, the freelance developer.",
  },
  {
    id: "arbiter1",
    label: "Arbiter 1",
    badge: "border-ink/60 text-ink",
    blurb: "Picked by the client.",
  },
  {
    id: "arbiter2",
    label: "Arbiter 2",
    badge: "border-ink/60 text-ink",
    blurb: "Picked by the freelancer.",
  },
  {
    id: "arbiter3",
    label: "Arbiter 3",
    badge: "border-ink/60 text-ink",
    blurb: "Picked by both.",
  },
  {
    id: "passerby",
    label: "Passer-by",
    badge: "border-ink/60 text-ink",
    blurb: "A stranger with no part in the deal.",
  },
];

export const WALLET_BADGE = "border-ink/60 text-ink";

/** Shown wherever demo mode is on (ADR-10 security framing). */
export const DEMO_SECURITY_NOTE =
  "Demo mode embeds throwaway devnet keys in the page so one person can play all roles. These keys are public by design and hold only test tokens. A real deployment would ship without demo mode.";

export interface DemoActor extends DemoRole {
  keypair: Keypair;
  publicKey: PublicKey;
}

function roleIdFor(label: string): DemoRoleId | null {
  const key = label.toLowerCase().replace(/[^a-z0-9]/g, "");
  const aliases: Record<string, DemoRoleId> = {
    client: "client",
    worker: "worker",
    freelancer: "worker",
    arbiter1: "arbiter1",
    arbiter2: "arbiter2",
    arbiter3: "arbiter3",
    judge1: "arbiter1",
    judge2: "arbiter2",
    judge3: "arbiter3",
    passerby: "passerby",
    stranger: "passerby",
  };
  return aliases[key] ?? null;
}

/**
 * Parses VITE_DEMO_ACTORS. Accepted shapes (secret keys as JSON byte arrays or base58):
 *   { "Client": [..], "Worker": "base58", "Arbiter 1": [..], ... }
 *   [{ "label": "Client", "secretKey": [..] }, ...]   (also "secret" or "key")
 * Unknown labels and unreadable keys are skipped with a console warning.
 */
export function parseDemoActors(raw: string): DemoActor[] {
  if (!raw) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    console.warn("VITE_DEMO_ACTORS is not valid JSON", err);
    return [];
  }
  const entries: [string, unknown][] = Array.isArray(parsed)
    ? (parsed as Record<string, unknown>[]).map((e) => [
        String(e.label ?? e.role ?? e.name ?? ""),
        e.secretKey ?? e.secret ?? e.key,
      ])
    : Object.entries((parsed ?? {}) as Record<string, unknown>);
  const found = new Map<DemoRoleId, DemoActor>();
  for (const [label, secret] of entries) {
    const id = roleIdFor(label);
    if (!id) {
      console.warn(`Unknown demo actor label "${label}"`);
      continue;
    }
    const keypair = tryParseSecretKey(secret, `demo actor ${label}`);
    if (!keypair) continue;
    const role = DEMO_ROLES.find((r) => r.id === id)!;
    found.set(id, { ...role, keypair, publicKey: keypair.publicKey });
  }
  return DEMO_ROLES.flatMap((r) => (found.has(r.id) ? [found.get(r.id)!] : []));
}

/** The demo actors of this build (empty unless demo mode is on). */
export const DEMO_ACTORS: readonly DemoActor[] = DEMO_MODE
  ? parseDemoActors(DEMO_ACTORS_RAW)
  : [];

function signWith<T extends Transaction | VersionedTransaction>(
  tx: T,
  kp: Keypair,
): T {
  if (tx instanceof VersionedTransaction) tx.sign([kp]);
  else tx.partialSign(kp);
  return tx;
}

/** A `TxSigner` backed by a local keypair (no prompt). */
export function keypairSigner(kp: Keypair): TxSigner {
  return {
    publicKey: kp.publicKey,
    signTransaction: async (tx) => signWith(tx, kp),
    signAllTransactions: async (txs) => txs.map((tx) => signWith(tx, kp)),
  };
}
