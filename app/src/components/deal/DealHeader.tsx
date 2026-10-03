// Top of the deal page: what this deal is, its status, and who the viewer is in it.
import type { DealView, Role } from "../../lib/deals";
import { dealStatusLabel, formatAmount } from "../../lib/format";
import { Countdown } from "./Countdown";
import { RoleChip, ROLE_LABEL } from "./common";

const STATUS_STYLE: Record<string, string> = {
  open: "bg-amber-100 text-amber-900 ring-amber-300",
  active: "bg-indigo-100 text-indigo-900 ring-indigo-300",
  cancelled: "bg-slate-200 text-slate-800 ring-slate-300",
};

export function DealHeader({
  deal,
  role,
  arbiterSlot,
  now,
}: {
  deal: DealView;
  role: Role;
  arbiterSlot: number;
  now: number;
}) {
  const settled = deal.settledCount === deal.milestones.length;
  const statusText = settled ? "Finished" : dealStatusLabel(deal.status);
  const n = deal.milestones.length;
  return (
    <header className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-slate-500">
            Payment locked in escrow
          </p>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">
            {formatAmount(deal.total)}
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            {n} milestone{n === 1 ? "" : "s"} · {deal.settledCount} paid out
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <span
            className={`rounded-full px-3 py-1 text-sm font-semibold ring-1 ${settled ? "bg-emerald-100 text-emerald-900 ring-emerald-300" : (STATUS_STYLE[deal.status] ?? "")}`}
          >
            {statusText}
          </span>
          <span className="flex items-center gap-1.5 text-sm text-slate-600">
            You are viewing as{" "}
            <RoleChip
              role={role}
              text={
                role === "arbiter" && arbiterSlot >= 0
                  ? `Arbiter ${arbiterSlot + 1}`
                  : ROLE_LABEL[role]
              }
            />
          </span>
        </div>
      </div>
      {deal.status === "open" && (
        <p className="mt-3 text-sm text-slate-700">
          {now < deal.acceptDeadline ? (
            <>
              The freelancer has{" "}
              <Countdown
                deadline={deal.acceptDeadline}
                now={now}
                className="font-semibold"
              />{" "}
              left to accept.
            </>
          ) : (
            "The time to accept is over. Anyone can now cancel the deal and return the money to the client."
          )}
        </p>
      )}
      {role === "stranger" && (
        <p className="mt-3 text-sm text-slate-500">
          You have no part in this deal. You can still see everything, and you
          can release payments whose timers have run out.
        </p>
      )}
    </header>
  );
}
