// Small building blocks shared by the deal page components. Display only: no outcome logic.
import type { ButtonHTMLAttributes, ReactNode } from "react";
import type { PublicKey } from "@solana/web3.js";
import { hasMajority } from "@client/rules";
import type { ExplainedError } from "../../lib/errors";
import type { DealView, Role } from "../../lib/deals";
import { explorerAddressUrl, shortAddress } from "../../lib/format";

type Variant =
  | "primary"
  | "secondary"
  | "danger"
  | "dangerSolid"
  | "success"
  | "proof"
  | "ghost";

const VARIANT: Record<Variant, string> = {
  primary: "bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm",
  secondary:
    "bg-white text-slate-800 ring-1 ring-slate-300 hover:bg-slate-50 shadow-sm",
  danger: "bg-white text-red-700 ring-1 ring-red-300 hover:bg-red-50 shadow-sm",
  dangerSolid: "bg-red-600 text-white hover:bg-red-700 shadow-sm",
  success: "bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm",
  proof: "bg-violet-600 text-white hover:bg-violet-700 shadow-sm",
  ghost: "text-slate-600 hover:bg-slate-100",
};

/** Standard action button. */
export function Btn({
  variant = "primary",
  className = "",
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      type="button"
      {...rest}
      className={`inline-flex items-center justify-center gap-2 rounded-md px-3.5 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${VARIANT[variant]} ${className}`}
    />
  );
}

export function Spinner({ className = "" }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={`inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent ${className}`}
    />
  );
}

/** A labelled note in a card (neutral, info, warning). */
export function Note({
  tone = "neutral",
  children,
  className = "",
}: {
  tone?: "neutral" | "info" | "warning" | "success";
  children: ReactNode;
  className?: string;
}) {
  const tones = {
    neutral: "border-slate-200 bg-slate-50 text-slate-700",
    info: "border-sky-200 bg-sky-50 text-sky-900",
    warning: "border-amber-300 bg-amber-50 text-amber-900",
    success: "border-emerald-200 bg-emerald-50 text-emerald-900",
  } as const;
  return (
    <div
      className={`rounded-md border px-3 py-2 text-sm ${tones[tone]} ${className}`}
    >
      {children}
    </div>
  );
}

/** A local (non-transaction) failure in the same shape the app uses everywhere. */
export function localError(message: string, details = ""): ExplainedError {
  return { kind: "unknown", message, details: details || message };
}

/** Plain-language name of a role. Never "judge". */
export const ROLE_LABEL: Record<Role, string> = {
  client: "Client",
  worker: "Freelancer",
  arbiter: "Arbiter",
  stranger: "Passer-by",
};

export const ROLE_BADGE: Record<Role, string> = {
  client: "bg-sky-100 text-sky-800 ring-sky-300",
  worker: "bg-emerald-100 text-emerald-800 ring-emerald-300",
  arbiter: "bg-amber-100 text-amber-800 ring-amber-300",
  stranger: "bg-violet-100 text-violet-800 ring-violet-300",
};

export function RoleChip({ role, text }: { role: Role; text?: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ${ROLE_BADGE[role]}`}
    >
      {text ?? ROLE_LABEL[role]}
    </span>
  );
}

/** "Arbiter (client's pick)" etc. Slot order is fixed by the program. */
export const ARBITER_LABEL = [
  "Arbiter picked by the client",
  "Arbiter picked by the freelancer",
  "Arbiter picked by both",
] as const;

export const ARBITER_SHORT = [
  "Client's pick",
  "Freelancer's pick",
  "Picked by both",
] as const;

export function AddressLink({
  address,
  chars = 4,
}: {
  address: PublicKey | string;
  chars?: number;
}) {
  const text = typeof address === "string" ? address : address.toBase58();
  return (
    <a
      href={explorerAddressUrl(text)}
      target="_blank"
      rel="noreferrer"
      title={text}
      className="font-mono text-indigo-700 underline decoration-dotted underline-offset-2 hover:text-indigo-900"
    >
      {shortAddress(text, chars)}
    </a>
  );
}

export const repoUrl = (repo: string) => `https://github.com/${repo}`;
export const pullUrl = (repo: string, n: number) =>
  `https://github.com/${repo}/pull/${n}`;

export function PullLink({ repo, n }: { repo: string; n: number }) {
  return (
    <a
      href={pullUrl(repo, n)}
      target="_blank"
      rel="noreferrer"
      className="font-medium text-indigo-700 underline underline-offset-2 hover:text-indigo-900"
    >
      PR #{n}
    </a>
  );
}

/** How a signer relates to the deal, for the "signed by …" sentence. */
export function signerPhrase(role: Role): string {
  switch (role) {
    case "client":
      return "the client";
    case "worker":
      return "the freelancer";
    case "arbiter":
      return "one of the arbiters";
    default:
      return "a stranger";
  }
}

/** A receipt the page remembers for a milestone after this browser sent it. */
export interface MilestoneReceipt {
  signature: string;
  signer: PublicKey;
  signerRole: Role;
  /** "silence": released by the review timer (the moment). */
  kind: "silence" | "settle" | "proof";
}

/** Callback the milestone components use to remember a payout receipt. */
export type RecordReceipt = (index: number, receipt: MilestoneReceipt) => void;

/** True when a proof could still release this milestone (the program re-checks everything). */
export function proofPathOpen(deal: DealView, index: number): boolean {
  const m = deal.milestones[index];
  if (!m || m.proofKind !== "prMerged") return false;
  if (deal.status !== "active") return false;
  if (!["pending", "submitted", "disputed"].includes(m.status)) return false;
  return !hasMajority(m);
}
