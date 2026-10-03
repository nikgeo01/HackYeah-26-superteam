// "My deals" (PLAN 4.1): a ledger of the viewer's deals, filtered by role and grouped by whose move
// it is, plus all recent deals in demo mode.
import { useSearchParams } from "react-router-dom";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { useAllDeals, useMyDeals } from "../hooks/useDeals";
import { useActor } from "../providers/ActorProvider";
import { useChainNow } from "../providers/ChainTimeProvider";
import { DealRow, dealGroup, nextStep, type DealGroup } from "../components/DealCard";
import { FaucetButton } from "../components/FaucetButton";
import { RoleMark, shapeForLabel } from "../components/RoleSwitcher";
import { Heading, Notice, Sheet, Spinner } from "../components/ui";
import { ButtonLink } from "../components/ui/ButtonLink";
import { Segmented } from "../components/ui/Segmented";
import { DEMO_MODE } from "../lib/env";
import type { DealView, Role } from "../lib/deals";

type TabId = "paying" | "working" | "arbiter";

const TABS: { id: TabId; label: string; role: Role }[] = [
  { id: "paying", label: "I am paying", role: "client" },
  { id: "working", label: "I am working", role: "worker" },
  { id: "arbiter", label: "I am an arbiter", role: "arbiter" },
];

const GROUPS: { id: DealGroup; title: string }[] = [
  { id: "needs", title: "Needs you" },
  { id: "waiting", title: "Waiting on someone else" },
  { id: "finished", title: "Finished" },
];

const RECENT_LIMIT = 12;

/** Column heads, shown once above the rows on wide screens only. */
function ColumnHeads() {
  return (
    <div
      aria-hidden
      className="hidden grid-cols-[minmax(9rem,13rem)_minmax(0,1fr)_9.5rem_8.5rem] gap-x-4 border-b border-rule pb-2 text-micro text-ink-soft md:grid"
    >
      <span>With</span>
      <span>Where it stands, and what happens next</span>
      <span>Next clock</span>
      <span className="text-right">Locked in total</span>
    </div>
  );
}

function Rows({ deals, now, role }: { deals: DealView[]; now: number; role?: Role }) {
  return (
    <ul className="ledger">
      {deals.map((d) => (
        <li key={d.address.toBase58()}>
          <DealRow deal={d} now={now} role={role} />
        </li>
      ))}
    </ul>
  );
}

function GroupedRows({ deals, now, role }: { deals: DealView[]; now: number; role: Role }) {
  const { publicKey } = useActor();
  const grouped: Record<DealGroup, DealView[]> = { needs: [], waiting: [], finished: [] };
  for (const d of deals) grouped[dealGroup(d, nextStep(d, role, publicKey, now))].push(d);

  return (
    <div className="space-y-7">
      {GROUPS.filter((g) => grouped[g.id].length > 0).map((g) => (
        <section key={g.id} aria-labelledby={`group-${g.id}`}>
          <h2
            id={`group-${g.id}`}
            className="flex items-baseline gap-2 pb-1 text-body font-semibold text-ink"
          >
            {g.title}
            <span className="figures text-micro font-normal text-ink-soft">
              {grouped[g.id].length}
            </span>
          </h2>
          <Rows deals={grouped[g.id]} now={now} role={role} />
        </section>
      ))}
    </div>
  );
}

function EmptyState({ tab, address }: { tab: TabId; address: string }) {
  if (tab === "paying")
    return (
      <div className="space-y-3 py-4">
        <p className="text-ink">You are not paying for any work yet.</p>
        <p className="max-w-[60ch] text-sm text-ink-soft">
          Write the milestones, name the freelancer and lock the payment. On devnet you pay with
          test dollars, so get some first if your balance is empty.
        </p>
        <div className="flex flex-wrap gap-2">
          <ButtonLink to="/new" kind="act">
            Create a deal
          </ButtonLink>
          <FaucetButton />
        </div>
      </div>
    );
  if (tab === "working")
    return (
      <div className="space-y-3 py-4">
        <p className="text-ink">No one has offered you a deal yet.</p>
        <p className="max-w-[60ch] text-sm text-ink-soft">
          Send your client this address. They create the deal and lock the payment, and it shows
          up here for you to accept.
        </p>
        <p className="tnum max-w-full break-all rounded-[var(--radius-control)] border border-rule bg-ground/50 px-3 py-2 text-sm text-ink">
          {address}
        </p>
      </div>
    );
  return (
    <div className="space-y-3 py-4">
      <p className="text-ink">Nobody has named you as an arbiter yet.</p>
      <p className="max-w-[60ch] text-sm text-ink-soft">
        When a deal lists your address as one of its three arbiters, it shows up here. You only
        need to act if the client raises an objection.
      </p>
      <ButtonLink to="/how" kind="plain">
        Read how arbiters vote
      </ButtonLink>
    </div>
  );
}

function RecentDeals({ now }: { now: number }) {
  const { data, isLoading } = useAllDeals();
  const recent = (data ?? []).slice(0, RECENT_LIMIT);
  return (
    <section className="space-y-3" aria-labelledby="recent-deals">
      <div className="space-y-1">
        <h2 id="recent-deals" className="text-lead font-semibold leading-snug">
          All recent deals
        </h2>
        <p className="max-w-[65ch] text-sm text-ink-soft">
          Every deal is public on Solana. As a Passer-by you can open any of them and release a
          payment once its timer is over.
        </p>
      </div>
      <Sheet className="px-4 py-3 sm:px-6">
        {isLoading ? (
          <p className="flex items-center gap-2 py-3 text-sm text-ink-soft">
            <Spinner /> Loading deals from devnet
          </p>
        ) : recent.length === 0 ? (
          <p className="py-3 text-sm text-ink-soft">No deals on devnet yet.</p>
        ) : (
          <>
            <ColumnHeads />
            <Rows deals={recent} now={now} />
          </>
        )}
      </Sheet>
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
    <div className="space-y-10">
      <section className="space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="space-y-1">
            <Heading level={1}>My deals</Heading>
            {actor && (
              <p className="flex items-center gap-1.5 text-sm text-ink-soft">
                Showing deals for
                <RoleMark shape={shapeForLabel(actor.label)} />
                <span className="font-semibold text-ink">{actor.label}</span>
              </p>
            )}
          </div>
          {publicKey && (
            <ButtonLink to="/new" kind="act">
              Create a deal
            </ButtonLink>
          )}
        </div>

        {!publicKey ? (
          <Sheet className="space-y-3 px-5 py-6 sm:px-6">
            <p className="text-ink">
              Connect a wallet
              {DEMO_MODE ? ", or pick a demo role in the header," : ""} to see the deals you pay
              for, work on or judge.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <WalletMultiButton />
              <ButtonLink to="/how" kind="quiet">
                How it works
              </ButtonLink>
            </div>
          </Sheet>
        ) : (
          <>
            <Segmented
              label="Show deals where"
              value={tab}
              onChange={(id) => setParams({ tab: id }, { replace: true })}
              segments={TABS.map((t) => ({ id: t.id, label: t.label, count: counts[t.id] }))}
            />
            <Sheet className="px-4 py-4 sm:px-6">
              {mine.isLoading ? (
                <p className="flex items-center gap-2 py-3 text-sm text-ink-soft">
                  <Spinner /> Loading your deals from devnet
                </p>
              ) : mine.error ? (
                <Notice tone="void" className="my-2">
                  Could not load deals. The network may be busy; this page retries on its own.
                </Notice>
              ) : deals.length === 0 ? (
                <EmptyState tab={tab} address={publicKey.toBase58()} />
              ) : (
                <>
                  <ColumnHeads />
                  <div className="pt-4">
                    <GroupedRows deals={deals} now={now} role={current.role} />
                  </div>
                </>
              )}
            </Sheet>
          </>
        )}
      </section>

      {DEMO_MODE && <RecentDeals now={now} />}
    </div>
  );
}
