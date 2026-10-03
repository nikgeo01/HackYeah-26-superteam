// The deal as one ledger sheet (DESIGN.md, deal page): the money, "Your move", the milestone
// track, then the people and the rules. Who is looking and what time it is come in as props, so
// the dev-only states preview can render it from fixtures.
import { useCallback, useState } from "react";
import type { PublicKey } from "@solana/web3.js";
import type { DealView, Role } from "../../lib/deals";
import { Sheet } from "../ui";
import { YourMove, dealLevelMove, type Finished } from "./ActionBar";
import { CancelBanner } from "./CancelBanner";
import { DealHeader } from "./DealHeader";
import { MilestoneRow } from "./MilestoneRow";
import { TermsPanel } from "./TermsPanel";
import type { MilestoneReceipt } from "./common";
import { planMilestone, type Move, type NextEvent } from "./plan";

export function DealSheet({
  deal,
  role,
  arbiterSlot,
  me,
  now,
  onFinished,
  extraReceipts,
}: {
  deal: DealView;
  role: Role;
  arbiterSlot: number;
  me: PublicKey | null;
  now: number;
  onFinished: (f: Finished) => void;
  /** Receipts known from elsewhere (the preview uses this to show a paid-by-rule row). */
  extraReceipts?: Record<number, MilestoneReceipt>;
}) {
  const [own, setOwn] = useState<Record<number, MilestoneReceipt>>({});
  const onReceipt = useCallback(
    (index: number, r: MilestoneReceipt) => setOwn((all) => ({ ...all, [index]: r })),
    [],
  );
  const receipts = { ...extraReceipts, ...own };
  const [slot, setSlot] = useState<HTMLElement | null>(null);

  // The viewer's best move across all milestones, and the next timed event.
  let featured: { index: number; move: Move } | null = null;
  let next: NextEvent | null = null;
  for (const m of deal.milestones) {
    const plan = planMilestone(deal, m, role, arbiterSlot, now, receipts[m.index]);
    if (plan.move && (!featured || plan.move.priority > featured.move.priority))
      featured = { index: m.index, move: plan.move };
    if (plan.next && plan.next.at > now && (!next || plan.next.at < next.at)) next = plan.next;
  }

  // Which block "Your move" shows decides whether the milestone's buttons move up into it.
  const levels = dealLevelMove(deal, role, now);
  const openBlock = levels.some((l) => l === "accept" || l === "clientOpen" || l === "waitOpen" || l === "expired");
  const featuredShown =
    !openBlock && featured !== null && (featured.move.personal || !levels.includes("withdraw"));
  const moveIndex = featuredShown && featured ? featured.index : -1;

  return (
    <Sheet as="article" className="px-4 py-6 sm:px-8 sm:py-8">
      <DealHeader deal={deal} role={role} arbiterSlot={arbiterSlot} />

      <div className="mt-7 space-y-3">
        <YourMove
          deal={deal}
          role={role}
          now={now}
          onFinished={onFinished}
          featured={featuredShown ? featured : null}
          next={next}
          setSlot={setSlot}
        />
        <CancelBanner deal={deal} role={role} />
      </div>

      <section aria-label="Milestones" className="mt-10">
        <h2 className="sr-only">Milestones</h2>
        <ol className="relative before:absolute before:bottom-3 before:left-[11px] before:top-3 before:w-[2px] before:bg-rule">
          {deal.milestones.map((m) => (
            <MilestoneRow
              key={m.index}
              deal={deal}
              milestone={m}
              role={role}
              arbiterSlot={arbiterSlot}
              now={now}
              receipt={receipts[m.index]}
              onReceipt={onReceipt}
              isMove={m.index === moveIndex}
              moveSlot={m.index === moveIndex ? slot : null}
            />
          ))}
        </ol>
      </section>

      <div className="mt-10 border-t border-rule pt-7">
        <TermsPanel deal={deal} me={me} />
        <div className="mt-4">
          <CancelBanner deal={deal} role={role} placement="footer" />
        </div>
      </div>
    </Sheet>
  );
}
