// "The agreement so far": the deal written as plain sentences while the form is filled in.
// It reads the raw draft (not the validated input), so it can show a half-written deal;
// anything not filled in yet is a blank line, like an unsigned contract.
import type { ReactNode } from "react";
import type { PublicKey } from "@solana/web3.js";
import { useActor } from "../../providers/ActorProvider";
import { RoleMark, type RoleShape } from "../RoleSwitcher";
import { Amount, Sheet, splitAmount } from "../ui";
import { InlineAmount } from "../ui/InlineAmount";
import { formatAmount, formatDuration, parseAmount, shortAddress } from "../../lib/format";
import { toPublicKey } from "../../lib/pdas";
import { durationSecs, type DealDraft, type DurationDraft } from "./model";

/** An unfilled part of the agreement. */
function Blank({ children = "not set yet" }: { children?: ReactNode }) {
  return (
    <span className="whitespace-nowrap border-b border-dashed border-ink-soft/60 px-0.5 text-ink-soft">
      {children}
    </span>
  );
}

const Money = InlineAmount;

function Time({ d }: { d: DurationDraft }) {
  const secs = durationSecs(d);
  return secs === null || secs <= 0 ? <Blank /> : <strong className="font-semibold">{formatDuration(secs)}</strong>;
}

/** A person: shape mark, demo name when known, and the short address. */
export function Party({
  address,
  shape,
  fallback,
}: {
  address: PublicKey | string | null;
  shape: RoleShape;
  fallback: string;
}) {
  const { demoActors } = useActor();
  const key = typeof address === "string" ? toPublicKey(address.trim()) : address;
  if (!key) return <Blank>{fallback}</Blank>;
  const demo = demoActors.find((a) => a.publicKey.equals(key));
  return (
    <span className="whitespace-nowrap" title={key.toBase58()}>
      <RoleMark shape={shape} className="mr-1.5 align-[0.05em]" />
      {demo ? (
        <>
          <strong className="font-semibold">{demo.label}</strong>{" "}
          <span className="text-ink-soft">({shortAddress(key)})</span>
        </>
      ) : (
        <strong className="font-semibold">{shortAddress(key)}</strong>
      )}
    </span>
  );
}

function Clause({ children }: { children: ReactNode }) {
  return <li className="py-3 text-sm leading-relaxed">{children}</li>;
}

export function Agreement({
  draft,
  client,
}: {
  draft: DealDraft;
  client: PublicKey | null;
}) {
  const amounts = draft.milestones.map((m) => {
    const raw = parseAmount(m.amount);
    return raw !== null && raw > 0n ? raw : null;
  });
  const total = amounts.reduce<bigint>((sum, a) => sum + (a ?? 0n), 0n);
  const allPriced = amounts.every((a) => a !== null);
  const count = draft.milestones.length;
  const deposit = draft.deposit.trim() === "" ? 0n : parseAmount(draft.deposit);
  const repo = draft.repo.trim();
  const linked = draft.milestones
    .map((m, i) => ({ n: i + 1, pr: m.pr.trim().replace(/^#/, "") }))
    .filter((m) => /^\d+$/.test(m.pr) && Number(m.pr) > 0);
  const judgesNamed = draft.judges.some((j) => j.trim() !== "");

  return (
    <Sheet as="aside" className="px-5 py-5">
      <h2 className="text-body font-semibold">The agreement so far</h2>
      <div className="mt-3 border-b border-rule pb-4">
        {total > 0n ? (
          <span className="block">
            <Amount {...splitAmount(formatAmount(total))} size="lg" />
          </span>
        ) : (
          <span className="block text-amount font-[650] leading-none tracking-[-0.02em] text-rule">0.00</span>
        )}
        <p className="mt-1.5 text-sm text-ink-soft">
          {allPriced ? "locked by you when the deal is created" : "locked by you when the deal is created, once every milestone has an amount"}
        </p>
      </div>

      <ul className="ledger">
        <Clause>
          {client ? (
            <>
              You, <Party address={client} shape="client" fallback="" />, pay as the client.
            </>
          ) : (
            <>
              You pay as the client, from <Blank>a connected wallet</Blank>.
            </>
          )}
        </Clause>
        <Clause>
          <Party address={draft.worker} shape="worker" fallback="The freelancer" /> delivers{" "}
          {count === 1 ? "1 milestone" : `${count} milestones`} for{" "}
          {total > 0n ? <Money raw={total} /> : <Blank>an amount</Blank>} in total, and has <Time d={draft.accept} /> to accept,
          or your money comes back.
        </Clause>
      </ul>

      <ol className="ledger my-1 rounded-[var(--radius-control)] bg-ground/50 px-3 text-sm">
        {draft.milestones.map((m, i) => (
          <li key={m.key} className="flex items-baseline justify-between gap-3 py-2">
            <span>
              <span className="font-semibold">Milestone {i + 1}</span>
              <span className="text-ink-soft">, due <Time d={m.due} /> after acceptance</span>
            </span>
            {amounts[i] !== null ? <Money raw={amounts[i]!} /> : <Blank>amount</Blank>}
          </li>
        ))}
      </ol>

      <ul className="ledger">
        <Clause>
          If you say nothing for <Time d={draft.review} /> after a delivery, the freelancer is paid.
        </Clause>
        <Clause>
          {judgesNamed ? (
            <>
              If you object, <Party address={draft.judges[0]} shape="arbiter" fallback="arbiter 1" />,{" "}
              <Party address={draft.judges[1]} shape="arbiter" fallback="arbiter 2" /> and{" "}
              <Party address={draft.judges[2]} shape="arbiter" fallback="arbiter 3" /> vote.
            </>
          ) : (
            <>If you object, <Blank>three arbiters</Blank> vote.</>
          )}{" "}
          Two matching votes decide. With no majority after <Time d={draft.vote} />, the payment is split 50/50.
        </Clause>
        <Clause>
          {deposit === null ? (
            <>An objection locks <Blank>a deposit</Blank>.</>
          ) : deposit === 0n ? (
            <span className="text-clock">
              Objections cost you nothing. That leaves the freelancer without protection against objections made in bad faith.
            </span>
          ) : (
            <>
              An objection locks <Money raw={deposit} />; you lose it if the arbiters side with the freelancer.
            </>
          )}
        </Clause>
        {repo && (
          <Clause>
            {linked.length ? (
              <>
                Merging{" "}
                {linked.map((m, i) => (
                  <span key={m.n}>
                    {i > 0 && (i === linked.length - 1 ? " or " : ", ")}
                    pull request #{m.pr}
                  </span>
                ))}{" "}
                in <strong className="font-semibold">{repo}</strong> pays{" "}
                {linked.length === 1 ? `milestone ${linked[0].n}` : "its milestone"} at once.
              </>
            ) : (
              <>
                Pull requests in <strong className="font-semibold">{repo}</strong> can release payments once a milestone names one.
              </>
            )}
          </Clause>
        )}
      </ul>
    </Sheet>
  );
}
