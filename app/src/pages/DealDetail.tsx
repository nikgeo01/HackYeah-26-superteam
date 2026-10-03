// /deal/:address (PLAN 4.1, 4.3, 4.4): one ledger sheet with the milestone track, role-aware actions,
// countdowns on chain time, receipts. The page only picks buttons; the program decides.
import { useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { useDeal } from "../hooks/useDeals";
import { useActor } from "../providers/ActorProvider";
import { useChainNow } from "../providers/ChainTimeProvider";
import { judgeIndex, roleIn, type DealView } from "../lib/deals";
import { explainError } from "../lib/errors";
import { ErrorBanner } from "../components/ErrorDetails";
import { Button, Heading, Notice, Sheet } from "../components/ui";
import { ExplorerButton } from "../components/ExplorerButton";
import type { Finished } from "../components/deal/ActionBar";
import { DealSheet } from "../components/deal/DealSheet";
import { LINK } from "../components/deal/common";

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

/** Shown once, right after the client created the deal: what just happened and how to check it. */
function CreatedBanner({ signature, total }: { signature: string; total: string }) {
  const [open, setOpen] = useState(true);
  const { demoMode, activeId, select } = useActor();
  if (!open) return null;
  const offerWorker = demoMode && activeId === "client";
  return (
    <Notice tone="move" className="mb-5 flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
      <span className="max-w-[60ch] space-y-0.5">
        <span className="block font-semibold">The deal is created and {total} is in escrow.</span>
        <span className="block text-ink-soft">
          The money left your account and now sits in the deal&apos;s vault on Solana. Next, the
          freelancer accepts the deal.
        </span>
      </span>
      <span className="flex flex-wrap items-center gap-2">
        <ExplorerButton signature={signature} kind="act" />
        {offerWorker && (
          <Button kind="plain" onClick={() => select("worker")}>
            Continue as the freelancer
          </Button>
        )}
        <Button kind="quiet" onClick={() => setOpen(false)}>
          Hide
        </Button>
      </span>
    </Notice>
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
  const created = (useLocation().state ?? null) as { created?: string; total?: string } | null;
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
          <ExplorerButton signature={finished.signature} kind="act" />
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
    <>
      {created?.created && (
        <CreatedBanner signature={created.created} total={created.total ?? "the payment"} />
      )}
      <DealBody
        key={deal.address.toBase58()}
        deal={deal}
        onFinished={(f) => setFinished({ ...f, address: address ?? "" })}
      />
    </>
  );
}
