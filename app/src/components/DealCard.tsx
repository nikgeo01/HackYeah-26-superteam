// One deal in a list (/deals): counterparty, total, status, next step, progress, nearest deadline.
// It only decides what to say; the deal page and the program decide what can actually happen.
import { Link } from "react-router-dom";
import type { PublicKey } from "@solana/web3.js";
import { hasMajority, VOTE_NONE } from "@client/rules";
import type { DemoActor } from "../lib/actors";
import {
  cancelRequests,
  isFullySettled,
  judgeIndex,
  roleIn,
  type DealView,
  type Role,
} from "../lib/deals";
import { crankReady, settleOpensAt } from "../lib/outcomes";
import {
  dealStatusLabel,
  formatAmount,
  formatCountdown,
  shortAddress,
} from "../lib/format";
import { useActor } from "../providers/ActorProvider";

/** A demo label (in demo mode) plus the short address, e.g. "Worker (AbCd…WxYz)". */
export function PartyName({
  address,
  actors,
}: {
  address: PublicKey;
  actors: readonly DemoActor[];
}) {
  const demo = actors.find((a) => a.publicKey.equals(address));
  return (
    <span title={address.toBase58()}>
      {demo ? (
        <>
          {demo.label}{" "}
          <span className="text-slate-500">({shortAddress(address)})</span>
        </>
      ) : (
        <span className="font-mono">{shortAddress(address)}</span>
      )}
    </span>
  );
}

export interface NextStep {
  text: string;
  /** True when the viewer can (or should) do something now. */
  urgent: boolean;
}

/** The single most useful next step for `role`, in plain words. */
export function nextStep(
  deal: DealView,
  role: Role,
  viewer: PublicKey | null,
  now: number,
): NextStep {
  const wait = (text: string): NextStep => ({ text, urgent: false });
  const act = (text: string): NextStep => ({ text, urgent: true });
  const left = (deadline: number) => formatCountdown(deadline - now);

  if (isFullySettled(deal))
    return wait("Everything is paid out. Anyone can close the deal.");

  if (deal.status === "open") {
    if (now >= deal.acceptDeadline)
      return act(
        "Not accepted in time. Anyone can cancel and refund the client.",
      );
    if (role === "worker")
      return act(`Accept this deal (${left(deal.acceptDeadline)} left).`);
    if (role === "client")
      return wait("Waiting for the freelancer to accept.");
    return wait("Waiting for the freelancer to accept.");
  }

  const open = deal.milestones.filter((m) => m.status !== "settled");
  const ready = open.filter((m) => crankReady(deal, m.index, now));

  if (deal.status === "cancelled")
    return ready.length
      ? act("Cancelled. The refunds can be sent now.")
      : wait("Cancelled.");

  // Active deal.
  const requests = cancelRequests(deal);
  if (role === "client" && requests.worker && !requests.client)
    return act("The freelancer asked to cancel. Agree or keep going.");
  if (role === "worker" && requests.client && !requests.worker)
    return act("The client asked to cancel. Agree or keep going.");

  if (ready.length)
    return act(
      ready.length === 1
        ? `Milestone ${ready[0].index + 1} can be paid out now. Anyone can do it.`
        : `${ready.length} milestones can be paid out now. Anyone can do it.`,
    );

  if (role === "arbiter") {
    const slot = judgeIndex(deal, viewer);
    const needsVote = open.find(
      (m) =>
        m.status === "disputed" &&
        !hasMajority(m) &&
        m.votes[slot] === VOTE_NONE &&
        now < m.voteDeadline,
    );
    if (needsVote)
      return act(
        `Your vote is needed on milestone ${needsVote.index + 1} (${left(needsVote.voteDeadline)} left).`,
      );
    return wait("No vote needed from you right now.");
  }

  const submitted = open.find((m) => m.status === "submitted");
  const disputed = open.find((m) => m.status === "disputed");
  const pending = open.find((m) => m.status === "pending");

  if (role === "client") {
    if (submitted)
      return act(
        `Review milestone ${submitted.index + 1}: approve or object (${left(submitted.reviewDeadline)} left, then silence pays).`,
      );
    if (disputed)
      return wait(`The arbiters are voting on milestone ${disputed.index + 1}.`);
    if (pending)
      return wait(
        `Waiting for delivery of milestone ${pending.index + 1} (due in ${left(pending.submitDeadline)}).`,
      );
  }
  if (role === "worker") {
    if (pending)
      return act(
        `Deliver milestone ${pending.index + 1} (due in ${left(pending.submitDeadline)}).`,
      );
    if (submitted)
      return wait(
        `If the client says nothing, you are paid for milestone ${submitted.index + 1} in ${left(submitted.reviewDeadline)}.`,
      );
    if (disputed)
      return wait(`The arbiters are voting on milestone ${disputed.index + 1}.`);
  }
  return wait(dealStatusLabel(deal.status));
}

/** The nearest future deadline that changes what can happen, or null. */
export function nearestDeadline(
  deal: DealView,
  now: number,
): { at: number; what: string } | null {
  const candidates: { at: number; what: string }[] = [];
  if (deal.status === "open")
    candidates.push({ at: deal.acceptDeadline, what: "Acceptance closes" });
  for (const m of deal.milestones) {
    const at = settleOpensAt(deal.status, m);
    if (at === null) continue;
    const what =
      m.status === "pending"
        ? `Milestone ${m.index + 1} due`
        : m.status === "submitted"
          ? `Milestone ${m.index + 1} review ends`
          : `Milestone ${m.index + 1} vote ends`;
    candidates.push({ at, what });
  }
  const future = candidates.filter((c) => c.at > now);
  if (!future.length) return null;
  return future.reduce((a, b) => (b.at < a.at ? b : a));
}

const STATUS_BADGE: Record<string, string> = {
  open: "bg-sky-100 text-sky-800",
  active: "bg-emerald-100 text-emerald-800",
  cancelled: "bg-slate-200 text-slate-700",
};

export function DealCard({
  deal,
  now,
  role: roleProp,
}: {
  deal: DealView;
  now: number;
  /** The viewer's role; defaults to the active actor's role in this deal. */
  role?: Role;
}) {
  const { publicKey, demoActors } = useActor();
  const role = roleProp ?? roleIn(deal, publicKey);
  const step = nextStep(deal, role, publicKey, now);
  const deadline = nearestDeadline(deal, now);
  const settled = deal.settledCount;
  const count = deal.milestones.length;
  const address = deal.address.toBase58();

  return (
    <Link
      to={`/deal/${address}`}
      className="block rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition hover:border-indigo-300 hover:shadow"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="space-y-0.5">
          <p className="text-lg font-semibold">{formatAmount(deal.total)}</p>
          <p className="text-sm text-slate-600">
            {role === "client" ? (
              <>
                To <PartyName address={deal.worker} actors={demoActors} />
              </>
            ) : role === "worker" ? (
              <>
                From <PartyName address={deal.client} actors={demoActors} />
              </>
            ) : (
              <>
                <PartyName address={deal.client} actors={demoActors} /> pays{" "}
                <PartyName address={deal.worker} actors={demoActors} />
              </>
            )}
          </p>
        </div>
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_BADGE[deal.status] ?? ""}`}
        >
          {deal.status === "active" ? "In progress" : dealStatusLabel(deal.status)}
        </span>
      </div>

      <p
        className={`mt-3 text-sm ${step.urgent ? "font-medium text-indigo-800" : "text-slate-700"}`}
      >
        {step.urgent && <span aria-hidden="true">→ </span>}
        {step.text}
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
        <span className="flex items-center gap-2">
          <span
            className="inline-flex gap-0.5"
            aria-label={`${settled} of ${count} milestones paid out`}
          >
            {deal.milestones.map((m) => (
              <span
                key={m.index}
                className={`h-2 w-4 rounded-sm ${m.status === "settled" ? "bg-emerald-500" : "bg-slate-200"}`}
              />
            ))}
          </span>
          {settled} of {count} paid out
        </span>
        {deadline && (
          <span>
            {deadline.what} in{" "}
            <span className="font-mono tabular-nums">
              {formatCountdown(deadline.at - now)}
            </span>
          </span>
        )}
        <span className="ml-auto font-mono">{shortAddress(deal.address)}</span>
      </div>
    </Link>
  );
}
