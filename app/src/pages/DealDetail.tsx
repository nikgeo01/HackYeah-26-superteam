// /deal/:address (PLAN 4.1, 4.3, 4.4): terms, milestone cards with role-aware actions,
// countdowns on chain time, receipts. The page only picks buttons; the program decides.
import { useCallback, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useDeal } from "../hooks/useDeals";
import { useActor } from "../providers/ActorProvider";
import { useChainNow } from "../providers/ChainTimeProvider";
import { judgeIndex, roleIn, type DealView } from "../lib/deals";
import { explainError } from "../lib/errors";
import { ErrorBanner } from "../components/ErrorDetails";
import { ReceiptLink } from "../components/ReceiptLink";
import { ActionBar, type Finished } from "../components/deal/ActionBar";
import { CancelBanner } from "../components/deal/CancelBanner";
import { DealHeader } from "../components/deal/DealHeader";
import { MilestoneCard } from "../components/deal/MilestoneCard";
import { TermsPanel } from "../components/deal/TermsPanel";
import type { MilestoneReceipt } from "../components/deal/common";

function Centered({
  title,
  children,
}: {
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="mx-auto max-w-lg space-y-3 rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
      <h1 className="text-xl font-bold text-slate-900">{title}</h1>
      {children}
      <Link
        to="/deals"
        className="inline-block text-sm font-medium text-indigo-700 underline underline-offset-2"
      >
        Back to my deals
      </Link>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div
      className="animate-pulse space-y-4"
      aria-busy="true"
      aria-label="Loading the deal"
    >
      <div className="h-32 rounded-xl bg-slate-200" />
      <div className="grid gap-4 md:grid-cols-2">
        <div className="h-48 rounded-xl bg-slate-200" />
        <div className="h-48 rounded-xl bg-slate-200" />
      </div>
      <div className="h-56 rounded-2xl bg-slate-200" />
      <p className="text-center text-sm text-slate-500">Loading the deal…</p>
    </div>
  );
}

function DealBody({
  deal,
  onFinished,
}: {
  deal: DealView;
  onFinished: (f: Finished) => void;
}) {
  const { publicKey } = useActor();
  const now = useChainNow();
  const [receipts, setReceipts] = useState<Record<number, MilestoneReceipt>>(
    {},
  );
  const onReceipt = useCallback(
    (index: number, r: MilestoneReceipt) =>
      setReceipts((all) => ({ ...all, [index]: r })),
    [],
  );

  const role = roleIn(deal, publicKey);
  const slot = judgeIndex(deal, publicKey);

  return (
    <div className="space-y-5">
      <DealHeader deal={deal} role={role} arbiterSlot={slot} now={now} />
      <CancelBanner deal={deal} role={role} />
      <ActionBar deal={deal} role={role} now={now} onFinished={onFinished} />
      <section className="space-y-4" aria-label="Milestones">
        {deal.milestones.map((m) => (
          <MilestoneCard
            key={m.index}
            deal={deal}
            milestone={m}
            role={role}
            arbiterSlot={slot}
            now={now}
            receipt={receipts[m.index]}
            onReceipt={onReceipt}
          />
        ))}
      </section>
      <TermsPanel deal={deal} me={publicKey} />
    </div>
  );
}

export default function DealDetail() {
  const { address } = useParams();
  const { data: deal, isLoading, error, invalidAddress } = useDeal(address);
  const [finished, setFinished] = useState<
    (Finished & { address: string }) | null
  >(null);

  if (invalidAddress)
    return (
      <Centered title="This is not a valid deal address">
        <p className="text-sm text-slate-600">
          Check the link. A deal address is a long string of letters and digits.
        </p>
      </Centered>
    );

  if (isLoading) return <LoadingSkeleton />;

  if (error && !deal)
    return (
      <div className="space-y-3">
        <ErrorBanner error={explainError(error)} />
        <Link to="/deals" className="text-sm text-indigo-700 underline">
          Back to my deals
        </Link>
      </div>
    );

  if (!deal) {
    if (finished && finished.address === address)
      return (
        <Centered title="Done">
          <p className="text-slate-700">{finished.title}</p>
          <ReceiptLink signature={finished.signature} />
        </Centered>
      );
    return (
      <Centered title="Deal not found">
        <p className="text-sm text-slate-600">
          There is no deal at this address. It may have been closed after
          everything was paid out, or it was created on another network.
        </p>
      </Centered>
    );
  }

  return (
    <DealBody
      key={deal.address.toBase58()}
      deal={deal}
      onFinished={(f) => setFinished({ ...f, address: address ?? "" })}
    />
  );
}
