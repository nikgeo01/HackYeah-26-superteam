// TypeScript mirror of `decide_outcome` (PLAN.md 3.6), used to decide which button to show
// and what the crank script should try. The program re-checks everything; nothing here is trusted.
// Provisional copy until Dev A's `client/rules.ts` lands. No imports, so the app and Node
// scripts can both use it.

export type DealStatusName = "open" | "active" | "cancelled";
export type MilestoneStatusName = "pending" | "submitted" | "disputed" | "approved" | "settled";
export type OutcomeName = "unset" | "workerPaid" | "clientRefunded" | "split" | "cancelled";
export type SideName = "worker" | "client";

export const VOTE_NONE = 0;
export const VOTE_WORKER = 1;
export const VOTE_CLIENT = 2;

export interface MilestoneLike {
  amount: bigint;
  status: MilestoneStatusName;
  votes: readonly number[];
  submitDeadline: number;
  reviewDeadline: number;
  voteDeadline: number;
  depositLocked: bigint;
}

export interface Payout {
  toWorker: bigint;
  toClient: bigint;
  outcome: OutcomeName;
}

export type Decision =
  | { ok: true; payout: Payout }
  | { ok: false; error: "AlreadySettled" | "NothingToSettle" };

export function voteTally(votes: readonly number[]): { worker: number; client: number } {
  let worker = 0;
  let client = 0;
  for (const v of votes) {
    if (v === VOTE_WORKER) worker++;
    else if (v === VOTE_CLIENT) client++;
  }
  return { worker, client };
}

/** The side with two or more votes, or null. */
export function majority(votes: readonly number[]): SideName | null {
  const t = voteTally(votes);
  if (t.worker >= 2) return "worker";
  if (t.client >= 2) return "client";
  return null;
}

/** True when casting `side` in slot `judgeIndex` creates a 2-vote majority (bundle the vote with settle). */
export function voteDecides(votes: readonly number[], judgeIndex: number, side: SideName): boolean {
  if (majority(votes) !== null || votes[judgeIndex] !== VOTE_NONE) return false;
  const next = votes.slice();
  next[judgeIndex] = side === "worker" ? VOTE_WORKER : VOTE_CLIENT;
  return majority(next) !== null;
}

/** Rows of PLAN.md 3.6, first match wins. `now` is chain time in unix seconds. */
export function decideOutcome(dealStatus: DealStatusName, m: MilestoneLike, now: number): Decision {
  const amount = m.amount;
  const deposit = m.depositLocked;
  const pay = (toWorker: bigint, toClient: bigint, outcome: OutcomeName): Decision => ({
    ok: true,
    payout: { toWorker, toClient, outcome },
  });

  if (m.status === "settled") return { ok: false, error: "AlreadySettled" };
  if (m.status === "approved") return pay(amount + deposit, 0n, "workerPaid");
  if (m.status === "disputed") {
    const won = majority(m.votes);
    if (won === "worker") return pay(amount + deposit, 0n, "workerPaid");
    if (won === "client") return pay(0n, amount + deposit, "clientRefunded");
  }
  if (dealStatus === "cancelled") return pay(0n, amount + deposit, "cancelled");
  if (m.status === "disputed" && now >= m.voteDeadline) {
    const half = amount / 2n;
    return pay(amount - half, half + deposit, "split");
  }
  if (m.status === "submitted" && now >= m.reviewDeadline) return pay(amount, 0n, "workerPaid");
  if (m.status === "pending" && dealStatus === "active" && now >= m.submitDeadline) {
    return pay(0n, amount, "clientRefunded");
  }
  return { ok: false, error: "NothingToSettle" };
}

/**
 * The chain time from which a crank (settle by anyone) becomes possible for a milestone that is
 * not settleable yet, or null when no timer will make it settleable on its own.
 */
export function settleOpensAt(dealStatus: DealStatusName, m: MilestoneLike): number | null {
  if (dealStatus === "cancelled" || m.status === "settled" || m.status === "approved") return null;
  if (m.status === "disputed") return majority(m.votes) ? null : m.voteDeadline;
  if (m.status === "submitted") return m.reviewDeadline;
  if (m.status === "pending" && dealStatus === "active") return m.submitDeadline;
  return null;
}
