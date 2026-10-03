// Fetching and normalising Deal accounts (PLAN 4.5). Pages only ever see `DealView`.
import type { Program } from "@anchor-lang/core";
import { PublicKey } from "@solana/web3.js";
import type { DealStatus, MilestoneStatus, MilestoneView } from "@client/rules";
import { DEAL_ACCOUNT_SIZE } from "@client/pdas";
import type { MilestoneEscrow } from "./idl";
import { enumName, toBigInt } from "./format";

export const CANCEL_FLAG_CLIENT = 0b01;
export const CANCEL_FLAG_WORKER = 0b10;

export type OutcomeName =
  "unset" | "workerPaid" | "clientRefunded" | "split" | "cancelled";
export type ProofKindName = "off" | "prMerged" | "checkRun";
export type Role = "client" | "worker" | "arbiter" | "stranger";

/** One milestone, normalised. Extends the shared `MilestoneView` so it feeds `decideOutcome` directly. */
export interface MilestoneInfo extends MilestoneView {
  index: number;
  outcome: OutcomeName;
  proofKind: ProofKindName;
  /** Pull request number, 0 = none. */
  proofRef: number;
  dueSecs: number;
  submittedAt: number;
  deliverableHash: Uint8Array;
}

/** A Deal account, normalised: bigint amounts, number (unix seconds) deadlines, string enums. */
export interface DealView {
  address: PublicKey;
  client: PublicKey;
  worker: PublicKey;
  /** [client's pick, worker's pick, mutual]. */
  judges: [PublicKey, PublicKey, PublicKey];
  mint: PublicKey;
  dealId: bigint;
  status: DealStatus;
  bump: number;
  vaultBump: number;
  cancelFlags: number;
  settledCount: number;
  createdAt: number;
  acceptDeadline: number;
  /** 0 until accepted. */
  acceptedAt: number;
  reviewWindowSecs: number;
  voteWindowSecs: number;
  disputeDeposit: bigint;
  /** 20-byte Ethereum-style attestor address; all zero = proofs disabled. */
  proofAttestor: Uint8Array;
  /** "owner/name" or "". */
  proofRepo: string;
  milestones: MilestoneInfo[];
  /** Sum of all milestone amounts. */
  total: bigint;
}

/** BN, number or bigint from the coder. */
type Numberish = { toString(): string };
const num = (v: Numberish): number => Number(v.toString());
const big = (v: Numberish): bigint => toBigInt(v.toString());

/* eslint-disable @typescript-eslint/no-explicit-any -- decode boundary */
/** Turns the object returned by the Anchor coder into a `DealView`. */
export function normalizeDeal(address: PublicKey, raw: any): DealView {
  const milestones: MilestoneInfo[] = (raw.milestones as any[]).map(
    (m, index) => ({
      index,
      amount: big(m.amount),
      depositLocked: big(m.depositLocked),
      status: enumName(m.status) as MilestoneStatus,
      votes: Array.from(m.votes as ArrayLike<number>),
      submitDeadline: num(m.submitDeadline),
      reviewDeadline: num(m.reviewDeadline),
      voteDeadline: num(m.voteDeadline),
      outcome: enumName(m.outcome) as OutcomeName,
      proofKind: enumName(m.proofKind) as ProofKindName,
      proofRef: num(m.proofRef),
      dueSecs: num(m.dueSecs),
      submittedAt: num(m.submittedAt),
      deliverableHash: Uint8Array.from(m.deliverableHash as ArrayLike<number>),
    }),
  );
  const judges = (raw.judges as PublicKey[]).map((k) => new PublicKey(k));
  return {
    address,
    client: new PublicKey(raw.client),
    worker: new PublicKey(raw.worker),
    judges: [judges[0], judges[1], judges[2]],
    mint: new PublicKey(raw.mint),
    dealId: big(raw.dealId),
    status: enumName(raw.status) as DealStatus,
    bump: num(raw.bump),
    vaultBump: num(raw.vaultBump),
    cancelFlags: num(raw.cancelFlags),
    settledCount: num(raw.settledCount),
    createdAt: num(raw.createdAt),
    acceptDeadline: num(raw.acceptDeadline),
    acceptedAt: num(raw.acceptedAt),
    reviewWindowSecs: num(raw.reviewWindowSecs),
    voteWindowSecs: num(raw.voteWindowSecs),
    disputeDeposit: big(raw.disputeDeposit),
    proofAttestor: Uint8Array.from(raw.proofAttestor as ArrayLike<number>),
    proofRepo: String(raw.proofRepo ?? ""),
    milestones,
    total: milestones.reduce((sum, m) => sum + m.amount, 0n),
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/** Decodes raw account data; null when it is not a (current-layout) Deal. */
export function decodeDeal(
  program: Program<MilestoneEscrow>,
  address: PublicKey,
  data: Uint8Array,
): DealView | null {
  try {
    return normalizeDeal(
      address,
      program.coder.accounts.decode("deal", Buffer.from(data)),
    );
  } catch {
    return null;
  }
}

/** One deal; null if the account does not exist or is not a Deal. */
export async function fetchDeal(
  program: Program<MilestoneEscrow>,
  address: PublicKey,
): Promise<DealView | null> {
  const info = await program.provider.connection.getAccountInfo(
    address,
    "confirmed",
  );
  if (!info || !info.owner.equals(program.programId)) return null;
  return decodeDeal(program, address, info.data);
}

/** Every current-layout deal of the program, in one request (filtered by size). Newest first. */
export async function fetchAllDeals(
  program: Program<MilestoneEscrow>,
): Promise<DealView[]> {
  const accounts = await program.provider.connection.getProgramAccounts(
    program.programId,
    {
      commitment: "confirmed",
      filters: [{ dataSize: DEAL_ACCOUNT_SIZE }],
    },
  );
  const deals: DealView[] = [];
  for (const { pubkey, account } of accounts) {
    const deal = decodeDeal(program, pubkey, account.data);
    if (deal) deals.push(deal);
  }
  return deals.sort((a, b) => b.createdAt - a.createdAt);
}

/** Arbiter slot (0, 1, 2) of `who` in this deal, or -1. */
export function judgeIndex(
  deal: DealView,
  who: PublicKey | null | undefined,
): number {
  if (!who) return -1;
  return deal.judges.findIndex((j) => j.equals(who));
}

/** The role `who` has in this deal. Client and worker can never be arbiters (DuplicateParty). */
export function roleIn(
  deal: DealView,
  who: PublicKey | null | undefined,
): Role {
  if (!who) return "stranger";
  if (deal.client.equals(who)) return "client";
  if (deal.worker.equals(who)) return "worker";
  if (judgeIndex(deal, who) >= 0) return "arbiter";
  return "stranger";
}

export interface DealsByRole {
  paying: DealView[];
  working: DealView[];
  arbiter: DealView[];
}

/** Splits a deal list into the three tabs of `/deals`. */
export function splitByRole(
  deals: DealView[],
  who: PublicKey | null | undefined,
): DealsByRole {
  const out: DealsByRole = { paying: [], working: [], arbiter: [] };
  if (!who) return out;
  for (const d of deals) {
    const role = roleIn(d, who);
    if (role === "client") out.paying.push(d);
    else if (role === "worker") out.working.push(d);
    else if (role === "arbiter") out.arbiter.push(d);
  }
  return out;
}

/** Cancel requests on an Active deal. */
export function cancelRequests(deal: DealView): {
  client: boolean;
  worker: boolean;
} {
  return {
    client: (deal.cancelFlags & CANCEL_FLAG_CLIENT) !== 0,
    worker: (deal.cancelFlags & CANCEL_FLAG_WORKER) !== 0,
  };
}

/** True when every milestone is settled, so `close_deal` can run. */
export function isFullySettled(deal: DealView): boolean {
  return deal.settledCount === deal.milestones.length;
}

/** True when the deal has a non-zero proof attestor (proof release possible). */
export function proofsEnabled(deal: DealView): boolean {
  return deal.proofAttestor.some((b) => b !== 0);
}
