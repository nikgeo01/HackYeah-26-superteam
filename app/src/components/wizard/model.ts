// Create-deal wizard: form state and validation. The validation mirrors the on-chain
// `create_deal` checks (INTERFACE 3.5) exactly, so the program never rejects a form we accept.
// It only saves the user a failed transaction; the program re-checks everything.
import type { PublicKey } from "@solana/web3.js";
import { IDL } from "../../lib/idl";
import {
  attestorBytes,
  type CreateDealInput,
  type MilestoneInputValue,
} from "../../lib/instructions";
import { parseAmount } from "../../lib/format";
import { toPublicKey } from "../../lib/pdas";

// ---------------------------------------------------------------- on-chain bounds

function idlConstant(name: string, fallback: number): number {
  const c = IDL.constants?.find((k) => k.name === name);
  const value = c ? Number(String(c.value).replace(/_/g, "")) : NaN;
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

/** Lower bound for every timer and due time (seconds). */
export const MIN_WINDOW_SECS = idlConstant("MIN_WINDOW_SECS", 10);
/** Upper bound for every timer and due time (365 days). */
export const MAX_WINDOW_SECS = idlConstant("MAX_WINDOW_SECS", 31_536_000);
/** Not IDL constants (Anchor cannot export usize); values from INTERFACE.md. */
export const MAX_MILESTONES = 5;
export const MAX_REPO_LEN = 80;
const U64_MAX = 2n ** 64n - 1n;
const U32_MAX = 2 ** 32 - 1;

// ---------------------------------------------------------------- durations

export type TimeUnit = "seconds" | "minutes" | "hours" | "days";
export const TIME_UNITS: readonly TimeUnit[] = [
  "seconds",
  "minutes",
  "hours",
  "days",
];
export const UNIT_SECS: Record<TimeUnit, number> = {
  seconds: 1,
  minutes: 60,
  hours: 3600,
  days: 86400,
};

export interface DurationDraft {
  value: string;
  unit: TimeUnit;
}

export const dur = (value: number, unit: TimeUnit): DurationDraft => ({
  value: String(value),
  unit,
});

/** Whole seconds, or null when the input is not a number or not a whole number of seconds. */
export function durationSecs(d: DurationDraft): number | null {
  const text = d.value.trim().replace(",", ".");
  if (!/^\d+(\.\d+)?$|^\.\d+$/.test(text)) return null;
  const secs = Number(text) * UNIT_SECS[d.unit];
  const rounded = Math.round(secs);
  if (Math.abs(secs - rounded) > 1e-6) return null;
  return rounded;
}

// ---------------------------------------------------------------- form state

export interface MilestoneDraft {
  /** Stable React key. */
  key: number;
  amount: string;
  due: DurationDraft;
  /** Pull request number, "" = none. */
  pr: string;
}

export interface DealDraft {
  worker: string;
  /** [client's pick, freelancer's pick, picked by both]. */
  judges: [string, string, string];
  milestones: MilestoneDraft[];
  accept: DurationDraft;
  review: DurationDraft;
  vote: DurationDraft;
  deposit: string;
  repo: string;
  attestor: string;
}

let nextKey = 1;
export function newMilestone(
  due: DurationDraft = dur(7, "days"),
): MilestoneDraft {
  return { key: nextKey++, amount: "", due, pr: "" };
}

export function initialDraft(defaultAttestor: string): DealDraft {
  return {
    worker: "",
    judges: ["", "", ""],
    milestones: [newMilestone()],
    accept: dur(3, "days"),
    review: dur(3, "days"),
    vote: dur(3, "days"),
    deposit: "",
    repo: "",
    attestor: defaultAttestor,
  };
}

/** "Demo timings" preset: accept 10 min, each milestone due 10 min, review 45 s, vote 60 s. */
export function withDemoTimings(d: DealDraft): DealDraft {
  return {
    ...d,
    accept: dur(10, "minutes"),
    review: dur(45, "seconds"),
    vote: dur(60, "seconds"),
    milestones: d.milestones.map((m) => ({ ...m, due: dur(10, "minutes") })),
  };
}

export const JUDGE_LABELS = [
  "Arbiter picked by you (the client)",
  "Arbiter picked by the freelancer",
  "Arbiter you both agree on",
] as const;

// ---------------------------------------------------------------- validation

/**
 * Field keys: "worker", "judge0".."judge2", "milestones", "m<key>.amount", "m<key>.due",
 * "m<key>.pr", "accept", "review", "vote", "deposit", "repo", "attestor".
 */
export type Errors = Record<string, string>;

export const PEOPLE_FIELDS = (k: string) =>
  k === "worker" || k.startsWith("judge") || k === "client";

const REPO_RE = /^[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+$/;

export function repoError(repo: string): string | null {
  if (repo === "") return null;
  if (new TextEncoder().encode(repo).length > MAX_REPO_LEN)
    return `At most ${MAX_REPO_LEN} characters.`;
  if (!REPO_RE.test(repo))
    return 'Use the form "owner/name" (letters, digits, ".", "_" and "-" only).';
  return null;
}

function windowError(d: DurationDraft): string | null {
  const secs = durationSecs(d);
  if (secs === null) return "Enter a whole number of seconds.";
  if (secs < MIN_WINDOW_SECS) return `At least ${MIN_WINDOW_SECS} seconds.`;
  if (secs > MAX_WINDOW_SECS) return "At most 365 days.";
  return null;
}

/** A checked `CreateDealInput` without the id (generated at submit), every field filled in. */
export type DealInputDraft = Omit<CreateDealInput, "dealId" | "milestones"> & {
  milestones: Required<MilestoneInputValue>[];
};

export interface Validated {
  errors: Errors;
  /** Set only when there are no errors and the client is known. */
  input: DealInputDraft | null;
  total: bigint;
}

/** Validates the whole draft in the on-chain order (3.5). `client` is the active signer. */
export function validateDraft(
  d: DealDraft,
  client: PublicKey | null,
): Validated {
  const errors: Errors = {};

  // 1. Milestone count.
  if (d.milestones.length < 1 || d.milestones.length > MAX_MILESTONES)
    errors.milestones = `A deal has 1 to ${MAX_MILESTONES} milestones.`;

  // 2. Amounts > 0, 6 decimals, total fits in u64.
  let total = 0n;
  const amounts = d.milestones.map((m) => {
    const raw = parseAmount(m.amount);
    if (raw === null)
      errors[`m${m.key}.amount`] =
        "Enter an amount, with at most 6 decimals.";
    else if (raw <= 0n) errors[`m${m.key}.amount`] = "Must be more than 0.";
    else total += raw;
    return raw ?? 0n;
  });
  if (total > U64_MAX) errors.milestones = "The total is too large.";

  // 3. Windows and due times within bounds.
  for (const [k, w] of [
    ["accept", d.accept],
    ["review", d.review],
    ["vote", d.vote],
  ] as const) {
    const e = windowError(w);
    if (e) errors[k] = e;
  }
  for (const m of d.milestones) {
    const e = windowError(m.due);
    if (e) errors[`m${m.key}.due`] = e;
  }

  // 4. Identity.
  const worker = toPublicKey(d.worker.trim());
  if (!d.worker.trim()) errors.worker = "Enter the freelancer's address.";
  else if (!worker) errors.worker = "This is not a valid Solana address.";
  else if (client && worker.equals(client))
    errors.worker = "The freelancer cannot be you (the client).";
  const judges = d.judges.map((j) => toPublicKey(j.trim()));
  judges.forEach((j, i) => {
    const key = `judge${i}`;
    if (!d.judges[i].trim()) errors[key] = "Enter this arbiter's address.";
    else if (!j) errors[key] = "This is not a valid Solana address.";
    else if (client && j.equals(client))
      errors[key] = "An arbiter cannot be the client.";
    else if (worker && j.equals(worker))
      errors[key] = "An arbiter cannot be the freelancer.";
    else if (judges.slice(0, i).some((o) => o && o.equals(j)))
      errors[key] = "Each arbiter must be a different person.";
  });

  // 5. Repository.
  const repo = d.repo.trim();
  const rErr = repoError(repo);
  if (rErr) errors.repo = rErr;

  // Attestor format (decoded with the shared helper).
  let attestor: number[] = new Array<number>(20).fill(0);
  try {
    attestor = attestorBytes(d.attestor);
  } catch (e) {
    errors.attestor = (e as Error).message;
  }
  const attestorSet = attestor.some((b) => b !== 0);

  // 6. Proof fields, 7. distinct PR numbers.
  const seen = new Set<number>();
  const prs = d.milestones.map((m) => {
    const text = m.pr.trim().replace(/^#/, "");
    if (text === "") return 0;
    const key = `m${m.key}.pr`;
    const n = /^\d+$/.test(text) ? Number(text) : NaN;
    if (!Number.isInteger(n) || n <= 0 || n > U32_MAX) {
      errors[key] = "A pull request number is a whole number above 0.";
      return 0;
    }
    if (!repo)
      errors[key] = "Enter the repository first (step 2, GitHub section).";
    else if (!attestorSet && !errors.attestor)
      errors[key] = "Pull request release needs an attestor (Advanced).";
    if (seen.has(n)) errors[key] = "Each milestone needs its own pull request.";
    seen.add(n);
    return n;
  });

  // 8. Deposit may be zero.
  const depositRaw = d.deposit.trim() === "" ? 0n : parseAmount(d.deposit);
  if (depositRaw === null)
    errors.deposit = "Enter an amount, with at most 6 decimals (or 0).";
  else if (depositRaw > U64_MAX) errors.deposit = "Too large.";

  const ok = Object.keys(errors).length === 0;
  const input: DealInputDraft | null =
    ok && client && worker && judges.every(Boolean)
      ? {
          worker,
          judges: judges as [PublicKey, PublicKey, PublicKey],
          acceptWindowSecs: durationSecs(d.accept)!,
          reviewWindowSecs: durationSecs(d.review)!,
          voteWindowSecs: durationSecs(d.vote)!,
          disputeDeposit: depositRaw ?? 0n,
          proofAttestor: attestor,
          proofRepo: repo,
          milestones: d.milestones.map((m, i) => ({
            amount: amounts[i],
            dueSecs: durationSecs(m.due)!,
            proofKind: prs[i] > 0 ? ("prMerged" as const) : ("off" as const),
            proofRef: prs[i],
          })),
        }
      : null;
  return { errors, input, total };
}
