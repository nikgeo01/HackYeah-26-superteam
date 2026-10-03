// Top of the deal sheet: the money (the headline), who the viewer is, the deal's status in
// words, and a bar showing where the money is now.
import type { DealView, Role } from "../../lib/deals";
import { dealStatusLabel, formatAmount } from "../../lib/format";
import { Amount, splitAmount } from "../ui";
import { RoleMark } from "../RoleSwitcher";
import { ARBITER_LABEL } from "./common";
import { moneySplit } from "./plan";

function roleWords(role: Role, slot: number): string {
  switch (role) {
    case "client":
      return "the client";
    case "worker":
      return "the freelancer";
    case "arbiter":
      return slot >= 0 ? `an arbiter (${ARBITER_LABEL[slot].replace("Arbiter picked", "picked")})` : "an arbiter";
    default:
      return "a passer-by";
  }
}

const pct = (part: bigint, total: bigint) =>
  total > 0n ? Number((part * 10000n) / total) / 100 : 0;

/** Paid, refunded and still locked, as one bar. The three parts differ by fill, not by hue. */
function MoneyBar({ deal }: { deal: DealView }) {
  const { paid, refunded, locked } = moneySplit(deal);
  const parts = [
    {
      key: "paid",
      label: "paid to the freelancer",
      value: paid,
      fill: "bg-ink",
    },
    {
      key: "refunded",
      label: "refunded to the client",
      value: refunded,
      fill: "bg-[repeating-linear-gradient(135deg,var(--color-ink-soft)_0_2px,transparent_2px_5px)]",
    },
    {
      key: "locked",
      label: "still locked",
      value: locked,
      fill: "bg-rule-soft",
    },
  ];
  return (
    <div className="space-y-2">
      <div
        className="flex h-3 overflow-hidden rounded-[3px] border border-rule bg-rule-soft"
        role="img"
        aria-label={parts.map((p) => `${formatAmount(p.value)} ${p.label}`).join(", ")}
      >
        {parts.map(
          (p) =>
            p.value > 0n && (
              <span
                key={p.key}
                className={`h-full ${p.fill} [&+&]:border-l [&+&]:border-sheet`}
                style={{ width: `${pct(p.value, deal.total)}%` }}
              />
            ),
        )}
      </div>
      <ul className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-ink-soft">
        {parts.map((p) => (
          <li key={p.key} className="flex items-center gap-2">
            <span aria-hidden className={`inline-block h-2.5 w-4 rounded-[2px] border border-rule ${p.fill}`} />
            <span>
              <span className="figures font-semibold text-ink">{formatAmount(p.value)}</span> {p.label}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function DealHeader({
  deal,
  role,
  arbiterSlot,
}: {
  deal: DealView;
  role: Role;
  arbiterSlot: number;
}) {
  const n = deal.milestones.length;
  const settled = deal.settledCount === n;
  const status = settled ? "Finished" : dealStatusLabel(deal.status);
  const total = splitAmount(formatAmount(deal.total));
  return (
    <header className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
        <div className="space-y-2">
          <h1 className="text-ink">
            <Amount value={total.value} symbol={total.symbol} size="xl" />
          </h1>
          <p className="text-body text-ink-soft">
            {settled ? "Paid out over" : "Held in escrow for"} {n} milestone{n === 1 ? "" : "s"}.{" "}
            <span className="font-semibold text-ink">{status}</span>
            {!settled && deal.settledCount > 0 && `, ${deal.settledCount} of ${n} settled`}.
          </p>
        </div>
        <p className="flex items-center gap-2 text-body text-ink">
          <RoleMark shape={role} />
          <span>
            You are <span className="font-semibold">{roleWords(role, arbiterSlot)}</span>
          </span>
        </p>
      </div>
      <MoneyBar deal={deal} />
    </header>
  );
}
