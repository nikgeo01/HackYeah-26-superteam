// Create-deal wizard (PLAN 4.1, WP-22): people, milestones and timers, review and lock funds.
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { PublicKey } from "@solana/web3.js";
import { useActor } from "../providers/ActorProvider";
import { useProgram } from "../hooks/useProgram";
import { useTx } from "../hooks/useTx";
import { createDealIx } from "../lib/instructions";
import { newDealId } from "../lib/pdas";
import { DEFAULT_ATTESTOR } from "../lib/env";
import { TUSDC_MINT_KEY } from "../lib/faucet";
import { Button, Heading, Notice, Sheet, Spinner } from "../components/ui";
import { Agreement } from "../components/wizard/Agreement";
import { formatAmount } from "../lib/format";
import { StepPeople } from "../components/wizard/StepPeople";
import { StepTerms } from "../components/wizard/StepTerms";
import { StepReview } from "../components/wizard/StepReview";
import { checkPullRequest, type PrCheck } from "../components/wizard/github";
import {
  initialDraft,
  PEOPLE_FIELDS,
  validateDraft,
  type DealDraft,
} from "../components/wizard/model";

const STEPS = ["People", "Milestones and timers", "Review and lock"] as const;

export default function NewDeal() {
  const { publicKey: client, actor, demoMode, demoActors, select } = useActor();
  const demoClient = demoActors.find((a) => a.id === "client");
  // In the demo, creating a deal as an arbiter or the freelancer is almost always a slip.
  const wrongRole =
    demoMode && actor?.kind === "demo" && actor.id !== "client" && demoClient !== undefined;
  const program = useProgram();
  const { send, busy } = useTx();
  const navigate = useNavigate();

  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<DealDraft>(() =>
    initialDraft(DEFAULT_ATTESTOR),
  );
  const [attempted, setAttempted] = useState([false, false]);
  const [prChecks, setPrChecks] = useState<Record<number, PrCheck>>({});
  const [checking, setChecking] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Each step starts at the top of the page, not where the last one was scrolled to.
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [step]);

  const validated = useMemo(
    () => validateDraft(draft, client),
    [draft, client],
  );
  const { errors, input, total } = validated;

  const update = (patch: Partial<DealDraft>) => {
    setDraft((d) => ({ ...d, ...patch }));
    setPrChecks({});
    setSubmitError(null);
  };
  const replace = (next: DealDraft) => {
    setDraft(next);
    setPrChecks({});
  };

  /** A step's errors are shown once the user has tried to leave it. */
  const errFor = (stepIndex: number) => (key: string) =>
    attempted[stepIndex] ? errors[key] : undefined;

  const peopleErrors = Object.keys(errors).filter(PEOPLE_FIELDS);
  const termErrors = Object.keys(errors).filter((k) => !PEOPLE_FIELDS(k));

  const next = () => {
    const stepErrors = step === 0 ? peopleErrors : termErrors;
    setAttempted((a) => a.map((v, i) => (i === step ? true : v)));
    if (stepErrors.length === 0) setStep(step + 1);
  };

  const goTo = (target: number) => {
    // Going forward requires the steps in between to be valid.
    if (target > 0 && peopleErrors.length) {
      setAttempted([true, attempted[1]]);
      setStep(0);
      return;
    }
    if (target > 1 && termErrors.length) {
      setAttempted([true, true]);
      setStep(1);
      return;
    }
    setStep(target);
  };

  const submit = async () => {
    if (!input || !client) return;
    setSubmitError(null);
    if (!TUSDC_MINT_KEY) {
      setSubmitError(
        "The test-dollar mint is not configured in this build (VITE_TUSDC_MINT).",
      );
      return;
    }

    // Refuse pull requests that are not open (an already-merged PR would pay out at once).
    const prs = input.milestones.map((m) => m.proofRef).filter((n) => n > 0);
    if (prs.length) {
      setChecking(true);
      const results = await Promise.all(
        prs.map((n) => checkPullRequest(input.proofRepo, n)),
      );
      setChecking(false);
      setPrChecks(Object.fromEntries(results.map((r) => [r.pr, r])));
      const bad = results.filter((r) => !r.ok);
      if (bad.length) {
        setSubmitError(bad.map((r) => r.message).join(" "));
        return;
      }
    }

    const created: { deal?: PublicKey } = {};
    const signature = await send("Create the deal and lock the payment", async () => {
      const built = await createDealIx(program, {
        client,
        mint: TUSDC_MINT_KEY!,
        input: { ...input, dealId: newDealId() },
      });
      created.deal = built.deal;
      return { instructions: [built.ix] };
    });
    if (signature && created.deal)
      navigate(`/deal/${created.deal.toBase58()}`, {
        state: { created: signature, total: formatAmount(total) },
      });
  };

  const lockLabel =
    total > 0n
      ? `Lock ${formatAmount(total)} and create the deal`
      : "Lock the payment and create the deal";
  const onReview = step === 2;

  return (
    <div className="space-y-6">
      <div className="max-w-[62ch] space-y-2">
        <Heading level={1}>New deal</Heading>
        <p className="text-ink-soft">
          You are the client. In three steps you name the people, split the job into milestones, and
          then put the full payment into escrow: a vault on Solana that only this deal&apos;s rules
          can open. The freelancer sees the money is there before starting, and is paid milestone by
          milestone. Once created, nobody can change the rules, including you and us.
        </p>
      </div>

      {wrongRole && actor && (
        <Notice tone="clock" className="flex flex-wrap items-center justify-between gap-3">
          <span>
            You are acting as <strong className="font-semibold">{actor.label}</strong>. A deal is
            created and paid for by the client.
          </span>
          <Button kind="plain" onClick={() => select("client")}>
            Switch to Client
          </Button>
        </Notice>
      )}

      <nav aria-label="Steps">
        <ol className="flex items-start gap-2 sm:gap-3">
          {STEPS.map((label, i) => {
            const current = i === step;
            const done = i < step;
            return (
              <li key={label} className="flex min-w-0 flex-1 items-start gap-2 sm:flex-none sm:items-center sm:gap-3">
                <button
                  type="button"
                  onClick={() => goTo(i)}
                  aria-current={current ? "step" : undefined}
                  className="flex min-w-0 flex-col items-start gap-1.5 rounded-[var(--radius-control)] text-left sm:flex-row sm:items-center sm:gap-2.5"
                >
                  <span
                    aria-hidden
                    className={`figures flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 text-sm font-semibold ${
                      current
                        ? "border-ink bg-ink text-sheet"
                        : done
                          ? "border-ink text-ink"
                          : "border-rule text-ink-soft"
                    }`}
                  >
                    {i + 1}
                  </span>
                  <span
                    className={`text-sm leading-tight ${current ? "font-semibold text-ink" : done ? "text-ink" : "text-ink-soft"}`}
                  >
                    <span className="sr-only">Step {i + 1}: </span>
                    {label}
                  </span>
                </button>
                {i < STEPS.length - 1 && (
                  <span aria-hidden className="mt-3.5 hidden h-px w-10 bg-rule sm:block" />
                )}
              </li>
            );
          })}
        </ol>
      </nav>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,23rem)] lg:grid-rows-[auto_1fr] lg:gap-x-8">
        <Sheet className="order-1 px-5 py-6 sm:px-7 lg:col-start-1 lg:row-start-1">
          {step === 0 && (
            <StepPeople draft={draft} update={update} err={errFor(0)} client={client} />
          )}
          {step === 1 && (
            <StepTerms draft={draft} update={update} setDraft={replace} err={errFor(1)} />
          )}
          {onReview &&
            (input && client ? (
              <StepReview input={input} total={total} client={client} prChecks={prChecks} />
            ) : (
              <p className="text-sm text-void">
                {client
                  ? "Some details are missing or wrong. Go back to the earlier steps and fix the fields marked in red."
                  : "Connect a wallet, or pick a demo role in the header, to act as the client."}
              </p>
            ))}
        </Sheet>

        {/* On a phone the agreement follows the form; on the last step it comes before the lock button. */}
        <div
          className={`self-start lg:sticky lg:top-6 lg:col-start-2 lg:row-span-2 lg:row-start-1 ${onReview ? "order-2" : "order-3"}`}
        >
          <Agreement draft={draft} client={client} />
        </div>

        <div className={`space-y-4 self-start lg:col-start-1 lg:row-start-2 ${onReview ? "order-3" : "order-2"}`}>
          {submitError && <Notice tone="void">{submitError}</Notice>}
          <div className="flex flex-wrap-reverse items-center justify-between gap-3">
            {step > 0 ? (
              <Button
                kind="quiet"
                onClick={() => setStep(step - 1)}
                disabled={busy || checking}
                className="-ml-3.5"
              >
                Back to {STEPS[step - 1].toLowerCase()}
              </Button>
            ) : (
              <span />
            )}
            {!onReview ? (
              <Button size="lg" onClick={next}>
                Continue to {STEPS[step + 1].toLowerCase()}
              </Button>
            ) : (
              <Button
                size="lg"
                onClick={() => void submit()}
                disabled={!input || !client || busy || checking}
              >
                {(checking || busy) && <Spinner />}
                {checking
                  ? "Checking pull requests on GitHub"
                  : busy
                    ? `Locking ${formatAmount(total)}`
                    : lockLabel}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
