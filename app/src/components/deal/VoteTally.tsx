// The three arbiter slots and how each voted. Display only.
import {
  VOTE_CLIENT,
  VOTE_WORKER,
  clientVotes,
  workerVotes,
} from "@client/rules";
import type { DealView, MilestoneInfo } from "../../lib/deals";
import { AddressLink, ARBITER_SHORT } from "./common";

export function VoteTally({
  deal,
  milestone,
  mySlot,
}: {
  deal: DealView;
  milestone: MilestoneInfo;
  /** The viewer's arbiter slot, or -1. */
  mySlot: number;
}) {
  const w = workerVotes(milestone);
  const c = clientVotes(milestone);
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-sm">
        <span className="font-semibold text-slate-800">Arbiter votes</span>
        <span className="text-slate-600">
          <span className="font-semibold text-emerald-700">{w}</span> for the
          freelancer · <span className="font-semibold text-sky-700">{c}</span>{" "}
          for the client · 2 decide
        </span>
      </div>
      <ul className="grid gap-2 sm:grid-cols-3">
        {deal.judges.map((judge, slot) => {
          const vote = milestone.votes[slot];
          const style =
            vote === VOTE_WORKER
              ? "border-emerald-300 bg-emerald-50 text-emerald-900"
              : vote === VOTE_CLIENT
                ? "border-sky-300 bg-sky-50 text-sky-900"
                : "border-dashed border-slate-300 bg-slate-50 text-slate-500";
          const text =
            vote === VOTE_WORKER
              ? "Sided with the freelancer"
              : vote === VOTE_CLIENT
                ? "Sided with the client"
                : "Has not voted";
          return (
            <li
              key={judge.toBase58()}
              className={`rounded-md border px-2.5 py-2 text-xs ${style} ${slot === mySlot ? "ring-2 ring-amber-400" : ""}`}
            >
              <div className="font-semibold">
                {ARBITER_SHORT[slot]}
                {slot === mySlot && " (you)"}
              </div>
              <div className="mt-0.5">{text}</div>
              <div className="mt-1">
                <AddressLink address={judge} />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
