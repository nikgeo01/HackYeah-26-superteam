// The three arbiter slots and how each voted. Display only. A vote is shown by the shape of the
// side it went to (round freelancer, square client), never by colour alone.
import { VOTE_CLIENT, VOTE_WORKER, clientVotes, workerVotes } from "@client/rules";
import type { DealView, MilestoneInfo } from "../../lib/deals";
import { RoleMark } from "../RoleSwitcher";
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
  const word = (k: number) => (k === 1 ? "vote" : "votes");
  return (
    <div className="space-y-2">
      <p className="text-sm text-ink-soft">
        <span className="font-semibold text-ink">Arbiter votes:</span> {w} {word(w)} for the
        freelancer, {c} for the client. Two decide.
      </p>
      <ul className="grid max-w-2xl grid-cols-3 gap-2">
        {deal.judges.map((judge, slot) => {
          const vote = milestone.votes[slot];
          const mine = slot === mySlot;
          return (
            <li
              key={judge.toBase58()}
              className={`min-w-0 rounded-[var(--radius-control)] border px-2.5 py-2 text-micro ${
                mine ? "border-2 border-ink" : vote ? "border-ink/40" : "border-dashed border-rule"
              }`}
            >
              <div className="truncate text-ink-soft">
                {ARBITER_SHORT[slot]}
                {mine && <span className="font-semibold text-ink"> (you)</span>}
              </div>
              <div className="mt-1 flex items-center gap-1.5 font-semibold text-ink">
                {vote === VOTE_WORKER ? (
                  <>
                    <RoleMark shape="worker" /> Freelancer
                  </>
                ) : vote === VOTE_CLIENT ? (
                  <>
                    <RoleMark shape="client" /> Client
                  </>
                ) : (
                  <>
                    <span aria-hidden className="inline-block h-2.5 w-2.5 rounded-full border border-dashed border-ink-soft" />
                    <span className="font-normal text-ink-soft">Not yet</span>
                  </>
                )}
              </div>
              <div className="mt-1 truncate">
                <AddressLink address={judge} />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
