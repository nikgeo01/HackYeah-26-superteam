import { useActor } from "../providers/ActorProvider";
import { useBalances } from "../hooks/useBalances";
import { RoleBadge } from "../components/RoleSwitcher";
import { DemoNote } from "../components/DemoNote";
import {
  formatAmount,
  formatSol,
  shortAddress,
  explorerAddressUrl,
} from "../lib/format";
import type { DemoActor } from "../lib/actors";

// Demo page (PLAN 4.1), only routed when VITE_DEMO_MODE=true. WP-51 adds links to seeded deals.
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
  return (
    <tr className={active ? "bg-indigo-50" : ""}>
      <td className="py-1 pr-3">
        <RoleBadge label={actor.label} badge={actor.badge} />
      </td>
      <td className="py-1 pr-3 text-slate-600">{actor.blurb}</td>
      <td className="py-1 pr-3">
        <a
          href={explorerAddressUrl(actor.publicKey)}
          target="_blank"
          rel="noreferrer"
          className="underline"
        >
          {shortAddress(actor.publicKey)}
        </a>
      </td>
      <td className="py-1 pr-3">{data ? formatAmount(data.tusdc) : "…"}</td>
      <td className="py-1 pr-3">{data ? formatSol(data.lamports) : "…"}</td>
      <td className="py-1">
        <button
          type="button"
          onClick={onSelect}
          disabled={active}
          className="text-sm text-indigo-700 underline disabled:no-underline disabled:text-slate-400"
        >
          {active ? "Active" : "Act as"}
        </button>
      </td>
    </tr>
  );
}

export default function Demo() {
  const { demoActors, activeId, select } = useActor();
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Demo roles</h1>
      <p className="text-slate-700">
        Use the switcher in the header to act as any person in a deal. The
        Passer-by has no part in any deal, which shows that anyone can release a
        payment once its timer is over.
      </p>
      <DemoNote />
      {demoActors.length === 0 ? (
        <p className="text-sm text-red-700">
          No demo actors configured (VITE_DEMO_ACTORS).
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="text-sm">
            <tbody>
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
    </div>
  );
}
