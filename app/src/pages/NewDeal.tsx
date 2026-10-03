// Create-deal wizard (PLAN 4.1, WP-22): people, milestones and timers, review and lock funds.
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { PublicKey } from "@solana/web3.js";
import { useActor } from "../providers/ActorProvider";
import { useProgram } from "../hooks/useProgram";
import { useTx } from "../hooks/useTx";
import { createDealIx } from "../lib/instructions";
import { newDealId } from "../lib/pdas";
import { DEFAULT_ATTESTOR } from "../lib/env";
import { TUSDC_MINT_KEY } from "../lib/faucet";
import { Button } from "../components/wizard/fields";
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

const STEPS = [
  "The people",
  "Milestones and timers",
  "Review and lock funds",
] as const;

export default function NewDeal() {
  const { publicKey: client } = useActor();
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
      navigate(`/deal/${created.deal.toBase58()}`);
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold">New deal</h1>
        <p className="text-sm text-slate-600">
          You lock the full payment now. It is released milestone by milestone
          under the rules below, and nobody can change them afterwards.
        </p>
      </div>

      <ol className="flex flex-wrap gap-2">
        {STEPS.map((label, i) => (
          <li key={label}>
            <button
              type="button"
              onClick={() => goTo(i)}
              className={`rounded-full px-3 py-1 text-sm font-medium ${
                i === step
                  ? "bg-indigo-600 text-white"
                  : i < step
                    ? "bg-indigo-100 text-indigo-800"
                    : "bg-slate-100 text-slate-600"
              }`}
              aria-current={i === step ? "step" : undefined}
            >
              {i + 1}. {label}
            </button>
          </li>
        ))}
      </ol>

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        {step === 0 && (
          <StepPeople
            draft={draft}
            update={update}
            err={errFor(0)}
            client={client}
          />
        )}
        {step === 1 && (
          <StepTerms
            draft={draft}
            update={update}
            setDraft={replace}
            err={errFor(1)}
          />
        )}
        {step === 2 &&
          (input && client ? (
            <StepReview
              input={input}
              total={total}
              client={client}
              prChecks={prChecks}
            />
          ) : (
            <p className="text-sm text-red-700">
              {client
                ? "Some details are missing or wrong. Go back to fix them."
                : "Connect a wallet (or pick a demo role) to act as the client."}
            </p>
          ))}
      </div>

      {submitError && (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">
          {submitError}
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button
          onClick={() => setStep(step - 1)}
          disabled={step === 0 || busy || checking}
        >
          Back
        </Button>
        {step < 2 ? (
          <Button variant="primary" onClick={next}>
            Next
          </Button>
        ) : (
          <Button
            variant="primary"
            onClick={() => void submit()}
            disabled={!input || !client || busy || checking}
          >
            {checking
              ? "Checking pull requests on GitHub…"
              : busy
                ? "Locking the payment…"
                : "Create the deal and lock the payment"}
          </Button>
        )}
      </div>
    </div>
  );
}
