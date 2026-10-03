// Small building blocks shared by the deal page components. Display only: no outcome logic.
import type { ButtonHTMLAttributes, ReactNode } from "react";
import type { PublicKey } from "@solana/web3.js";
import { hasMajority } from "@client/rules";
import type { ExplainedError } from "../../lib/errors";
import type { DealView, Role } from "../../lib/deals";
import { explorerAddressUrl, shortAddress } from "../../lib/format";
import { RoleMark } from "../RoleSwitcher";

type Variant =
  | "primary"
  | "secondary"
  | "danger"
  | "dangerSolid"
  | "success"
  | "proof"
  | "ghost";

// Mapped onto the design system (app/DESIGN.md): one violet action, ink outlines, red only to confirm loss.
const VARIANT: Record<Variant, string> = {
  primary: "bg-stamp text-sheet border border-stamp hover:bg-stamp-deep",
  secondary: "bg-sheet text-ink border border-ink/70 hover:bg-ground",
  danger: "bg-sheet text-void border border-void/70 hover:bg-void-wash",
  dangerSolid: "bg-void text-sheet border border-void hover:brightness-110",
  success: "bg-stamp text-sheet border border-stamp hover:bg-stamp-deep",
  proof: "bg-ink text-sheet border border-ink hover:bg-stamp",
  ghost: "text-ink-soft border border-transparent hover:text-ink hover:bg-ground",
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
      className={`inline-flex items-center justify-center gap-2 rounded-[var(--radius-control)] px-3.5 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-45 ${VARIANT[variant]} ${className}`}
    />
  );
}

export { Spinner } from "../ui";

/** A note band (neutral, info, warning, success). */
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
    neutral: "border-l-rule bg-ground/50 text-ink",
    info: "border-l-ink/40 bg-ground/60 text-ink",
    warning: "border-l-clock bg-clock-wash text-ink",
    success: "border-l-stamp bg-stamp-wash text-ink",
  } as const;
  return (
    <div
      className={`rounded-r-[var(--radius-control)] border-l-4 px-3 py-2 text-sm ${tones[tone]} ${className}`}
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
  client: "border-ink/60 text-ink",
  worker: "border-ink/60 text-ink",
  arbiter: "border-ink/60 text-ink",
  stranger: "border-ink/60 text-ink",
};

/** A role named in words with its shape mark (roles differ by shape, not hue). */
export function RoleChip({ role, text }: { role: Role; text?: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink">
      <RoleMark shape={role} />
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
      className="figures text-ink underline decoration-rule decoration-2 underline-offset-[3px] hover:decoration-stamp"
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
      className="font-semibold text-ink underline decoration-rule decoration-2 underline-offset-[3px] hover:decoration-stamp"
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
