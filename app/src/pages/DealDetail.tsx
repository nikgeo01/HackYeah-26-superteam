// /deal/:address (PLAN 4.1, 4.3, 4.4): one ledger sheet with the milestone track, role-aware actions,
// countdowns on chain time, receipts. The page only picks buttons; the program decides.
import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useDeal } from "../hooks/useDeals";
import { useActor } from "../providers/ActorProvider";
import { useChainNow } from "../providers/ChainTimeProvider";
import { judgeIndex, roleIn, type DealView } from "../lib/deals";
import { explainError } from "../lib/errors";
import { ErrorBanner } from "../components/ErrorDetails";
import { Heading, Sheet } from "../components/ui";
import type { Finished } from "../components/deal/ActionBar";
import { DealSheet } from "../components/deal/DealSheet";
import { LINK, TxLink } from "../components/deal/common";

function Centered({
  title,
  children,
}: {
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <Sheet className="mx-auto max-w-lg space-y-3 p-8">
      <Heading level={2}>{title}</Heading>
      {children}
      <Link to="/deals" className={`inline-block text-sm ${LINK}`}>
        Back to my deals
      </Link>
    </Sheet>
  );
}

function LoadingSkeleton() {
  return (
    <Sheet className="space-y-6 p-8" as="div">
      <div aria-busy="true" aria-label="Loading the deal" className="space-y-6">
        <div className="h-14 w-64 max-w-full rounded-[var(--radius-control)] bg-rule-soft motion-safe:animate-pulse" />
        <div className="h-3 rounded-[3px] bg-rule-soft" />
        <div className="h-24 rounded-[var(--radius-control)] bg-rule-soft motion-safe:animate-pulse" />
        <div className="h-48 rounded-[var(--radius-control)] bg-rule-soft/60" />
        <p className="text-sm text-ink-soft">Loading the deal…</p>
      </div>
    </Sheet>
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
  return (
    <DealSheet
      deal={deal}
      role={roleIn(deal, publicKey)}
      arbiterSlot={judgeIndex(deal, publicKey)}
      me={publicKey}
      now={now}
      onFinished={onFinished}
    />
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
        <p className="text-sm text-ink-soft">
          Check the link. A deal address is a long string of letters and digits.
        </p>
      </Centered>
    );

  if (isLoading) return <LoadingSkeleton />;

  if (error && !deal)
    return (
      <div className="space-y-3">
        <ErrorBanner error={explainError(error)} />
        <Link to="/deals" className={`text-sm ${LINK}`}>
          Back to my deals
        </Link>
      </div>
    );

  if (!deal) {
    if (finished && finished.address === address)
      return (
        <Centered title="Done">
          <p className="text-ink">{finished.title}</p>
          <TxLink signature={finished.signature} />
        </Centered>
      );
    return (
      <Centered title="Deal not found">
        <p className="text-sm text-ink-soft">
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
