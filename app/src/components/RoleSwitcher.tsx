import { useActor, type ActorId } from "../providers/ActorProvider";
import { shortAddress } from "../lib/format";

/** Roles are told apart by a shape, never by hue alone: square client, round freelancer, triangle arbiter. */
export type RoleShape = "client" | "worker" | "arbiter" | "stranger" | "wallet";

export function shapeForLabel(label: string): RoleShape {
  const k = label.toLowerCase();
  if (k.startsWith("client")) return "client";
  if (k.startsWith("worker") || k.startsWith("freelancer")) return "worker";
  if (k.startsWith("arbiter")) return "arbiter";
  if (k.startsWith("passer")) return "stranger";
  return "wallet";
}

export function RoleMark({ shape, className = "" }: { shape: RoleShape; className?: string }) {
  const common = `inline-block shrink-0 ${className}`;
  switch (shape) {
    case "client":
      return <span aria-hidden className={`${common} h-2.5 w-2.5 bg-ink`} />;
    case "worker":
      return <span aria-hidden className={`${common} h-2.5 w-2.5 rounded-full bg-ink`} />;
    case "arbiter":
      return (
        <span
          aria-hidden
          className={`${common} h-0 w-0 border-x-[6px] border-b-[10px] border-x-transparent border-b-ink`}
        />
      );
    case "stranger":
      return <span aria-hidden className={`${common} h-2.5 w-2.5 rounded-full border-2 border-ink`} />;
    default:
      return <span aria-hidden className={`${common} h-2.5 w-2.5 rotate-45 border-2 border-ink`} />;
  }
}

/** A role named in words with its shape mark. `badge` is kept for older call sites. */
export function RoleBadge({ label }: { label: string; badge?: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink">
      <RoleMark shape={shapeForLabel(label)} />
      {label}
    </span>
  );
}

/**
 * "You:" control in the header. In demo mode it switches between the wallet and the demo actors;
 * outside demo mode it renders nothing (the wallet button speaks for itself).
 */
export function RoleSwitcher() {
  const { demoMode, demoActors, activeId, select, actor } = useActor();
  if (!demoMode) return null;
  const label = actor?.label ?? "Your wallet";

  return (
    <label className="group relative flex items-center gap-2 rounded-[var(--radius-control)] border border-ink/70 bg-sheet py-1.5 pl-2.5 pr-2 text-sm hover:border-stamp focus-within:border-stamp">
      <span className="text-ink-soft">You:</span>
      <RoleMark shape={shapeForLabel(label)} />
      <span className="font-semibold">{label}</span>
      <svg aria-hidden viewBox="0 0 10 6" className="ml-0.5 h-2 w-2.5 fill-ink-soft">
        <path d="M0 0h10L5 6z" />
      </svg>
      <select
        aria-label="Act as"
        value={activeId}
        onChange={(e) => select(e.target.value as ActorId)}
        className="absolute inset-0 cursor-pointer opacity-0"
      >
        <option value="wallet">Your wallet{actor?.kind === "wallet" && actor.publicKey ? ` (${shortAddress(actor.publicKey)})` : ""}</option>
        {demoActors.map((a) => (
          <option key={a.id} value={a.id}>
            {a.label} ({shortAddress(a.publicKey)})
          </option>
        ))}
      </select>
    </label>
  );
}
