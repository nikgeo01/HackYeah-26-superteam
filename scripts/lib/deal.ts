// Reading deals and chain time, and normalising a decoded Deal into plain
// values (bigint amounts, string enum names) that `client/rules.ts` accepts.
import type { IdlAccounts } from "@anchor-lang/core";
import { Connection, PublicKey, SYSVAR_CLOCK_PUBKEY } from "@solana/web3.js";
import type { MilestoneEscrow } from "../../client/program.ts";
import { DEAL_ACCOUNT_SIZE } from "../../client/pdas.ts";
import type {
  DealStatus,
  MilestoneStatus,
  MilestoneView,
} from "../../client/rules.ts";
import type { EscrowProgram } from "./program.ts";

export type DecodedDeal = IdlAccounts<MilestoneEscrow>["deal"];

export type ProofKindName = "off" | "prMerged" | "checkRun";
export type OutcomeName =
  "unset" | "workerPaid" | "clientRefunded" | "split" | "cancelled";

export interface MilestoneInfo extends MilestoneView {
  index: number;
  outcome: OutcomeName;
  proofKind: ProofKindName;
  proofRef: number;
  dueSecs: number;
  submittedAt: number;
}

export interface DealInfo {
  address: PublicKey;
  client: PublicKey;
  worker: PublicKey;
  judges: [PublicKey, PublicKey, PublicKey];
  mint: PublicKey;
  dealId: bigint;
  status: DealStatus;
  cancelFlags: number;
  settledCount: number;
  createdAt: number;
  acceptDeadline: number;
  acceptedAt: number;
  reviewWindowSecs: number;
  voteWindowSecs: number;
  disputeDeposit: bigint;
  /** 20 bytes; all zero means proofs are disabled. */
  proofAttestor: Uint8Array;
  proofRepo: string;
  milestones: MilestoneInfo[];
}

/** Anchor decodes enums as `{ variantName: {} }`; this returns the variant name. */
export function enumName<T extends string>(value: object): T {
  const keys = Object.keys(value);
  if (keys.length !== 1)
    throw new Error(`not an enum value: ${JSON.stringify(value)}`);
  return keys[0] as T;
}

const big = (n: { toString(): string }): bigint => BigInt(n.toString());
const num = (n: { toString(): string }): number => Number(n.toString());

export function normaliseDeal(address: PublicKey, d: DecodedDeal): DealInfo {
  return {
    address,
    client: d.client,
    worker: d.worker,
    judges: [d.judges[0], d.judges[1], d.judges[2]],
    mint: d.mint,
    dealId: big(d.dealId),
    status: enumName<DealStatus>(d.status),
    cancelFlags: d.cancelFlags,
    settledCount: d.settledCount,
    createdAt: num(d.createdAt),
    acceptDeadline: num(d.acceptDeadline),
    acceptedAt: num(d.acceptedAt),
    reviewWindowSecs: d.reviewWindowSecs,
    voteWindowSecs: d.voteWindowSecs,
    disputeDeposit: big(d.disputeDeposit),
    proofAttestor: Uint8Array.from(d.proofAttestor),
    proofRepo: d.proofRepo,
    milestones: d.milestones.map((m, index) => ({
      index,
      amount: big(m.amount),
      depositLocked: big(m.depositLocked),
      status: enumName<MilestoneStatus>(m.status),
      outcome: enumName<OutcomeName>(m.outcome),
      proofKind: enumName<ProofKindName>(m.proofKind),
      votes: Array.from(m.votes),
      proofRef: m.proofRef,
      dueSecs: m.dueSecs,
      submitDeadline: num(m.submitDeadline),
      submittedAt: num(m.submittedAt),
      reviewDeadline: num(m.reviewDeadline),
      voteDeadline: num(m.voteDeadline),
    })),
  };
}

export async function fetchDeal(
  program: EscrowProgram,
  address: PublicKey,
): Promise<DealInfo> {
  return normaliseDeal(address, await program.account.deal.fetch(address));
}

/**
 * Every deal of the program in one request (`dataSize` filter, PLAN 4.5).
 * Accounts that fail to decode (an older layout) are skipped.
 */
export async function fetchAllDeals(
  connection: Connection,
  program: EscrowProgram,
): Promise<DealInfo[]> {
  const accounts = await connection.getProgramAccounts(program.programId, {
    commitment: "confirmed",
    filters: [{ dataSize: DEAL_ACCOUNT_SIZE }],
  });
  const deals: DealInfo[] = [];
  for (const { pubkey, account } of accounts) {
    try {
      const decoded = program.coder.accounts.decode<DecodedDeal>(
        "deal",
        account.data,
      );
      deals.push(normaliseDeal(pubkey, decoded));
    } catch {
      // not a current-layout Deal
    }
  }
  return deals;
}

/** Clock sysvar layout: slot, epoch_start_timestamp, epoch, leader_schedule_epoch, unix_timestamp. */
const CLOCK_UNIX_TIMESTAMP_OFFSET = 32;

/** The unix time the program sees (`Clock::get()?.unix_timestamp`). */
export async function chainNow(connection: Connection): Promise<number> {
  const clock = await connection.getAccountInfo(
    SYSVAR_CLOCK_PUBKEY,
    "confirmed",
  );
  if (clock === null) throw new Error("the Clock sysvar is unreadable");
  return Number(clock.data.readBigInt64LE(CLOCK_UNIX_TIMESTAMP_OFFSET));
}

/** Polls chain time (not the wall clock) until it reaches `target`. */
export async function waitForChainTime(
  connection: Connection,
  target: number,
  onTick?: (now: number) => void,
  pollMs = 3000,
): Promise<number> {
  for (;;) {
    const now = await chainNow(connection);
    if (now >= target) return now;
    onTick?.(now);
    await new Promise((resolve) =>
      setTimeout(
        resolve,
        Math.min(pollMs, Math.max(500, (target - now) * 1000)),
      ),
    );
  }
}

/** Lowercase hex of the deal address bytes, as used in the proof binding string. */
export const dealHex = (deal: PublicKey): string =>
  Buffer.from(deal.toBytes()).toString("hex");

export const hasProofAttestor = (
  deal: Pick<DealInfo, "proofAttestor">,
): boolean => deal.proofAttestor.some((b) => b !== 0);
