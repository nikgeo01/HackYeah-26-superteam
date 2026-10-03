// The deal's terms in plain words, with raw addresses behind "Details" (PLAN 0, 4.1).
import type { PublicKey } from "@solana/web3.js";
import { PROGRAM_ID } from "../../lib/idl";
import { vaultPda } from "../../lib/pdas";
import { proofsEnabled, type DealView } from "../../lib/deals";
import { formatAmount, formatDateTime, formatDuration } from "../../lib/format";
import {
  AddressLink,
  ARBITER_LABEL,
  PullLink,
  repoUrl,
  RoleChip,
} from "./common";

function hex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 py-1.5">
      <dt className="text-sm text-slate-500">{label}</dt>
      <dd className="text-right text-sm text-slate-900">{children}</dd>
    </div>
  );
}

function Party({
  label,
  role,
  address,
  me,
}: {
  label: string;
  role: "client" | "worker" | "arbiter";
  address: PublicKey;
  me: PublicKey | null;
}) {
  const isMe = me?.equals(address) ?? false;
  return (
    <li className="flex flex-wrap items-center justify-between gap-2 py-1.5">
      <span className="flex items-center gap-2 text-sm">
        <RoleChip role={role} text={label} />
        {isMe && (
          <span className="text-xs font-semibold text-slate-500">you</span>
        )}
      </span>
      <AddressLink address={address} />
    </li>
  );
}

export function TermsPanel({
  deal,
  me,
}: {
  deal: DealView;
  me: PublicKey | null;
}) {
  const proofTargets = deal.milestones.filter((m) => m.proofKind !== "off");
  const vault = vaultPda(deal.address);
  return (
    <section className="grid gap-4 md:grid-cols-2">
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-slate-500">
          People
        </h2>
        <ul className="divide-y divide-slate-100">
          <Party label="Client" role="client" address={deal.client} me={me} />
          <Party
            label="Freelancer"
            role="worker"
            address={deal.worker}
            me={me}
          />
          {deal.judges.map((j, i) => (
            <Party
              key={j.toBase58()}
              label={ARBITER_LABEL[i]}
              role="arbiter"
              address={j}
              me={me}
            />
          ))}
        </ul>
      </div>
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Rules of this deal
        </h2>
        <dl className="divide-y divide-slate-100">
          <Row label="Total locked">{formatAmount(deal.total)}</Row>
          <Row label="Client's review time after delivery">
            {formatDuration(deal.reviewWindowSecs)}
          </Row>
          <Row label="Arbiters' voting time">
            {formatDuration(deal.voteWindowSecs)}
          </Row>
          <Row label="Objection deposit">
            {deal.disputeDeposit > 0n
              ? formatAmount(deal.disputeDeposit)
              : "None (objections are free)"}
          </Row>
          {deal.status === "open" && (
            <Row label="Accept by">{formatDateTime(deal.acceptDeadline)}</Row>
          )}
          {deal.acceptedAt > 0 && (
            <Row label="Accepted">{formatDateTime(deal.acceptedAt)}</Row>
          )}
          {deal.proofRepo && (
            <Row label="GitHub repository">
              <a
                href={repoUrl(deal.proofRepo)}
                target="_blank"
                rel="noreferrer"
                className="font-mono text-indigo-700 underline underline-offset-2"
              >
                {deal.proofRepo}
              </a>
            </Row>
          )}
          {proofTargets.length > 0 && (
            <Row label="Pull requests that release payment">
              <span className="flex flex-wrap justify-end gap-x-2">
                {proofTargets.map((m) => (
                  <span key={m.index}>
                    Milestone {m.index + 1}:{" "}
                    <PullLink repo={deal.proofRepo} n={m.proofRef} />
                  </span>
                ))}
              </span>
            </Row>
          )}
          <Row label="Created">{formatDateTime(deal.createdAt)}</Row>
        </dl>
      </div>
      <details className="rounded-xl border border-slate-200 bg-white p-4 text-sm shadow-sm md:col-span-2">
        <summary className="cursor-pointer select-none font-semibold text-slate-700">
          Details
        </summary>
        <dl className="mt-2 divide-y divide-slate-100">
          <Row label="Deal account (PDA)">
            <AddressLink address={deal.address} chars={8} />
          </Row>
          <Row label="Vault (holds the money)">
            <AddressLink address={vault} chars={8} />
          </Row>
          <Row label="Token mint">
            <AddressLink address={deal.mint} chars={8} />
          </Row>
          <Row label="Program">
            <AddressLink address={PROGRAM_ID} chars={8} />
          </Row>
          <Row label="Deal id">
            <span className="font-mono">{deal.dealId.toString()}</span>
          </Row>
          <Row label="Client">
            <AddressLink address={deal.client} chars={8} />
          </Row>
          <Row label="Freelancer">
            <AddressLink address={deal.worker} chars={8} />
          </Row>
          {deal.judges.map((j, i) => (
            <Row key={j.toBase58()} label={`Arbiter ${i + 1}`}>
              <AddressLink address={j} chars={8} />
            </Row>
          ))}
          <Row label="Proof attestor">
            <span className="font-mono">
              {proofsEnabled(deal)
                ? `0x${hex(deal.proofAttestor)}`
                : "None (proof release off)"}
            </span>
          </Row>
          <Row label="Cancel flags">
            <span className="font-mono">{deal.cancelFlags}</span>
          </Row>
        </dl>
      </details>
    </section>
  );
}
