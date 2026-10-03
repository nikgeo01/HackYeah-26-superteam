import { Link } from "react-router-dom";
import { useMyDeals } from "../hooks/useDeals";
import { dealStatusLabel, formatAmount, shortAddress } from "../lib/format";
import type { DealView } from "../lib/deals";

// Placeholder for "My deals" (PLAN 4.1). WP-22 replaces this with tabs and DealCards.
function DealList({ title, deals }: { title: string; deals: DealView[] }) {
  return (
    <section className="space-y-2">
      <h2 className="text-lg font-semibold">{title}</h2>
      {deals.length === 0 ? (
        <p className="text-sm text-slate-500">Nothing here yet.</p>
      ) : (
        <ul className="space-y-1 text-sm">
          {deals.map((d) => (
            <li key={d.address.toBase58()}>
              <Link
                to={`/deal/${d.address.toBase58()}`}
                className="text-indigo-700 underline"
              >
                {shortAddress(d.address)}
              </Link>{" "}
              · {formatAmount(d.total)} · {dealStatusLabel(d.status)}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default function Deals() {
  const { paying, working, arbiter, isLoading, error } = useMyDeals();
  if (isLoading) return <p>Loading your deals…</p>;
  if (error) return <p className="text-red-700">Could not load deals.</p>;
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">My deals</h1>
      <DealList title="I am paying" deals={paying} />
      <DealList title="I am working" deals={working} />
      <DealList title="I am an arbiter" deals={arbiter} />
    </div>
  );
}
