// One milestone as a row on the deal's track, with the per-role view of PLAN 4.3 for every
// state. `planMilestone` decides which buttons to show; the program decides every outcome.
// When this milestone holds the viewer's move, its buttons are rendered into the "Your move"
// block at the top of the sheet (a portal), so there is one set of buttons and one busy state.
import { useState } from "react";
import { createPortal } from "react-dom";
import { VOTE_NONE, VOTE_WORKER, workerVotes } from "@client/rules";
import { useProgram } from "../../hooks/useProgram";
import { useTx } from "../../hooks/useTx";
import { useActor } from "../../providers/ActorProvider";
import { useChainTime } from "../../providers/ChainTimeProvider";
import type { DealView, MilestoneInfo, Role } from "../../lib/deals";
import { COPY } from "../../lib/errors";
import {
  approveAndSettleIxs,
  openDisputeIx,
  settleMilestoneIx,
  voteIxs,
} from "../../lib/instructions";
import { crankReady, payoutFor, voteDecides, type SideName } from "../../lib/outcomes";
import { formatAmount, formatDateTime } from "../../lib/format";
import { Amount, PhaseRun, splitAmount, Stamp, Tag, TrackNode } from "../ui";
import {
  Btn,
  PullLink,
  Spinner,
  TxLink,
  signerPhrase,
  type MilestoneReceipt,
  type RecordReceipt,
} from "./common";
import { DeliverWorkForm, LinkPullRequestForm } from "./MilestoneForms";
import { ObjectionDialog } from "./ObjectionDialog";
import { PaidByRule, ReleaseMoment } from "./ReleaseMoment";
import { ProofPanel } from "./ProofPanel";
import { VoteTally } from "./VoteTally";
import { planMilestone, type ActionKind } from "./plan";

function hexShort(bytes: Uint8Array): string {
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 10)}…${hex.slice(-6)}`;
}

function SettledReceipt({ receipt }: { receipt?: MilestoneReceipt }) {
  if (receipt?.kind === "silence") return <PaidByRule receipt={receipt} />;
  if (receipt)
    return (
      <p className="text-sm text-ink-soft">
        Paid out in a transaction signed by {signerPhrase(receipt.signerRole)}.{" "}
        <TxLink signature={receipt.signature} />
      </p>
    );
  // Without a receipt from this browser, the deal's transaction history (in Details) has it.
  return null;
}

export function MilestoneRow({
  deal,
  milestone: m,
  role,
  arbiterSlot,
  now,
  receipt,
  onReceipt,
  moveSlot,
  isMove,
}: {
  deal: DealView;
  milestone: MilestoneInfo;
  role: Role;
  arbiterSlot: number;
  now: number;
  receipt?: MilestoneReceipt;
  onReceipt: RecordReceipt;
  /** Element of the "Your move" block; set when this row's buttons belong there. */
  moveSlot: HTMLElement | null;
  /** True when this milestone holds the viewer's move. */
  isMove: boolean;
}) {
  const program = useProgram();
  const { publicKey } = useActor();
  const chain = useChainTime();
  const { send, busy } = useTx();
  const [objecting, setObjecting] = useState(false);
  // The stamp lands only for a settlement that happens while this page is open.
  const [sawUnsettled] = useState(m.status !== "settled");

  const signer = () => {
    if (!publicKey) throw new Error(COPY.noWallet);
    return publicKey;
  };
  const remember = (sig: string | null, kind: MilestoneReceipt["kind"] = "settle") => {
    if (sig && publicKey)
      onReceipt(m.index, { signature: sig, signer: publicKey, signerRole: role, kind });
    return sig;
  };

  /** A plain settle_milestone, labelled for the viewer. */
  const settle = (label: string) =>
    void send(label, async () => {
      const s = await settleMilestoneIx(program, {
        cranker: signer(),
        deal,
        index: m.index,
        now: Math.floor(chain.now()),
      });
      return { instructions: [s.ix], atas: s.atas };
    }).then((sig) => remember(sig));

  const approveAndPay = (label: string) =>
    void send(label, async () =>
      approveAndSettleIxs(program, { deal, index: m.index, now: Math.floor(chain.now()) }),
    ).then((sig) => remember(sig));

  const vote = (side: SideName) => {
    // When this vote creates a majority, voteIxs bundles the payout too.
    const decides = arbiterSlot >= 0 && voteDecides(m.votes, arbiterSlot, side);
    void send(side === "worker" ? "Side with freelancer" : "Side with client", async () =>
      voteIxs(program, {
        judge: signer(),
        deal,
        index: m.index,
        side,
        now: Math.floor(chain.now()),
      }),
    ).then((sig) => {
      if (decides) remember(sig);
    });
  };

  const object = () =>
    void send("Raise an objection", async () => ({
      instructions: [await openDisputeIx(program, { deal, index: m.index })],
    })).then((sig) => {
      if (sig) setObjecting(false);
    });

  const plan = planMilestone(deal, m, role, arbiterSlot, now, receipt);
  const ready = crankReady(deal, m.index, now);
  const payout = ready ? payoutFor(deal, m.index, now) : null;
  const spin = busy ? <Spinner /> : null;
  const deposit = deal.disputeDeposit;

  const render = (kind: ActionKind) => {
    switch (kind) {
      case "cancelledPayout":
        return (
          <Btn key={kind} disabled={busy} onClick={() => settle("Send payout")}>
            {spin}
            {payout && payout.toWorker > 0n ? "Send payout" : "Refund the client"}
          </Btn>
        );
      case "returnToClient":
        return (
          <Btn key={kind} disabled={busy} onClick={() => settle("Return payment to client")}>
            {spin}Return payment to client
          </Btn>
        );
      case "deliver":
        return <DeliverWorkForm key={kind} deal={deal} milestone={m} />;
      case "approve":
        return (
          <Btn key={kind} disabled={busy} onClick={() => approveAndPay("Approve and pay")}>
            {spin}Approve and pay {formatAmount(m.amount)}
          </Btn>
        );
      case "object":
        return (
          <span key={kind} className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <Btn
              variant="danger"
              disabled={busy}
              onClick={() => setObjecting(true)}
              data-preview-ok
            >
              Raise an objection
            </Btn>
            <span className="max-w-[40ch] text-micro text-ink-soft">
              {deposit > 0n
                ? `Locks ${formatAmount(deposit)}; you lose it if the arbiters side with the freelancer.`
                : "Free in this deal."}
            </span>
          </span>
        );
      case "vote":
        return (
          <span key={kind} className="flex flex-wrap gap-2">
            <Btn disabled={busy} onClick={() => vote("worker")}>
              {spin}Side with freelancer
            </Btn>
            <Btn disabled={busy} onClick={() => vote("client")}>
              {spin}Side with client
            </Btn>
          </span>
        );
      case "concede":
        return (
          <span key={kind} className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <Btn
              variant="secondary"
              disabled={busy}
              onClick={() => approveAndPay("Concede and pay the freelancer")}
            >
              {spin}Concede and pay the freelancer
            </Btn>
            <span className="text-micro text-ink-soft">You lose the deposit.</span>
          </span>
        );
      case "decidedPayout": {
        const forWorker = workerVotes(m) >= 2;
        return (
          <Btn key={kind} disabled={busy} onClick={() => settle("Send payout")}>
            {spin}
            {role === "worker" && forWorker ? "Collect payment" : "Send payout"}
          </Btn>
        );
      }
      case "split":
        return (
          <Btn key={kind} disabled={busy} onClick={() => settle("Split 50/50")}>
            {spin}Split 50/50
          </Btn>
        );
      case "approvedPayout":
        return (
          <Btn
            key={kind}
            disabled={busy}
            onClick={() => settle(role === "worker" ? "Collect payment" : "Send payout")}
          >
            {spin}
            {role === "worker" ? "Collect payment" : "Send payout"}
          </Btn>
        );
      case "linkPr":
        return <LinkPullRequestForm key={kind} deal={deal} milestone={m} />;
    }
  };

  const actions = plan.actions.length > 0 && (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">{plan.actions.map(render)}</div>
  );
  const portalled = isMove && moveSlot !== null && !plan.releaseReady;

  const mine = arbiterSlot >= 0 ? m.votes[arbiterSlot] : VOTE_NONE;
  const amount = splitAmount(formatAmount(m.amount));
  const settled = m.status === "settled";
  const byRule = settled && receipt?.kind === "silence";

  return (
    <li
      id={`milestone-${m.index + 1}`}
      className="relative grid scroll-mt-6 grid-cols-[1.5rem_minmax(0,1fr)] gap-x-3 pb-9 last:pb-1 sm:gap-x-5"
    >
      <span className="flex justify-center pt-1.5">
        <TrackNode state={plan.node} label={`Milestone ${m.index + 1}: ${m.status}`} />
      </span>

      <div className="min-w-0 space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
          <div className="space-y-0.5">
            <h3 className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="text-body font-semibold text-ink">Milestone {m.index + 1}</span>
              <Amount value={amount.value} symbol={amount.symbol} size="md" />
              {isMove && <Tag tone="stamp">Your move</Tag>}
            </h3>
            {m.proofKind !== "off" && deal.proofRepo && (
              <p className="text-sm text-ink-soft">
                Released by merging <PullLink repo={deal.proofRepo} n={m.proofRef} />
              </p>
            )}
          </div>
          {plan.stamp && !byRule && (
            <Stamp land={settled && sawUnsettled} tone={m.outcome === "cancelled" ? "ink" : "stamp"} className="mr-1 mt-1 [&>span]:px-3.5 [&>span]:py-1.5 [&>span]:text-[0.95rem]">
              {plan.stamp}
            </Stamp>
          )}
        </div>

        <div className="max-w-xl">
          <PhaseRun
            phases={plan.phases}
            current={plan.current}
            progress={plan.progress}
            urgent={plan.urgent}
          />
        </div>

        {plan.sentence && (
          <p className="flex max-w-[68ch] items-start gap-2 text-body text-ink">
            {plan.waiting && <Spinner className="mt-1.5" />}
            <span>{plan.sentence}</span>
          </p>
        )}

        {byRule && receipt ? (
          // The payoff of the release moment: the stamp lands next to who signed it.
          <div className="flex flex-wrap items-center gap-x-8 gap-y-4 rounded-[var(--radius-sheet)] border border-stamp/40 px-5 py-5 sm:px-6">
            <Stamp land={sawUnsettled} tilt={-5} className="[&>span]:px-4 [&>span]:py-2 [&>span]:text-[1.2rem]">
              {plan.stamp}
            </Stamp>
            <div className="min-w-0 flex-1 basis-64">
              <PaidByRule receipt={receipt} />
            </div>
          </div>
        ) : (
          settled && <SettledReceipt receipt={receipt} />
        )}

        {m.status === "submitted" && (
          <p className="text-micro text-ink-soft">
            Delivered {formatDateTime(m.submittedAt)}. Fingerprint of the link:{" "}
            <span className="figures">{hexShort(m.deliverableHash)}</span>
          </p>
        )}

        <ReleaseMoment deal={deal} milestone={m} role={role} now={now} onReceipt={onReceipt} />

        {m.status === "disputed" && (
          <>
            <VoteTally deal={deal} milestone={m} mySlot={arbiterSlot} />
            {m.depositLocked > 0n && (
              <p className="text-micro text-ink-soft">
                The client's deposit of {formatAmount(m.depositLocked)} is locked with this payment
                and goes to whoever wins it (back to the client on a 50/50 split).
              </p>
            )}
            {role === "arbiter" && arbiterSlot >= 0 && mine !== VOTE_NONE && (
              <p className="text-sm font-semibold text-ink">
                You sided with the {mine === VOTE_WORKER ? "freelancer" : "client"}.
              </p>
            )}
          </>
        )}

        <ProofPanel deal={deal} milestone={m} role={role} onReceipt={onReceipt} />

        {actions && (portalled && moveSlot ? createPortal(actions, moveSlot) : actions)}

        {plan.extras.length > 0 && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">{plan.extras.map(render)}</div>
        )}
      </div>

      {role === "client" && m.status === "submitted" && (
        <ObjectionDialog
          deal={deal}
          milestone={m}
          open={objecting}
          busy={busy}
          onCancel={() => setObjecting(false)}
          onConfirm={object}
        />
      )}
    </li>
  );
}
