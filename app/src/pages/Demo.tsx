// Demo page (PLAN 4.1, 4.7, ADR-10), only routed when VITE_DEMO_MODE=true: how the role
// switcher works, every demo actor with balances, and links to the pre-seeded deals.
import { Link } from "react-router-dom";
import { useActor } from "../providers/ActorProvider";
import { useBalances } from "../hooks/useBalances";
import { useDeal } from "../hooks/useDeals";
import { useChainNow } from "../providers/ChainTimeProvider";
import { RoleBadge } from "../components/RoleSwitcher";
import { DemoNote } from "../components/DemoNote";
import { DealCard } from "../components/DealCard";
import {
  explorerAddressUrl,
  formatAmount,
  formatSol,
  shortAddress,
} from "../lib/format";
import { DEMO_DEALS_RAW } from "../lib/env";
import { toPublicKey } from "../lib/pdas";
import type { DemoActor } from "../lib/actors";

/** Parses VITE_DEMO_DEALS (`{ "D1": "<address>", ... }`); bad entries are skipped. */
function parseDemoDeals(raw: string): { label: string; address: string }[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
      return [];
    return Object.entries(parsed as Record<string, unknown>).flatMap(
      ([label, value]) => {
        const key = toPublicKey(typeof value === "string" ? value : null);
        return key ? [{ label, address: key.toBase58() }] : [];
      },
    );
  } catch (err) {
    console.warn("VITE_DEMO_DEALS is not valid JSON", err);
    return [];
  }
}

const DEMO_DEALS = parseDemoDeals(DEMO_DEALS_RAW);

function ActorRow({
  actor,
  active,
  onSelect,
}: {
  actor: DemoActor;
  active: boolean;
  onSelect: () => void;
}) {
  const { data } = useBalances(actor.publicKey);
  const td = "py-2 pr-4 align-middle";
  return (
    <tr className={`border-b border-slate-100 ${active ? "bg-indigo-50" : ""}`}>
      <td className={td}>
        <RoleBadge label={actor.label} badge={actor.badge} />
      </td>
      <td className={`${td} text-slate-600`}>{actor.blurb}</td>
      <td className={td}>
        <a
          href={explorerAddressUrl(actor.publicKey)}
          target="_blank"
          rel="noreferrer"
          className="font-mono underline"
          title={actor.publicKey.toBase58()}
        >
          {shortAddress(actor.publicKey)}
        </a>
      </td>
      <td className={`${td} tabular-nums`}>
        {data ? formatAmount(data.tusdc) : "…"}
      </td>
      <td className={`${td} tabular-nums`}>
        {data ? formatSol(data.lamports) : "…"}
      </td>
      <td className="py-2">
        <button
          type="button"
          onClick={onSelect}
          disabled={active}
          className="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-sm font-medium hover:bg-slate-50 disabled:border-transparent disabled:bg-transparent disabled:text-slate-500"
        >
          {active ? "Active" : `Act as ${actor.label}`}
        </button>
      </td>
    </tr>
  );
}

function SeededDeal({
  label,
  address,
  now,
}: {
  label: string;
  address: string;
  now: number;
}) {
  const { data: deal, isLoading } = useDeal(address);
  return (
    <div className="space-y-1">
      <p className="text-sm font-semibold">
        {label}{" "}
        <Link
          to={`/deal/${address}`}
          className="font-mono text-xs font-normal text-indigo-700 underline"
        >
          {shortAddress(address)}
        </Link>
      </p>
      {isLoading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : deal ? (
        <DealCard deal={deal} now={now} />
      ) : (
        <p className="rounded-lg border border-dashed border-slate-300 p-4 text-sm text-slate-600">
          Not found. It may have been closed already, or not seeded yet.
        </p>
      )}
    </div>
  );
}

export default function Demo() {
  const { demoActors, activeId, select } = useActor();
  const now = useChainNow();

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <h1 className="text-2xl font-bold">Demo roles</h1>
        <p className="max-w-3xl text-slate-700">
          A deal has up to six people: the client, the freelancer (Worker),
          three arbiters and anyone else. To show it on one screen, the
          switcher in the header lets you act as any of them. Every action is
          a real devnet transaction signed by that person&apos;s key. The
          Passer-by has no part in any deal: use it to show that anyone can
          release a payment once its timer is over, and that the money still
          goes only to the client or the freelancer.
        </p>
        <p className="max-w-3xl text-sm text-slate-600">
          &quot;Your wallet&quot; switches back to your own wallet (for
          example Phantom), which can play the client.
        </p>
        <DemoNote />
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Demo people</h2>
        {demoActors.length === 0 ? (
          <p className="text-sm text-red-700">
            No demo people are configured in this build (VITE_DEMO_ACTORS).
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-slate-500">
                  <th className="py-2 pr-4 font-medium">Role</th>
                  <th className="py-2 pr-4 font-medium">Who</th>
                  <th className="py-2 pr-4 font-medium">Address</th>
                  <th className="py-2 pr-4 font-medium">Test dollars</th>
                  <th className="py-2 pr-4 font-medium">SOL for fees</th>
                  <th className="py-2 font-medium" />
                </tr>
              </thead>
              <tbody>
                <tr
                  className={`border-b border-slate-100 ${activeId === "wallet" ? "bg-indigo-50" : ""}`}
                >
                  <td className="py-2 pr-4" colSpan={5}>
                    Your wallet
                  </td>
                  <td className="py-2">
                    <button
                      type="button"
                      onClick={() => select("wallet")}
                      disabled={activeId === "wallet"}
                      className="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-sm font-medium hover:bg-slate-50 disabled:border-transparent disabled:bg-transparent disabled:text-slate-500"
                    >
                      {activeId === "wallet" ? "Active" : "Use my wallet"}
                    </button>
                  </td>
                </tr>
                {demoActors.map((a) => (
                  <ActorRow
                    key={a.id}
                    actor={a}
                    active={activeId === a.id}
                    onSelect={() => select(a.id)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Prepared deals</h2>
        {DEMO_DEALS.length === 0 ? (
          <p className="text-sm text-slate-600">
            No prepared deals in this build (VITE_DEMO_DEALS). Find recent
            deals under{" "}
            <Link to="/deals" className="text-indigo-700 underline">
              My deals
            </Link>
            , or{" "}
            <Link to="/new" className="text-indigo-700 underline">
              create one
            </Link>
            .
          </p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {DEMO_DEALS.map((d) => (
              <SeededDeal
                key={d.label}
                label={d.label}
                address={d.address}
                now={now}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
