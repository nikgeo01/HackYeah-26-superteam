// App-only helpers on top of the shared payout-rule mirror (client/rules.ts).
// They only decide which button to show; the program re-checks everything.
import {
  decideOutcome,
  hasMajority,
  VOTE_CLIENT,
  VOTE_NONE,
  VOTE_WORKER,
  type DealStatus,
  type MilestoneView,
  type Payout,
} from "@client/rules";
import type { DealView } from "./deals";

export type SideName = "worker" | "client";

/** Seconds after a deadline before crank buttons enable (devnet clock drift, PLAN 4.5). */
export const CRANK_BUFFER_SECS = 3;

/** Hypothetical changes applied before evaluating the rule (for bundled transactions). */
export interface Assume {
  dealStatus?: DealStatus;
  milestone?: Partial<MilestoneView>;
}

/** What `settle_milestone(index)` would pay right now, or null if it would fail. */
export function payoutFor(
  deal: DealView,
  index: number,
  now: number,
  assume: Assume = {},
): Payout | null {
  const m = deal.milestones[index];
  if (!m) return null;
  return decideOutcome(
    assume.dealStatus ?? deal.status,
    { ...m, ...assume.milestone },
    now,
  );
}

/** Votes after `judgeIndex` votes for `side`. */
export function votesAfter(
  votes: readonly number[],
  judgeIndex: number,
  side: SideName,
): number[] {
  const next = votes.slice();
  next[judgeIndex] = side === "worker" ? VOTE_WORKER : VOTE_CLIENT;
  return next;
}

/** True when this vote creates a 2-vote majority, so the vote should be bundled with settle. */
export function voteDecides(
  votes: readonly number[],
  judgeIndex: number,
  side: SideName,
): boolean {
  if (hasMajority({ votes: [...votes] }) || votes[judgeIndex] !== VOTE_NONE)
    return false;
  return hasMajority({ votes: votesAfter(votes, judgeIndex, side) });
}

/**
 * Chain time from which a timer makes this milestone settleable by anyone, or null when no
 * timer applies (already decided, settled, or waiting for a human).
 */
export function settleOpensAt(
  dealStatus: DealStatus,
  m: MilestoneView,
): number | null {
  if (
    dealStatus === "cancelled" ||
    m.status === "settled" ||
    m.status === "approved"
  )
    return null;
  if (m.status === "disputed") return hasMajority(m) ? null : m.voteDeadline;
  if (m.status === "submitted") return m.reviewDeadline;
  if (m.status === "pending" && dealStatus === "active")
    return m.submitDeadline;
  return null;
}

/** True when a crank button should be enabled: the rule pays and the safety buffer has passed. */
export function crankReady(
  deal: DealView,
  index: number,
  now: number,
): boolean {
  const m = deal.milestones[index];
  if (!m) return false;
  const opens = settleOpensAt(deal.status, m);
  const buffered = opens === null ? now : now - CRANK_BUFFER_SECS;
  return payoutFor(deal, index, buffered) !== null;
}

/** Indexes of milestones settleable right now (for "Withdraw all" and the cancel bundle). */
export function settleableIndexes(
  deal: DealView,
  now: number,
  assume: Omit<Assume, "milestone"> = {},
): number[] {
  return deal.milestones
    .filter((m) => payoutFor(deal, m.index, now, assume) !== null)
    .map((m) => m.index);
}
