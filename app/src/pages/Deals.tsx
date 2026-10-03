// "My deals" (PLAN 4.1): three tabs by role, plus all recent deals in demo mode.
import { Link, useSearchParams } from "react-router-dom";
import { useAllDeals, useMyDeals } from "../hooks/useDeals";
import { useActor } from "../providers/ActorProvider";
import { useChainNow } from "../providers/ChainTimeProvider";
import { DealCard } from "../components/DealCard";
import { DEMO_MODE } from "../lib/env";
import type { DealView, Role } from "../lib/deals";

type TabId = "paying" | "working" | "arbiter";

const TABS: { id: TabId; label: string; role: Role }[] = [
  { id: "paying", label: "I am paying", role: "client" },
  { id: "working", label: "I am working", role: "worker" },
  { id: "arbiter", label: "I am an arbiter", role: "arbiter" },
];

const RECENT_LIMIT = 12;

function EmptyState({ tab, address }: { tab: TabId; address: string }) {
  if (tab === "paying")
    return (
      <div className="rounded-lg border border-dashed border-slate-300 p-6 text-center">
        <p className="text-slate-700">You are not paying for any work yet.</p>
        <Link
          to="/new"
          className="mt-3 inline-block rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
        >
          Create a deal
        </Link>
      </div>
    );
  if (tab === "working")
    return (
      <div className="space-y-2 rounded-lg border border-dashed border-slate-300 p-6 text-center">
        <p className="text-slate-700">No one has offered you a deal yet.</p>
        <p className="text-sm text-slate-600">
          Send your client this address. They create the deal and lock the
          payment; it then shows up here for you to accept.
        </p>
        <p className="break-all font-mono text-sm">{address}</p>
      </div>
    );
  return (
    <div className="rounded-lg border border-dashed border-slate-300 p-6 text-center">
      <p className="text-slate-700">
        Nobody has named you as an arbiter yet.
      </p>
      <p className="mt-1 text-sm text-slate-600">
        When a deal lists your address as one of its three arbiters, it shows
        up here. You only need to act if the client raises an objection.
      </p>
    </div>
  );
}

function DealGrid({
  deals,
  now,
  role,
}: {
  deals: DealView[];
  now: number;
  role?: Role;
}) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {deals.map((d) => (
        <DealCard
          key={d.address.toBase58()}
          deal={d}
          now={now}
          role={role}
        />
      ))}
    </div>
  );
}

function RecentDeals({ now }: { now: number }) {
  const { data, isLoading } = useAllDeals();
  const recent = (data ?? []).slice(0, RECENT_LIMIT);
  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-lg font-semibold">All recent deals</h2>
        <p className="text-sm text-slate-600">
          Every deal is public on Solana. As a Passer-by you can open any of
          them and release a payment once its timer is over.
        </p>
      </div>
      {isLoading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : recent.length === 0 ? (
        <p className="text-sm text-slate-500">No deals yet.</p>
      ) : (
        <DealGrid deals={recent} now={now} />
      )}
    </section>
  );
}

export default function Deals() {
  const { publicKey, actor } = useActor();
  const mine = useMyDeals();
  const now = useChainNow();
  const [params, setParams] = useSearchParams();
  const requested = params.get("tab") as TabId | null;

  const counts: Record<TabId, number> = {
    paying: mine.paying.length,
    working: mine.working.length,
    arbiter: mine.arbiter.length,
  };
  // Default to the first tab that has deals.
  const tab: TabId =
    requested && TABS.some((t) => t.id === requested)
      ? requested
      : (TABS.find((t) => counts[t.id] > 0)?.id ?? "paying");
  const current = TABS.find((t) => t.id === tab)!;
  const deals = mine[tab];

  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">My deals</h1>
            {actor && (
              <p className="text-sm text-slate-600">
                Showing deals for <strong>{actor.label}</strong>.
              </p>
            )}
          </div>
          <Link
            to="/new"
            className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-indigo-700"
          >
            Create a deal
          </Link>
        </div>

        {!publicKey ? (
          <p className="rounded-lg border border-dashed border-slate-300 p-6 text-center text-slate-700">
            Connect a wallet
            {DEMO_MODE ? " (or pick a demo role in the header)" : ""} to see
            your deals.
          </p>
        ) : (
          <>
            <div
              role="tablist"
              className="flex flex-wrap gap-1 border-b border-slate-200"
            >
              {TABS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={t.id === tab}
                  onClick={() => setParams({ tab: t.id }, { replace: true })}
                  className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium ${
                    t.id === tab
                      ? "border-indigo-600 text-indigo-700"
                      : "border-transparent text-slate-600 hover:text-slate-900"
                  }`}
                >
                  {t.label}
                  <span className="ml-1.5 rounded-full bg-slate-100 px-1.5 text-xs text-slate-600">
                    {counts[t.id]}
                  </span>
                </button>
              ))}
            </div>
            <div role="tabpanel">
              {mine.isLoading ? (
                <p className="text-sm text-slate-500">Loading your deals…</p>
              ) : mine.error ? (
                <p className="text-sm text-red-700">
                  Could not load deals. The network may be busy; this page
                  retries on its own.
                </p>
              ) : deals.length === 0 ? (
                <EmptyState tab={tab} address={publicKey.toBase58()} />
              ) : (
                <DealGrid deals={deals} now={now} role={current.role} />
              )}
            </div>
          </>
        )}
      </section>

      {DEMO_MODE && <RecentDeals now={now} />}
    </div>
  );
}
