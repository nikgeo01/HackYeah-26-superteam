// THE moment (PLAN 4.4): the review time runs out on chain time, and then anyone, even a
// stranger, can release the payment. The program decides; this only shows the button.
import { useProgram } from "../../hooks/useProgram";
import { useTx } from "../../hooks/useTx";
import { useActor } from "../../providers/ActorProvider";
import { useChainTime } from "../../providers/ChainTimeProvider";
import type { DealView, MilestoneInfo, Role } from "../../lib/deals";
import { COPY } from "../../lib/errors";
import { settleMilestoneIx } from "../../lib/instructions";
import { crankReady } from "../../lib/outcomes";
import { formatAmount, formatCountdown, shortAddress } from "../../lib/format";
import { Amount, splitAmount } from "../ui";
import {
  Btn,
  Spinner,
  TxLink,
  signerPhrase,
  type MilestoneReceipt,
  type RecordReceipt,
} from "./common";

function countdownLabel(role: Role): string {
  if (role === "worker") return "If the client says nothing, you are paid in";
  if (role === "client")
    return "Time left to approve or object. If you say nothing, the freelancer is paid in";
  return "If the client says nothing, the freelancer is paid in";
}

export function ReleaseMoment({
  deal,
  milestone,
  role,
  now,
  onReceipt,
}: {
  deal: DealView;
  milestone: MilestoneInfo;
  role: Role;
  now: number;
  onReceipt: RecordReceipt;
}) {
  const program = useProgram();
  const { publicKey } = useActor();
  const chain = useChainTime();
  const { send, busy } = useTx();

  if (milestone.status !== "submitted" || deal.status !== "active") return null;

  const left = milestone.reviewDeadline - now;
  const ready = crankReady(deal, milestone.index, now);

  // The review clock: large, live, amber in the last ten seconds.
  if (left > 0 || !ready) {
    const urgent = left <= 10;
    return (
      <div className="space-y-1">
        <p className="text-sm text-ink">
          {left > 0 ? (
            countdownLabel(role)
          ) : (
            <span className="flex items-center gap-2">
              <Spinner /> The review time is over. Waiting a few seconds for the network clock to
              agree…
            </span>
          )}
        </p>
        <div className="flex flex-wrap items-end gap-x-6 gap-y-1">
          <p
            role="timer"
            aria-live="off"
            className={`tnum text-display font-[650] leading-none tracking-[-0.03em] transition-colors duration-700 ${urgent ? "text-clock" : "text-ink"}`}
          >
            {formatCountdown(left)}
          </p>
          {left > 0 && (
            <p className="max-w-[36ch] pb-1 text-micro text-ink-soft">
              Counted on Solana's clock, the same clock the program uses. Silence pays the
              freelancer.
            </p>
          )}
        </div>
      </div>
    );
  }

  const label = role === "worker" ? "Collect payment" : "Release payment";
  const release = () =>
    void send(label, async () => {
      if (!publicKey) throw new Error(COPY.noWallet);
      const s = await settleMilestoneIx(program, {
        cranker: publicKey,
        deal,
        index: milestone.index,
        now: Math.floor(chain.now()),
      });
      return { instructions: [s.ix], atas: s.atas };
    }).then((sig) => {
      if (sig && publicKey)
        onReceipt(milestone.index, {
          signature: sig,
          signer: publicKey,
          signerRole: role,
          kind: "silence",
        });
    });

  const amount = splitAmount(formatAmount(milestone.amount));
  return (
    <div className="grid gap-x-8 gap-y-4 rounded-[var(--radius-sheet)] border-2 border-stamp bg-stamp-wash p-5 sm:grid-cols-[auto_1fr] sm:p-6">
      <p
        className="tnum text-display font-[650] leading-none tracking-[-0.03em] text-stamp"
        aria-hidden
      >
        00:00
      </p>
      <div className="space-y-3">
        <h4 className="text-title font-semibold leading-snug tracking-[-0.01em] text-ink">
          The review time is over. Anyone can release this payment.
        </h4>
        <p className="max-w-[60ch] text-sm text-ink-soft">
          <Amount value={amount.value} symbol={amount.symbol} size="sm" className="text-ink" /> goes
          from the deal's vault straight to the freelancer. The rule is in the program; whoever
          presses the button only pays the network fee.
        </p>
        <Btn size="lg" onClick={release} disabled={busy} aria-busy={busy}>
          {busy && <Spinner />}
          {busy ? "Releasing…" : label}
        </Btn>
      </div>
    </div>
  );
}

/** The line next to the stamp after a timer-released payment: who signed, and the receipt. */
export function PaidByRule({ receipt }: { receipt: MilestoneReceipt }) {
  return (
    <div className="space-y-1">
      <p className="text-lead font-semibold leading-snug text-ink">
        Paid by rule. No one approved this.
      </p>
      <p className="text-sm text-ink-soft">
        Transaction signed by {signerPhrase(receipt.signerRole)}:{" "}
        <span className="figures font-medium text-ink" title={receipt.signer.toBase58()}>
          {shortAddress(receipt.signer)}
        </span>
        .{" "}
        <TxLink signature={receipt.signature}>
          View the receipt: the transfer from the vault to the freelancer
        </TxLink>
      </p>
    </div>
  );
}
