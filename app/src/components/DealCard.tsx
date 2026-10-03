// One deal in a list (/deals): a ledger row with the counterparty, a phase sentence that ends with
// what happens next, the nearest clock and the amount. It only decides what to say; the deal page
// and the program decide what can actually happen.
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
import { RoleMark, type RoleShape } from "./RoleSwitcher";
import { Amount, splitAmount } from "./ui";
import { Clock } from "./ui/Clock";

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
          <span className="tnum text-ink-soft">({shortAddress(address)})</span>
        </>
      ) : (
        <span className="tnum">{shortAddress(address)}</span>
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
      return wait(
        `The arbiters are voting on milestone ${disputed.index + 1}. With no majority in ${left(disputed.voteDeadline)}, it splits 50/50.`,
      );
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
      return wait(
        `The arbiters are voting on milestone ${disputed.index + 1}. With no majority in ${left(disputed.voteDeadline)}, it splits 50/50.`,
      );
  }
  // Someone outside the deal: say where it stands and what the rule does next.
  if (submitted)
    return wait(
      `Milestone ${submitted.index + 1} is in review. If the client says nothing, the freelancer is paid in ${left(submitted.reviewDeadline)}.`,
    );
  if (disputed)
    return wait(
        `The arbiters are voting on milestone ${disputed.index + 1}. With no majority in ${left(disputed.voteDeadline)}, it splits 50/50.`,
      );
  if (pending)
    return wait(
      `Waiting for delivery of milestone ${pending.index + 1} (due in ${left(pending.submitDeadline)}).`,
    );
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

/** Which part of /deals a row belongs in. */
export type DealGroup = "needs" | "waiting" | "finished";

export function dealGroup(deal: DealView, step: NextStep): DealGroup {
  if (isFullySettled(deal)) return "finished";
  if (deal.status === "cancelled" && !step.urgent) return "finished";
  return step.urgent ? "needs" : "waiting";
}

/** A party named as briefly as possible: the demo label, or the short address. */
function Who({
  address,
  shape,
  actors,
}: {
  address: PublicKey;
  shape: RoleShape;
  actors: readonly DemoActor[];
}) {
  const demo = actors.find((a) => a.publicKey.equals(address));
  const word = shape === "client" ? "Client" : "Freelancer";
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5" title={address.toBase58()}>
      <RoleMark shape={shape} />
      {demo ? (
        <span className="truncate">{demo.label}</span>
      ) : (
        <span className="truncate">
          <span className="sr-only">{word} </span>
          <span className="tnum">{shortAddress(address)}</span>
        </span>
      )}
    </span>
  );
}

const ROW_AREAS =
  "grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-1 [grid-template-areas:'who_amount'_'phase_clock'] md:grid-cols-[minmax(9rem,13rem)_minmax(0,1fr)_9.5rem_8.5rem] md:items-baseline md:[grid-template-areas:'who_phase_clock_amount']";

/**
 * One deal as a ledger row, linking to the deal page. On narrow screens it folds into two lines:
 * who and how much, then what happens next and when.
 */
export function DealRow({
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
  const left = deadline ? deadline.at - now : 0;
  const amount = splitAmount(formatAmount(deal.total));
  const address = deal.address.toBase58();
  const settled = deal.settledCount;
  const count = deal.milestones.length;

  return (
    <Link
      to={`/deal/${address}`}
      className={`${ROW_AREAS} -mx-2 rounded-[var(--radius-control)] px-2 py-3 transition-colors hover:bg-ground/60 focus-visible:bg-ground/60 focus-visible:outline-offset-0`}
    >
      <span className="flex min-w-0 flex-col [grid-area:who]">
        <span className="flex min-w-0 flex-wrap items-center gap-x-2 text-sm font-semibold text-ink">
          {role === "client" ? (
            <Who address={deal.worker} shape="worker" actors={demoActors} />
          ) : role === "worker" ? (
            <Who address={deal.client} shape="client" actors={demoActors} />
          ) : (
            <>
              <Who address={deal.client} shape="client" actors={demoActors} />
              <span className="font-normal text-ink-soft">pays</span>
              <Who address={deal.worker} shape="worker" actors={demoActors} />
            </>
          )}
        </span>
        <span className="text-micro text-ink-soft">
          Deal <span className="tnum">{shortAddress(deal.address)}</span>, {settled} of {count} paid
        </span>
      </span>

      <span
        className={`min-w-0 text-sm leading-snug [grid-area:phase] ${
          step.urgent ? "font-medium text-ink" : "text-ink-soft"
        }`}
      >
        {step.text}
      </span>

      <span className="flex flex-col items-end text-right [grid-area:clock] md:items-start md:text-left">
        {deadline && (
          <>
            <Clock
              text={formatCountdown(left)}
              className={`text-sm font-semibold ${left < 60 ? "text-clock" : "text-ink"}`}
            />
            <span className="text-micro leading-tight text-ink-soft">{deadline.what}</span>
          </>
        )}
      </span>

      <span className="text-right [grid-area:amount]">
        <Amount value={amount.value} symbol={amount.symbol} size="md" />
      </span>
    </Link>
  );
}

/** A single deal shown on its own (e.g. on /demo): one ledger row on a sheet. */
export function DealCard({
  deal,
  now,
  role,
}: {
  deal: DealView;
  now: number;
  role?: Role;
}) {
  return (
    <div className="rounded-[var(--radius-sheet)] border border-rule bg-sheet px-4 py-1">
      <DealRow deal={deal} now={now} role={role} />
    </div>
  );
}
