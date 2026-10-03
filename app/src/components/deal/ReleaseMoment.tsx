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
import {
  explorerTxUrl,
  formatAmount,
  formatCountdown,
  shortAddress,
} from "../../lib/format";
import {
  Spinner,
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

  if (left > 0) {
    const pct = Math.min(
      100,
      Math.max(0, (1 - left / Math.max(1, deal.reviewWindowSecs)) * 100),
    );
    const urgent = left <= 10;
    return (
      <div
        className={`overflow-hidden rounded-2xl border-2 p-5 text-center transition-colors duration-700 ${urgent ? "border-amber-400 bg-amber-50" : "border-indigo-200 bg-gradient-to-b from-indigo-50 to-white"}`}
      >
        <p className="text-sm font-medium text-slate-600">
          {countdownLabel(role)}
        </p>
        <p
          className={`mt-1 font-mono text-6xl font-black tabular-nums tracking-tight sm:text-7xl ${urgent ? "text-amber-600" : "text-indigo-700"}`}
          aria-live="off"
        >
          {formatCountdown(left)}
        </p>
        <div className="mx-auto mt-4 h-2 max-w-md overflow-hidden rounded-full bg-slate-200">
          <div
            className={`h-full rounded-full transition-[width] duration-1000 ease-linear ${urgent ? "bg-amber-500" : "bg-indigo-500"}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="mt-3 text-xs text-slate-500">
          Counted on Solana's clock, the same clock the program uses. Silence
          pays the freelancer.
        </p>
      </div>
    );
  }

  if (!ready) {
    return (
      <div className="rounded-2xl border-2 border-amber-300 bg-amber-50 p-5 text-center">
        <p className="font-mono text-5xl font-black text-amber-600">00:00</p>
        <p className="mt-2 flex items-center justify-center gap-2 text-sm text-amber-900">
          <Spinner /> The review time is over. Waiting a few seconds for the
          network clock to agree…
        </p>
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

  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-600 p-6 text-white shadow-xl ring-4 ring-emerald-300/70">
      <span className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 animate-ping rounded-full bg-white/10" />
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-50/90">
        Nobody needs to approve
      </p>
      <h3 className="mt-1 text-2xl font-extrabold leading-tight sm:text-3xl">
        The review time is over. Anyone can release this payment.
      </h3>
      <p className="mt-2 text-sm text-emerald-50">
        {formatAmount(milestone.amount)} goes from the deal's vault straight to
        the freelancer. The rule is in the program; whoever presses the button
        only pays the network fee.
      </p>
      <button
        type="button"
        onClick={release}
        disabled={busy}
        className="mt-5 inline-flex items-center gap-3 rounded-xl bg-white px-7 py-4 text-lg font-extrabold text-emerald-700 shadow-lg transition hover:scale-[1.02] hover:bg-emerald-50 disabled:cursor-wait disabled:opacity-70"
      >
        {busy && <Spinner />}
        {busy ? "Releasing…" : label}
      </button>
    </div>
  );
}

/** The banner after a timer-released payment: who signed, and the receipt. */
export function PaidByRuleBanner({ receipt }: { receipt: MilestoneReceipt }) {
  const phrase = signerPhrase(receipt.signerRole);
  return (
    <div className="relative overflow-hidden rounded-2xl bg-slate-900 p-6 text-white shadow-xl">
      <div className="absolute inset-y-0 left-0 w-1.5 bg-gradient-to-b from-emerald-400 to-cyan-400" />
      <p className="text-2xl font-extrabold tracking-tight sm:text-3xl">
        Paid by rule.{" "}
        <span className="text-emerald-300">No one approved this.</span>
      </p>
      <p className="mt-2 text-base text-slate-200">
        Transaction signed by {phrase}:{" "}
        <span
          className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-emerald-200"
          title={receipt.signer.toBase58()}
        >
          {shortAddress(receipt.signer)}
        </span>
      </p>
      <a
        href={explorerTxUrl(receipt.signature)}
        target="_blank"
        rel="noreferrer"
        title={receipt.signature}
        className="mt-4 inline-block font-semibold text-emerald-300 underline underline-offset-4 hover:text-emerald-100"
      >
        View the receipt: the transfer from the vault to the freelancer
      </a>
    </div>
  );
}
