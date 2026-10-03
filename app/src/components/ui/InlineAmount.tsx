// An amount set inside running text or a ledger row, where <Amount>'s display-size currency
// (0.45em) would shrink to an unreadable 7px. Figures semibold and lining, the symbol lighter.
import { formatAmount } from "../../lib/format";

export function InlineAmount({ raw, className = "" }: { raw: bigint; className?: string }) {
  const text = formatAmount(raw);
  const i = text.lastIndexOf(" ");
  return (
    <span className={`figures whitespace-nowrap font-semibold text-ink ${className}`}>
      {text.slice(0, i)}
      <span className="ml-[0.2em] text-[0.8em] font-medium text-ink-soft">{text.slice(i + 1)}</span>
    </span>
  );
}
