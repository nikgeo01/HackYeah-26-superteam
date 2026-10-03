import { useParams } from "react-router-dom";
import { useDeal } from "../hooks/useDeals";
import { useChainNow } from "../providers/ChainTimeProvider";
import {
  dealStatusLabel,
  formatAmount,
  formatCountdown,
  milestoneStatusLabel,
  shortAddress,
} from "../lib/format";

// Placeholder for the deal page (PLAN 4.1, 4.3). WP-22 replaces this with MilestoneCards and actions.
export default function DealDetail() {
  const { address } = useParams();
  const { data: deal, isLoading, invalidAddress } = useDeal(address);
  const now = useChainNow();

  if (invalidAddress) return <p>This is not a valid deal address.</p>;
  if (isLoading) return <p>Loading the deal…</p>;
  if (!deal) return <p>This deal does not exist (it may have been closed).</p>;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Deal {shortAddress(deal.address)}</h1>
      <p>
        {dealStatusLabel(deal.status)} · {formatAmount(deal.total)}
      </p>
      <ol className="list-decimal space-y-1 pl-6 text-sm">
        {deal.milestones.map((m) => (
          <li key={m.index}>
            {formatAmount(m.amount)} · {milestoneStatusLabel(m.status)}
            {m.status === "submitted" && (
              <> · review ends in {formatCountdown(m.reviewDeadline - now)}</>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}
