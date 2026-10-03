// Mirror of `decide_outcome` in programs/milestone_escrow/src/instructions/settle_milestone.rs.
//
// The frontend and the crank script use it only to decide which button to show
// or which milestone to try to settle. The program re-checks everything, so a
// mistake here can at worst produce a failed transaction, never a wrong payout.
// Keep it line-for-line in sync with the Rust rule. No imports on purpose.

export type DealStatus = "open" | "active" | "cancelled";
export type MilestoneStatus =
  "pending" | "submitted" | "disputed" | "approved" | "settled";
export type Outcome = "workerPaid" | "clientRefunded" | "split" | "cancelled";

export const VOTE_NONE = 0;
export const VOTE_WORKER = 1;
export const VOTE_CLIENT = 2;

export interface MilestoneView {
  amount: bigint;
  depositLocked: bigint;
  status: MilestoneStatus;
  votes: number[];
  submitDeadline: number;
  reviewDeadline: number;
  voteDeadline: number;
}

export interface Payout {
  toWorker: bigint;
  toClient: bigint;
  outcome: Outcome;
}

export const workerVotes = (m: Pick<MilestoneView, "votes">) =>
  m.votes.filter((v) => v === VOTE_WORKER).length;
export const clientVotes = (m: Pick<MilestoneView, "votes">) =>
  m.votes.filter((v) => v === VOTE_CLIENT).length;
export const hasMajority = (m: Pick<MilestoneView, "votes">) =>
  workerVotes(m) >= 2 || clientVotes(m) >= 2;

/// Returns the payout `settle_milestone` would make right now, or `null` if it
/// would fail (already settled, or nothing to settle yet).
export function decideOutcome(
  dealStatus: DealStatus,
  m: MilestoneView,
  now: number,
): Payout | null {
  const withDeposit = m.amount + m.depositLocked;
  const toWorker = (outcome: Outcome): Payout => ({
    toWorker: withDeposit,
    toClient: 0n,
    outcome,
  });
  const toClient = (outcome: Outcome): Payout => ({
    toWorker: 0n,
    toClient: withDeposit,
    outcome,
  });

  if (m.status === "settled") return null; // 1
  if (m.status === "approved") return toWorker("workerPaid"); // 2
  if (m.status === "disputed" && workerVotes(m) >= 2)
    return toWorker("workerPaid"); // 3a
  if (m.status === "disputed" && clientVotes(m) >= 2)
    return toClient("clientRefunded"); // 3b
  if (dealStatus === "cancelled") return toClient("cancelled"); // 4
  if (m.status === "disputed" && now >= m.voteDeadline) {
    const clientHalf = m.amount / 2n; // 5: odd unit to the worker
    return {
      toWorker: m.amount - clientHalf,
      toClient: clientHalf + m.depositLocked,
      outcome: "split",
    };
  }
  if (m.status === "submitted" && now >= m.reviewDeadline)
    return { toWorker: m.amount, toClient: 0n, outcome: "workerPaid" }; // 6
  if (
    m.status === "pending" &&
    dealStatus === "active" &&
    now >= m.submitDeadline
  )
    return { toWorker: 0n, toClient: m.amount, outcome: "clientRefunded" }; // 7
  return null;
}
