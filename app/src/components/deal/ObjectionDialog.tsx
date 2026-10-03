// Confirmation built into the page (no window.confirm): the objection locks the deposit.
import { useEffect, useRef } from "react";
import type { DealView, MilestoneInfo } from "../../lib/deals";
import { formatAmount, formatDuration } from "../../lib/format";
import { Btn, Spinner } from "./common";

export function ObjectionDialog({
  deal,
  milestone,
  open,
  busy,
  onCancel,
  onConfirm,
}: {
  deal: DealView;
  milestone: MilestoneInfo;
  open: boolean;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  const deposit = deal.disputeDeposit;
  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onCancel();
      }}
      className="m-auto w-[min(32rem,calc(100vw-2rem))] rounded-xl p-0 shadow-2xl backdrop:bg-slate-900/50"
    >
      <div className="space-y-4 p-5">
        <h2 className="text-lg font-bold text-slate-900">
          Raise an objection to milestone {milestone.index + 1}?
        </h2>
        <ul className="list-disc space-y-1.5 pl-5 text-sm text-slate-700">
          {deposit > 0n ? (
            <li>
              This locks <strong>{formatAmount(deposit)}</strong> from your
              account as a deposit.{" "}
              <strong>
                You lose it if the panel sides with the freelancer
              </strong>
              , or if you later concede.
            </li>
          ) : (
            <li>This deal has no objection deposit, so objecting is free.</li>
          )}
          <li>
            The three arbiters then have {formatDuration(deal.voteWindowSecs)}{" "}
            to vote. Two votes decide.
          </li>
          <li>
            If they do not reach a majority in time, the payment is split 50/50
            and the deposit goes back to you.
          </li>
        </ul>
        <div className="flex flex-wrap justify-end gap-2">
          <Btn variant="secondary" onClick={onCancel} disabled={busy}>
            Keep reviewing
          </Btn>
          <Btn variant="dangerSolid" onClick={onConfirm} disabled={busy}>
            {busy && <Spinner />}
            {deposit > 0n
              ? `Lock ${formatAmount(deposit)} and object`
              : "Object"}
          </Btn>
        </div>
      </div>
    </dialog>
  );
}
