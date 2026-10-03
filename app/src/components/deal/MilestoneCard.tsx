// One milestone, with the per-role view of PLAN 4.3 for every state. This component only
// decides which buttons to show; the program decides every outcome.
import { useState } from "react";
import {
  hasMajority,
  workerVotes,
  VOTE_NONE,
  VOTE_WORKER,
} from "@client/rules";
import { useProgram } from "../../hooks/useProgram";
import { useTx } from "../../hooks/useTx";
import { useActor } from "../../providers/ActorProvider";
import { useChainTime } from "../../providers/ChainTimeProvider";
import {
  proofsEnabled,
  type DealView,
  type MilestoneInfo,
  type Role,
} from "../../lib/deals";
import { COPY } from "../../lib/errors";
import {
  approveAndSettleIxs,
  openDisputeIx,
  settleMilestoneIx,
  voteIxs,
} from "../../lib/instructions";
import {
  crankReady,
  payoutFor,
  voteDecides,
  type SideName,
} from "../../lib/outcomes";
import {
  explorerAddressUrl,
  formatAmount,
  formatDateTime,
  formatDuration,
  milestoneStatusLabel,
} from "../../lib/format";
import { ReceiptLink } from "../ReceiptLink";
import {
  Btn,
  Note,
  PullLink,
  Spinner,
  signerPhrase,
  type MilestoneReceipt,
  type RecordReceipt,
} from "./common";
import { Countdown, TimerBar } from "./Countdown";
import { DeliverWorkForm, LinkPullRequestForm } from "./MilestoneForms";
import { ObjectionDialog } from "./ObjectionDialog";
import { OutcomeSentence } from "./OutcomeSentence";
import { PaidByRuleBanner, ReleaseMoment } from "./ReleaseMoment";
import { ProofPanel } from "./ProofPanel";
import { VoteTally } from "./VoteTally";

const STATUS_CHIP: Record<string, string> = {
  pending: "bg-slate-100 text-slate-700 ring-slate-300",
  submitted: "bg-indigo-100 text-indigo-800 ring-indigo-300",
  disputed: "bg-orange-100 text-orange-800 ring-orange-300",
  approved: "bg-emerald-100 text-emerald-800 ring-emerald-300",
  settled: "bg-emerald-600 text-white ring-emerald-700",
};

function hexShort(bytes: Uint8Array): string {
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join(
    "",
  );
  return `${hex.slice(0, 10)}…${hex.slice(-6)}`;
}

function SettledReceipt({
  deal,
  receipt,
}: {
  deal: DealView;
  receipt?: MilestoneReceipt;
}) {
  if (receipt?.kind === "silence")
    return <PaidByRuleBanner receipt={receipt} />;
  if (receipt)
    return (
      <p className="text-sm text-slate-600">
        Paid out in a transaction signed by {signerPhrase(receipt.signerRole)}.{" "}
        <ReceiptLink signature={receipt.signature} />
      </p>
    );
  return (
    <p className="text-sm text-slate-600">
      Receipts for this deal are in its{" "}
      <a
        href={explorerAddressUrl(deal.address)}
        target="_blank"
        rel="noreferrer"
        className="font-medium text-indigo-700 underline underline-offset-2"
      >
        transaction history
      </a>
      .
    </p>
  );
}

export function MilestoneCard({
  deal,
  milestone: m,
  role,
  arbiterSlot,
  now,
  receipt,
  onReceipt,
}: {
  deal: DealView;
  milestone: MilestoneInfo;
  role: Role;
  arbiterSlot: number;
  now: number;
  receipt?: MilestoneReceipt;
  onReceipt: RecordReceipt;
}) {
  const program = useProgram();
  const { publicKey } = useActor();
  const chain = useChainTime();
  const { send, busy } = useTx();
  const [objecting, setObjecting] = useState(false);

  const signer = () => {
    if (!publicKey) throw new Error(COPY.noWallet);
    return publicKey;
  };
  const remember = (
    sig: string | null,
    kind: MilestoneReceipt["kind"] = "settle",
  ) => {
    if (sig && publicKey)
      onReceipt(m.index, {
        signature: sig,
        signer: publicKey,
        signerRole: role,
        kind,
      });
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
      approveAndSettleIxs(program, {
        deal,
        index: m.index,
        now: Math.floor(chain.now()),
      }),
    ).then((sig) => remember(sig));

  const vote = (side: SideName) => {
    // When this vote creates a majority, voteIxs bundles the payout too.
    const decides = arbiterSlot >= 0 && voteDecides(m.votes, arbiterSlot, side);
    void send(
      side === "worker" ? "Side with freelancer" : "Side with client",
      async () =>
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

  const ready = crankReady(deal, m.index, now);
  const payout = ready ? payoutFor(deal, m.index, now) : null;
  const active = deal.status === "active";
  const canLinkPr =
    role === "client" &&
    deal.status !== "cancelled" &&
    deal.proofRepo !== "" &&
    proofsEnabled(deal) &&
    m.proofKind === "off" &&
    (m.status === "pending" || m.status === "submitted");

  const body: React.ReactNode[] = [];
  const actions: React.ReactNode[] = [];
  const spin = busy ? <Spinner /> : null;

  // ---------------------------------------------------------------- per state
  if (m.status === "settled") {
    body.push(<OutcomeSentence key="outcome" milestone={m} />);
    body.push(<SettledReceipt key="receipt" deal={deal} receipt={receipt} />);
  } else if (deal.status === "open") {
    body.push(
      <Note key="open">
        Waiting for the freelancer to accept. After that they have{" "}
        {formatDuration(m.dueSecs)} to deliver.
      </Note>,
    );
  } else if (deal.status === "cancelled") {
    body.push(
      <Note key="cancelled">
        {m.status === "approved"
          ? "This deal was cancelled, but this milestone was already approved, so it still goes to the freelancer."
          : hasMajority(m)
            ? "This deal was cancelled, but the arbiters had already decided this milestone, so their decision stands."
            : "This deal was cancelled, so this payment goes back to the client."}
      </Note>,
    );
    if (ready && payout)
      actions.push(
        <Btn
          key="pay"
          variant="success"
          disabled={busy}
          onClick={() => settle("Send payout")}
        >
          {spin}
          {payout.toWorker > 0n ? "Send payout" : "Refund the client"}
        </Btn>,
      );
  } else if (m.status === "pending") {
    const due = now < m.submitDeadline;
    if (role === "worker" && due) {
      body.push(
        <TimerBar
          key="due"
          label="Deliver before the deadline"
          deadline={m.submitDeadline}
          windowSecs={m.dueSecs}
          now={now}
        />,
      );
      body.push(<DeliverWorkForm key="deliver" deal={deal} milestone={m} />);
    } else if (due) {
      body.push(
        <p key="wait" className="text-sm text-slate-700">
          Waiting for delivery, due in{" "}
          <Countdown
            deadline={m.submitDeadline}
            now={now}
            className="font-semibold"
          />
          .
        </p>,
      );
    } else if (!ready) {
      body.push(
        <p
          key="late"
          className="flex items-center gap-2 text-sm text-slate-700"
        >
          <Spinner /> The delivery deadline has passed. Checking the network
          clock…
        </p>,
      );
    }
    if (ready) {
      body.push(
        <Note key="missed" tone="warning">
          The freelancer did not deliver in time. Anyone can now return this
          payment to the client.
        </Note>,
      );
      actions.push(
        <Btn
          key="refund"
          variant="primary"
          disabled={busy}
          onClick={() => settle("Return payment to client")}
        >
          {spin}Return payment to client
        </Btn>,
      );
    }
  } else if (m.status === "submitted") {
    body.push(
      <p key="delivered" className="text-sm text-slate-600">
        Delivered {formatDateTime(m.submittedAt)}. Fingerprint of the link:{" "}
        <span className="font-mono text-xs">{hexShort(m.deliverableHash)}</span>
      </p>,
    );
    body.push(
      <ReleaseMoment
        key="moment"
        deal={deal}
        milestone={m}
        role={role}
        now={now}
        onReceipt={onReceipt}
      />,
    );
    if (role === "client" && now < m.reviewDeadline) {
      const deposit = deal.disputeDeposit;
      actions.push(
        <Btn
          key="approve"
          variant="success"
          disabled={busy}
          onClick={() => approveAndPay("Approve and pay")}
        >
          {spin}Approve and pay
        </Btn>,
        <Btn
          key="object"
          variant="danger"
          disabled={busy}
          onClick={() => setObjecting(true)}
        >
          {deposit > 0n
            ? `Raise an objection (locks ${formatAmount(deposit)}; you lose it if the panel sides with the freelancer)`
            : "Raise an objection (free in this deal)"}
        </Btn>,
      );
    }
  } else if (m.status === "disputed") {
    const decided = hasMajority(m);
    const forWorker = workerVotes(m) >= 2;
    body.push(
      <VoteTally key="tally" deal={deal} milestone={m} mySlot={arbiterSlot} />,
    );
    if (!decided && now < m.voteDeadline)
      body.push(
        <TimerBar
          key="vote-timer"
          label="Voting ends in"
          deadline={m.voteDeadline}
          windowSecs={deal.voteWindowSecs}
          now={now}
          tone="amber"
        />,
      );
    if (m.depositLocked > 0n)
      body.push(
        <p key="deposit" className="text-xs text-slate-500">
          The client's deposit of {formatAmount(m.depositLocked)} is locked with
          this payment and goes to whoever wins it (back to the client on a
          50/50 split).
        </p>,
      );

    if (role === "arbiter" && arbiterSlot >= 0) {
      const mine = m.votes[arbiterSlot];
      if (mine !== VOTE_NONE)
        body.push(
          <Note key="voted" tone="info">
            You sided with the {mine === VOTE_WORKER ? "freelancer" : "client"}.
          </Note>,
        );
      else if (!decided && now < m.voteDeadline)
        actions.push(
          <Btn
            key="vw"
            variant="success"
            disabled={busy}
            onClick={() => vote("worker")}
          >
            {spin}Side with freelancer
          </Btn>,
          <Btn
            key="vc"
            variant="primary"
            disabled={busy}
            onClick={() => vote("client")}
          >
            {spin}Side with client
          </Btn>,
        );
    }
    if (role === "client" && !decided)
      actions.push(
        <Btn
          key="concede"
          variant="secondary"
          disabled={busy}
          onClick={() => approveAndPay("Concede and pay the freelancer")}
        >
          {spin}Concede and pay the freelancer (you lose the deposit)
        </Btn>,
      );
    if (decided) {
      body.push(
        <Note key="decided" tone="success">
          The arbiters decided for the {forWorker ? "freelancer" : "client"}.
          Anyone can now send the payout.
        </Note>,
      );
      actions.push(
        <Btn
          key="payout"
          variant="success"
          disabled={busy}
          onClick={() => settle("Send payout")}
        >
          {spin}
          {role === "worker" && forWorker ? "Collect payment" : "Send payout"}
        </Btn>,
      );
    } else if (ready) {
      body.push(
        <Note key="split" tone="warning">
          The voting time is over without a majority. The rule is a 50/50 split,
          with the deposit back to the client.
        </Note>,
      );
      actions.push(
        <Btn
          key="split"
          variant="primary"
          disabled={busy}
          onClick={() => settle("Split 50/50")}
        >
          {spin}Split 50/50
        </Btn>,
      );
    } else if (now >= m.voteDeadline) {
      body.push(
        <p
          key="vote-over"
          className="flex items-center gap-2 text-sm text-slate-700"
        >
          <Spinner /> The voting time is over. Checking the network clock…
        </p>,
      );
    }
  } else if (m.status === "approved") {
    body.push(
      <Note key="approved" tone="success">
        Payment approved
        {m.depositLocked > 0n
          ? `. The freelancer also receives the client's ${formatAmount(m.depositLocked)} deposit.`
          : "."}
      </Note>,
    );
    actions.push(
      <Btn
        key="payout"
        variant="success"
        disabled={busy}
        onClick={() =>
          settle(role === "worker" ? "Collect payment" : "Send payout")
        }
      >
        {spin}
        {role === "worker" ? "Collect payment" : "Send payout"}
      </Btn>,
    );
  }

  const momentReady =
    active && m.status === "submitted" && crankReady(deal, m.index, now);
  const border = momentReady
    ? "border-emerald-400 bg-emerald-50/60 shadow-emerald-200 shadow-lg"
    : m.status === "settled"
      ? "border-emerald-200 bg-white"
      : m.status === "disputed"
        ? "border-orange-200 bg-white"
        : "border-slate-200 bg-white";

  return (
    <article
      className={`space-y-4 rounded-2xl border-2 p-5 transition-colors duration-700 ${border}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold text-slate-900">
            Milestone {m.index + 1}
          </h3>
          <p className="text-2xl font-bold tabular-nums text-slate-900">
            {formatAmount(m.amount)}
          </p>
          {m.proofKind !== "off" && deal.proofRepo && (
            <p className="text-sm text-slate-600">
              Released by merging{" "}
              <PullLink repo={deal.proofRepo} n={m.proofRef} />
            </p>
          )}
        </div>
        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold ring-1 ${STATUS_CHIP[m.status] ?? ""}`}
        >
          {milestoneStatusLabel(m.status)}
        </span>
      </div>

      {body}

      <ProofPanel deal={deal} milestone={m} role={role} onReceipt={onReceipt} />

      {(actions.length > 0 || canLinkPr) && (
        <div className="flex flex-wrap items-center gap-2">
          {actions}
          {canLinkPr && <LinkPullRequestForm deal={deal} milestone={m} />}
        </div>
      )}

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
    </article>
  );
}
