// Deal-level actions: accept or cancel an Open deal, "Withdraw all", and closing a finished
// deal (PLAN 4.3, 4.5 bundles). Milestone actions live in MilestoneCard.
import { useConnection } from "@solana/wallet-adapter-react";
import { useProgram } from "../../hooks/useProgram";
import { useTx } from "../../hooks/useTx";
import { useActor } from "../../providers/ActorProvider";
import { useChainTime } from "../../providers/ChainTimeProvider";
import { isFullySettled, type DealView, type Role } from "../../lib/deals";
import { COPY } from "../../lib/errors";
import {
  acceptDealIx,
  cancelOpenDealIxs,
  closeDealIx,
  settleManyIxs,
} from "../../lib/instructions";
import { crankReady, CRANK_BUFFER_SECS } from "../../lib/outcomes";
import { vaultPda } from "../../lib/pdas";
import { formatAmount, formatDuration } from "../../lib/format";
import {
  Btn,
  Note,
  PullLink,
  Spinner,
  ARBITER_LABEL,
  AddressLink,
} from "./common";
import { Countdown } from "./Countdown";

export interface Finished {
  title: string;
  signature: string;
}

/** Terms summary shown to the freelancer above "Accept this deal". */
function AcceptTerms({ deal }: { deal: DealView }) {
  const proofs = deal.milestones.filter((m) => m.proofKind !== "off");
  return (
    <div className="space-y-3 text-sm text-slate-700">
      <ul className="space-y-1">
        {deal.milestones.map((m) => (
          <li key={m.index} className="flex flex-wrap justify-between gap-2">
            <span>
              Milestone {m.index + 1}: deliver within{" "}
              {formatDuration(m.dueSecs)} of accepting
              {m.proofKind !== "off" && (
                <>
                  {" "}
                  · released by merging{" "}
                  <PullLink repo={deal.proofRepo} n={m.proofRef} />
                </>
              )}
            </span>
            <strong>{formatAmount(m.amount)}</strong>
          </li>
        ))}
      </ul>
      <ul className="list-disc space-y-1 pl-5">
        <li>
          After you deliver, the client has{" "}
          {formatDuration(deal.reviewWindowSecs)} to approve or object. If they
          say nothing, you are paid.
        </li>
        <li>
          An objection locks a deposit of{" "}
          {deal.disputeDeposit > 0n
            ? formatAmount(deal.disputeDeposit)
            : "nothing"}{" "}
          from the client. The arbiters then have{" "}
          {formatDuration(deal.voteWindowSecs)} to vote; with no majority the
          payment is split 50/50.
        </li>
        <li className="space-y-0.5">
          Arbiters:
          {deal.judges.map((j, i) => (
            <div key={j.toBase58()} className="flex flex-wrap gap-2 text-xs">
              <span>{ARBITER_LABEL[i]}</span>
              <AddressLink address={j} />
            </div>
          ))}
        </li>
      </ul>
      {deal.proofRepo && proofs.length > 0 && (
        <Note tone="warning">
          <strong>Repository {deal.proofRepo}.</strong> Check that this
          repository belongs to the client. Merging the pull request is their
          acceptance, and it releases your payment.
        </Note>
      )}
    </div>
  );
}

export function ActionBar({
  deal,
  role,
  now,
  onFinished,
}: {
  deal: DealView;
  role: Role;
  now: number;
  onFinished: (f: Finished) => void;
}) {
  const program = useProgram();
  const { connection } = useConnection();
  const { publicKey } = useActor();
  const chain = useChainTime();
  const { send, busy } = useTx();

  const signer = () => {
    if (!publicKey) throw new Error(COPY.noWallet);
    return publicKey;
  };

  const cancelOpen = (label: string) =>
    void send(label, async () =>
      cancelOpenDealIxs(program, {
        signer: signer(),
        deal,
        now: Math.floor(chain.now()),
      }),
    ).then((sig) => {
      if (sig)
        onFinished({
          title: "The deal was cancelled and the money returned to the client.",
          signature: sig,
        });
    });

  const blocks: React.ReactNode[] = [];

  // ---- Open deal
  if (deal.status === "open") {
    const acceptOpen = now < deal.acceptDeadline;
    const expired = now >= deal.acceptDeadline + CRANK_BUFFER_SECS;
    if (role === "worker" && acceptOpen) {
      blocks.push(
        <div
          key="accept"
          className="space-y-3 rounded-xl border-2 border-emerald-300 bg-emerald-50/50 p-4"
        >
          <h2 className="text-lg font-bold text-slate-900">
            Review the terms and accept
          </h2>
          <AcceptTerms deal={deal} />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-sm text-slate-600">
              Time left to accept:{" "}
              <Countdown
                deadline={deal.acceptDeadline}
                now={now}
                className="font-semibold"
              />
            </span>
            <Btn
              variant="success"
              disabled={busy}
              onClick={() =>
                void send("Accept this deal", async () => ({
                  instructions: [
                    await acceptDealIx(program, {
                      worker: signer(),
                      deal: deal.address,
                    }),
                  ],
                }))
              }
            >
              {busy && <Spinner />}Accept this deal
            </Btn>
          </div>
        </div>,
      );
    } else if (role === "client") {
      blocks.push(
        <div
          key="client-open"
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4"
        >
          <p className="text-sm text-amber-950">
            <strong>Waiting for the freelancer to accept.</strong> Your money is
            locked in the deal, not with us. You can cancel and get it all back
            until they accept.
          </p>
          <Btn
            variant="danger"
            disabled={busy}
            onClick={() => cancelOpen("Cancel deal")}
          >
            {busy && <Spinner />}Cancel and get a refund
          </Btn>
        </div>,
      );
    } else if (!expired) {
      blocks.push(
        <Note key="wait">
          {acceptOpen
            ? "Waiting for the freelancer to accept."
            : "The time to accept is over."}
        </Note>,
      );
    }
    if (expired && role !== "client") {
      blocks.push(
        <div
          key="expired"
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border-2 border-violet-300 bg-violet-50 p-4"
        >
          <p className="text-sm text-violet-950">
            <strong>The freelancer never accepted.</strong> Anyone can now
            cancel the deal; all of the money goes back to the client.
          </p>
          <Btn
            variant="primary"
            disabled={busy}
            onClick={() => cancelOpen("Cancel and refund the client")}
          >
            {busy && <Spinner />}Cancel and refund the client
          </Btn>
        </div>,
      );
    }
  }

  // ---- Withdraw all
  const ready = deal.milestones.filter((m) => crankReady(deal, m.index, now));
  if (deal.status !== "open" && ready.length >= 2) {
    const sum = ready.reduce((s, m) => s + m.amount, 0n);
    blocks.push(
      <div
        key="withdraw"
        className="flex flex-wrap items-center justify-between gap-3 rounded-xl border-2 border-emerald-300 bg-emerald-50 p-4"
      >
        <p className="text-sm text-emerald-950">
          <strong>{ready.length} payments are ready</strong> (milestones{" "}
          {ready.map((m) => m.index + 1).join(", ")}, {formatAmount(sum)} plus
          any deposits). Send them all in one transaction.
        </p>
        <Btn
          variant="success"
          disabled={busy}
          onClick={() =>
            void send("Withdraw all", async () => {
              const t = Math.floor(chain.now());
              return settleManyIxs(program, {
                cranker: signer(),
                deal,
                indexes: ready.map((m) => m.index),
                now: t,
              });
            })
          }
        >
          {busy && <Spinner />}Withdraw all
        </Btn>
      </div>,
    );
  }

  // ---- Close
  if (isFullySettled(deal)) {
    blocks.push(
      <div
        key="close"
        className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4"
      >
        <p className="text-sm text-slate-700">
          <strong>Every milestone is paid out.</strong> Anyone can close the
          deal; the small storage deposit (rent) goes back to the client.
        </p>
        <Btn
          variant="secondary"
          disabled={busy}
          onClick={() =>
            void send("Close deal and return rent", async () => {
              const vault = vaultPda(deal.address, program.programId);
              let balance = 0n;
              try {
                const res = await connection.getTokenAccountBalance(
                  vault,
                  "confirmed",
                );
                balance = BigInt(res.value.amount);
              } catch {
                // Vault already gone or unreadable: nothing to sweep.
              }
              const { ix, atas } = await closeDealIx(program, {
                cranker: signer(),
                deal,
                vaultBalance: balance,
              });
              return { instructions: [ix], atas };
            }).then((sig) => {
              if (sig)
                onFinished({
                  title:
                    "The deal is closed. Its rent went back to the client.",
                  signature: sig,
                });
            })
          }
        >
          {busy && <Spinner />}Close deal and return rent
        </Btn>
      </div>,
    );
  }

  if (blocks.length === 0) return null;
  return <div className="space-y-3">{blocks}</div>;
}
