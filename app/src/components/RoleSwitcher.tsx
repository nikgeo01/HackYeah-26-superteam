import { useActor, type ActorId } from "../providers/ActorProvider";
import { WALLET_BADGE } from "../lib/actors";
import { shortAddress } from "../lib/format";

/** Coloured badge for the active role. */
export function RoleBadge({ label, badge }: { label: string; badge: string }) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ${badge}`}
    >
      {label}
    </span>
  );
}

/** Header dropdown to act as the wallet or one of the demo actors. Renders nothing outside demo mode. */
export function RoleSwitcher() {
  const { demoMode, demoActors, activeId, select, actor } = useActor();
  if (!demoMode) return null;
  const badge = actor?.badge ?? WALLET_BADGE;
  const label = actor?.label ?? "Your wallet (not connected)";

  return (
    <div className="flex items-center gap-2">
      <RoleBadge label={label} badge={badge} />
      <label className="sr-only" htmlFor="role-switcher">
        Act as
      </label>
      <select
        id="role-switcher"
        value={activeId}
        onChange={(e) => select(e.target.value as ActorId)}
        className="rounded-md border border-slate-300 bg-white px-2 py-1 text-sm"
      >
        <option value="wallet">Your wallet</option>
        {demoActors.map((a) => (
          <option key={a.id} value={a.id}>
            {a.label} ({shortAddress(a.publicKey)})
          </option>
        ))}
      </select>
    </div>
  );
}
