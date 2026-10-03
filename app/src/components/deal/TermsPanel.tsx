// The bottom of the deal sheet: the people and the rules as ledger rows, with raw addresses
// behind a quiet "Details" (PLAN 0, 4.1).
import type { ReactNode } from "react";
import type { PublicKey } from "@solana/web3.js";
import { PROGRAM_ID } from "../../lib/idl";
import { vaultPda } from "../../lib/pdas";
import { proofsEnabled, type DealView, type Role } from "../../lib/deals";
import { explorerAddressUrl, formatAmount, formatDateTime, formatDuration } from "../../lib/format";
import { Ledger } from "../ui";
import { AddressLink, ARBITER_LABEL, LINK, PullLink, repoUrl, RoleChip } from "./common";

function hex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function person(
  label: string,
  role: Exclude<Role, "stranger">,
  address: PublicKey,
  me: PublicKey | null,
) {
  const isMe = me?.equals(address) ?? false;
  return {
    key: `${label}-${address.toBase58()}`,
    label: (
      <span className="inline-flex flex-wrap items-center gap-x-2">
        <RoleChip role={role} text={label} />
        {isMe && <span className="text-micro font-semibold text-ink-soft">you</span>}
      </span>
    ),
    value: <AddressLink address={address} />,
  };
}

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="min-w-0 space-y-1">
      <h2 className="text-body font-semibold text-ink">{title}</h2>
      {children}
    </section>
  );
}

export function TermsPanel({ deal, me }: { deal: DealView; me: PublicKey | null }) {
  const proofTargets = deal.milestones.filter((m) => m.proofKind !== "off");
  const vault = vaultPda(deal.address);
  const rules: { label: ReactNode; value: ReactNode; key?: string }[] = [
    { label: "Total locked", value: formatAmount(deal.total) },
    { label: "Client's review time after delivery", value: formatDuration(deal.reviewWindowSecs) },
    { label: "Arbiters' voting time", value: formatDuration(deal.voteWindowSecs) },
    {
      label: "Objection deposit",
      value: deal.disputeDeposit > 0n ? formatAmount(deal.disputeDeposit) : "None (objections are free)",
    },
  ];
  if (deal.status === "open")
    rules.push({ label: "Accept by", value: formatDateTime(deal.acceptDeadline) });
  if (deal.acceptedAt > 0) rules.push({ label: "Accepted", value: formatDateTime(deal.acceptedAt) });
  if (deal.proofRepo)
    rules.push({
      label: "GitHub repository",
      value: (
        <a href={repoUrl(deal.proofRepo)} target="_blank" rel="noreferrer" className={LINK}>
          {deal.proofRepo}
        </a>
      ),
    });
  if (proofTargets.length > 0)
    rules.push({
      label: "Pull requests that release payment",
      value: (
        <span className="flex flex-wrap justify-end gap-x-3">
          {proofTargets.map((m) => (
            <span key={m.index}>
              Milestone {m.index + 1}: <PullLink repo={deal.proofRepo} n={m.proofRef} />
            </span>
          ))}
        </span>
      ),
    });
  rules.push({ label: "Created", value: formatDateTime(deal.createdAt) });

  const details: { label: ReactNode; value: ReactNode }[] = [
    {
      label: "Receipts",
      value: (
        <a href={explorerAddressUrl(deal.address)} target="_blank" rel="noreferrer" className={LINK}>
          Transaction history
        </a>
      ),
    },
    { label: "Deal account (PDA)", value: <AddressLink address={deal.address} chars={8} /> },
    { label: "Vault (holds the money)", value: <AddressLink address={vault} chars={8} /> },
    { label: "Token mint", value: <AddressLink address={deal.mint} chars={8} /> },
    { label: "Program", value: <AddressLink address={PROGRAM_ID} chars={8} /> },
    { label: "Deal id", value: deal.dealId.toString() },
    { label: "Client", value: <AddressLink address={deal.client} chars={8} /> },
    { label: "Freelancer", value: <AddressLink address={deal.worker} chars={8} /> },
    ...deal.judges.map((j, i) => ({
      label: `Arbiter ${i + 1}`,
      value: <AddressLink address={j} chars={8} />,
    })),
    {
      label: "Proof attestor",
      value: (
        <span className="break-all">
          {proofsEnabled(deal) ? `0x${hex(deal.proofAttestor)}` : "None (proof release off)"}
        </span>
      ),
    },
    { label: "Cancel flags", value: deal.cancelFlags },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-x-12 gap-y-8 md:grid-cols-2">
        <Block title="People">
          <Ledger
            rows={[
              person("Client", "client", deal.client, me),
              person("Freelancer", "worker", deal.worker, me),
              ...deal.judges.map((j, i) => person(ARBITER_LABEL[i], "arbiter", j, me)),
            ]}
          />
        </Block>
        <Block title="Rules of this deal">
          <Ledger rows={rules} />
        </Block>
      </div>
      <details className="group text-sm">
        <summary className="inline-flex cursor-pointer select-none list-none items-center gap-1.5 rounded-[var(--radius-control)] text-ink-soft hover:text-ink [&::-webkit-details-marker]:hidden">
          <svg aria-hidden viewBox="0 0 10 6" className="h-1.5 w-2.5 -rotate-90 fill-current transition-transform group-open:rotate-0">
            <path d="M0 0h10L5 6z" />
          </svg>
          Details
        </summary>
        <Ledger className="mt-2 max-w-2xl" rows={details} />
      </details>
    </div>
  );
}
