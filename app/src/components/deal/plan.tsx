// What a milestone looks like to one viewer right now: its phase, its state sentence, which
// buttons to show and whether that is "your move". Display decisions only; the program decides
// every outcome. The if-chain mirrors PLAN 4.3 and must stay in the same order.
import type { ReactNode } from "react";
import { hasMajority, VOTE_NONE, workerVotes } from "@client/rules";
import { proofsEnabled, type DealView, type MilestoneInfo, type Role } from "../../lib/deals";
import { crankReady, payoutFor } from "../../lib/outcomes";
import { formatAmount, formatDuration } from "../../lib/format";
import type { NodeState } from "../ui";
import { Countdown } from "./Countdown";
import type { MilestoneReceipt } from "./common";

export type ActionKind =
  | "cancelledPayout"
  | "returnToClient"
  | "deliver"
  | "approve"
  | "object"
  | "vote"
  | "concede"
  | "decidedPayout"
  | "split"
  | "approvedPayout"
  | "linkPr";

export interface Move {
  /** Higher wins when picking the one "Your move" for the page. */
  priority: number;
  /** What to do, in one sentence. */
  text: ReactNode;
  /** Optional second line: what happens if you do nothing, and when. */
  hint?: ReactNode;
  /** True when the action lives in the release moment of the row, not in portable buttons. */
  release?: boolean;
  /** Only this viewer can do it (deliver, approve or object, vote). */
  personal?: boolean;
}

export interface NextEvent {
  at: number;
  text: string;
}

export interface MilestonePlan {
  phases: string[];
  current: number;
  progress?: number;
  urgent: boolean;
  node: NodeState;
  /** The state sentence: what is true now, then what happens next and when. */
  sentence: ReactNode;
  /** Shows a spinner before the sentence (waiting for the network clock). */
  waiting: boolean;
  /** Buttons that answer this state (rendered by the row, or moved into "Your move"). */
  actions: ActionKind[];
  /** Optional, secondary controls that always stay in the row. */
  extras: ActionKind[];
  /** The review timer is over and anyone may release (the release moment). */
  releaseReady: boolean;
  move: Move | null;
  next: NextEvent | null;
  stamp: string | null;
}

const PAID_PHASES = ["Locked", "Delivered", "In review", "Paid"];
const DISPUTE_PHASES = ["Delivered", "Objection", "Voting", "Decided"];

const clamp = (x: number) => Math.max(0, Math.min(1, x));
const elapsed = (deadline: number, windowSecs: number, now: number) =>
  windowSecs > 0 ? clamp(1 - (deadline - now) / windowSecs) : 1;

function when(deadline: number, now: number): ReactNode {
  return <Countdown deadline={deadline} now={now} className="font-semibold" />;
}

/** True when this milestone went through an objection (votes cast or deposit locked). */
function wasDisputed(m: MilestoneInfo): boolean {
  return m.status === "disputed" || m.outcome === "split" || m.votes.some((v) => v !== VOTE_NONE);
}

export function stampFor(m: MilestoneInfo, receipt?: MilestoneReceipt): string | null {
  if (m.status !== "settled") return null;
  switch (m.outcome) {
    case "workerPaid":
      return receipt?.kind === "silence" ? "Paid by rule" : "Paid";
    case "clientRefunded":
      return "Refunded";
    case "split":
      return "Split 50/50";
    case "cancelled":
      return "Refunded, deal cancelled";
    default:
      return "Paid out";
  }
}

export function planMilestone(
  deal: DealView,
  m: MilestoneInfo,
  role: Role,
  arbiterSlot: number,
  now: number,
  receipt?: MilestoneReceipt,
): MilestonePlan {
  const n = m.index + 1;
  const ready = crankReady(deal, m.index, now);
  const payout = ready ? payoutFor(deal, m.index, now) : null;
  const canLinkPr =
    role === "client" &&
    deal.status !== "cancelled" &&
    deal.proofRepo !== "" &&
    proofsEnabled(deal) &&
    m.proofKind === "off" &&
    (m.status === "pending" || m.status === "submitted");

  const plan: MilestonePlan = {
    phases: PAID_PHASES,
    current: 0,
    urgent: false,
    node: "open",
    sentence: null,
    waiting: false,
    actions: [],
    extras: canLinkPr ? ["linkPr"] : [],
    releaseReady: false,
    move: null,
    next: null,
    stamp: null,
  };
  const disputed = wasDisputed(m);
  if (disputed) plan.phases = DISPUTE_PHASES;

  // ---------------------------------------------------------------- per state
  if (m.status === "settled") {
    const refunded = m.outcome === "clientRefunded" || m.outcome === "cancelled";
    const last = m.outcome === "split" ? "Split" : refunded ? "Refunded" : "Paid";
    plan.phases = disputed
      ? [...DISPUTE_PHASES.slice(0, 3), last]
      : m.outcome === "cancelled"
        ? ["Locked", "Cancelled", "Refunded"]
        : refunded
          ? ["Locked", "Not delivered", "Refunded"]
          : PAID_PHASES;
    plan.current = plan.phases.length;
    plan.node = m.outcome === "cancelled" ? "dead" : "settled";
    plan.stamp = stampFor(m, receipt);
    plan.sentence = settledSentence(m);
    return plan;
  }

  if (deal.status === "open") {
    plan.current = 0;
    plan.progress = 0.04;
    plan.sentence = (
      <>
        Starts when {role === "worker" ? "you accept" : "the freelancer accepts"}. Then{" "}
        {role === "worker" ? "you have" : "they have"} {formatDuration(m.dueSecs)} to deliver.
      </>
    );
    return plan;
  }

  if (deal.status === "cancelled") {
    plan.phases = ["Locked", "Cancelled", m.status === "approved" || hasMajority(m) ? "Decided" : "Refunded"];
    plan.current = 2;
    plan.node = "dead";
    const base =
      m.status === "approved"
        ? "This deal was cancelled, but this milestone was already approved, so it still goes to the freelancer."
        : hasMajority(m)
          ? "This deal was cancelled, but the arbiters had already decided this milestone, so their decision stands."
          : "This deal was cancelled, so this payment goes back to the client.";
    plan.sentence = ready ? `${base} Anyone can send it now.` : base;
    if (ready && payout) {
      plan.actions.push("cancelledPayout");
      const mine =
        (role === "client" && payout.toClient > 0n) || (role === "worker" && payout.toWorker > 0n);
      plan.move = {
        priority: mine ? 85 : 50,
        text: `The deal is cancelled. Anyone can send the payout of milestone ${n}.`,
      };
    }
    return plan;
  }

  if (m.status === "pending") {
    const due = now < m.submitDeadline;
    plan.current = 1;
    plan.progress = elapsed(m.submitDeadline, m.dueSecs, now);
    plan.urgent = due && m.submitDeadline - now <= 10;
    if (role === "worker" && due) {
      plan.actions.push("deliver");
      plan.move = {
        priority: 80,
        personal: true,
        text: `Deliver milestone ${n}.`,
        hint: <>Due in {when(m.submitDeadline, now)}. When you deliver, the client's review time starts.</>,
      };
    }
    if (due) {
      plan.sentence = (
        <>
          Waiting for delivery, due in {when(m.submitDeadline, now)}. If nothing arrives by then,
          the payment can go back to the client.
        </>
      );
      plan.next = { at: m.submitDeadline, text: `milestone ${n} is due` };
    } else if (!ready) {
      plan.waiting = true;
      plan.sentence = "The delivery deadline has passed. Checking the network clock…";
    }
    if (ready) {
      plan.phases = ["Locked", "Not delivered", "Refunded"];
      plan.current = 2;
      plan.progress = 0.04;
      plan.node = "decided";
      plan.sentence =
        "The freelancer did not deliver in time. Anyone can now return this payment to the client.";
      plan.actions.push("returnToClient");
      plan.move = {
        priority: role === "client" ? 85 : 50,
        text: `Milestone ${n} was not delivered in time. Anyone can return the payment to the client.`,
      };
    }
    return plan;
  }

  if (m.status === "submitted") {
    const left = m.reviewDeadline - now;
    plan.current = 2;
    plan.node = "progress";
    plan.progress = elapsed(m.reviewDeadline, deal.reviewWindowSecs, now);
    plan.urgent = left > 0 && left <= 10;
    if (left > 0) {
      // The row's large review clock says what happens next, and when.
      plan.sentence = null;
      plan.next = { at: m.reviewDeadline, text: `milestone ${n} is paid to the freelancer unless the client objects` };
    } else if (!ready) {
      plan.progress = 1;
      plan.waiting = true;
      plan.sentence = "The review time is over. Waiting a few seconds for the network clock to agree…";
    } else {
      plan.current = 3;
      plan.progress = 0.04;
      plan.node = "decided";
      plan.releaseReady = true;
      plan.sentence = "The review time is over. Nobody needs to approve: anyone can release this payment now.";
      plan.move = {
        priority: 100,
        release: true,
        text:
          role === "worker"
            ? `The review time on milestone ${n} is over. Collect your payment.`
            : `The review time on milestone ${n} is over. Anyone can release this payment, you too.`,
      };
    }
    if (role === "client" && now < m.reviewDeadline) {
      plan.actions.push("approve", "object");
      plan.move = {
        priority: 90,
        personal: true,
        text: `Milestone ${n} was delivered. Approve and pay, or raise an objection.`,
        hint: <>If you do nothing, the freelancer is paid in {when(m.reviewDeadline, now)}.</>,
      };
    }
    return plan;
  }

  if (m.status === "disputed") {
    const decided = hasMajority(m);
    const forWorker = workerVotes(m) >= 2;
    const voting = !decided && now < m.voteDeadline;
    plan.current = decided ? 3 : 2;
    plan.node = decided ? "decided" : "progress";
    plan.progress = decided ? 0.04 : elapsed(m.voteDeadline, deal.voteWindowSecs, now);
    plan.urgent = voting && m.voteDeadline - now <= 10;

    if (role === "arbiter" && arbiterSlot >= 0 && m.votes[arbiterSlot] === VOTE_NONE && voting) {
      plan.actions.push("vote");
      plan.move = {
        priority: 90,
        personal: true,
        text: `The client objected to milestone ${n}. Side with the freelancer or with the client.`,
        hint: <>Voting ends in {when(m.voteDeadline, now)}. Two votes decide.</>,
      };
    }
    if (role === "client" && !decided) plan.extras.push("concede");

    if (decided) {
      const side = forWorker ? "freelancer" : "client";
      plan.sentence = `The arbiters decided for the ${side}. Anyone can now send the payout.`;
      plan.actions.push("decidedPayout");
      const mine = (role === "worker" && forWorker) || (role === "client" && !forWorker);
      plan.move = {
        priority: mine ? 85 : 50,
        text:
          role === "worker" && forWorker
            ? `The arbiters decided milestone ${n} for you. Collect your payment.`
            : `The arbiters decided milestone ${n} for the ${side}. Anyone can send the payout.`,
      };
    } else if (ready) {
      plan.current = 3;
      plan.phases = [...DISPUTE_PHASES.slice(0, 3), "Split"];
      plan.node = "decided";
      plan.sentence =
        "The voting time is over without a majority. The rule is a 50/50 split, with the deposit back to the client. Anyone can apply it now.";
      plan.actions.push("split");
      plan.move = {
        priority: 60,
        text: `Voting on milestone ${n} ended without a majority. Anyone can apply the 50/50 split.`,
      };
    } else if (now >= m.voteDeadline) {
      plan.waiting = true;
      plan.progress = 1;
      plan.sentence = "The voting time is over. Checking the network clock…";
    } else {
      plan.sentence = (
        <>
          The client objected. The arbiters have {when(m.voteDeadline, now)} left to vote; with no
          majority by then, the payment is split 50/50.
        </>
      );
      plan.next = { at: m.voteDeadline, text: `voting on milestone ${n} ends` };
    }
    return plan;
  }

  if (m.status === "approved") {
    plan.current = 3;
    plan.progress = 0.04;
    plan.node = "decided";
    plan.sentence = `Payment approved${
      m.depositLocked > 0n
        ? `. The freelancer also receives the client's ${formatAmount(m.depositLocked)} deposit`
        : ""
    }. Anyone can send the payout now.`;
    plan.actions.push("approvedPayout");
    plan.move = {
      priority: role === "worker" ? 85 : 50,
      text:
        role === "worker"
          ? `Milestone ${n} is approved. Collect your payment.`
          : `Milestone ${n} is approved. Anyone can send the payout to the freelancer.`,
    };
    return plan;
  }

  return plan;
}

export function settledSentence(m: MilestoneInfo): string {
  const amount = formatAmount(m.amount);
  switch (m.outcome) {
    case "workerPaid":
      return `The freelancer was paid ${amount}.`;
    case "clientRefunded":
      return `The client was refunded ${amount}.`;
    case "split": {
      const clientHalf = m.amount / 2n;
      return `Split 50/50: the freelancer received ${formatAmount(m.amount - clientHalf)} and the client ${formatAmount(clientHalf)}, plus any objection deposit back.`;
    }
    case "cancelled":
      return `The deal was cancelled, so ${amount} went back to the client.`;
    default:
      return "Paid out.";
  }
}

/** Where the money of the deal is now: paid to the freelancer, refunded, still in the vault. */
export function moneySplit(deal: DealView): { paid: bigint; refunded: bigint; locked: bigint } {
  let paid = 0n;
  let refunded = 0n;
  for (const m of deal.milestones) {
    if (m.status !== "settled") continue;
    if (m.outcome === "workerPaid") paid += m.amount;
    else if (m.outcome === "clientRefunded" || m.outcome === "cancelled") refunded += m.amount;
    else if (m.outcome === "split") {
      const half = m.amount / 2n;
      refunded += half;
      paid += m.amount - half;
    }
  }
  return { paid, refunded, locked: deal.total - paid - refunded };
}
