// Step 2: milestones, timers, objection deposit and the optional GitHub release.
import { TUSDC_SYMBOL, formatAmount, parseAmount } from "../../lib/format";
import { DEFAULT_ATTESTOR } from "../../lib/env";
import { Button, DurationInput, Field, inputClass } from "./fields";
import {
  MAX_MILESTONES,
  newMilestone,
  withDemoTimings,
  type DealDraft,
  type MilestoneDraft,
} from "./model";

export function StepTerms({
  draft,
  update,
  setDraft,
  err,
}: {
  draft: DealDraft;
  update: (patch: Partial<DealDraft>) => void;
  setDraft: (next: DealDraft) => void;
  err: (key: string) => string | undefined;
}) {
  const setMilestone = (key: number, patch: Partial<MilestoneDraft>) =>
    update({
      milestones: draft.milestones.map((m) =>
        m.key === key ? { ...m, ...patch } : m,
      ),
    });
  const removeMilestone = (key: number) =>
    update({ milestones: draft.milestones.filter((m) => m.key !== key) });
  const addMilestone = () =>
    update({
      milestones: [
        ...draft.milestones,
        newMilestone(draft.milestones.at(-1)?.due),
      ],
    });

  const deposit = draft.deposit.trim() === "" ? 0n : parseAmount(draft.deposit);
  const repoSet = draft.repo.trim() !== "";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2 rounded-md bg-slate-100 px-3 py-2 text-sm">
        <span className="text-slate-700">
          Trying it out? Short timers let you see every rule in a few minutes.
        </span>
        <Button onClick={() => setDraft(withDemoTimings(draft))}>
          Use demo timings
        </Button>
      </div>

      <section className="space-y-3">
        <h3 className="font-semibold">Milestones</h3>
        <p className="text-xs text-slate-600">
          Each milestone is paid separately. The due time counts from the
          moment the freelancer accepts the deal. If nothing is delivered by
          then, that milestone's money can go back to you.
        </p>
        {err("milestones") && (
          <p className="text-xs text-red-700">{err("milestones")}</p>
        )}
        {draft.milestones.map((m, i) => (
          <div
            key={m.key}
            className="grid gap-3 rounded-lg border border-slate-200 p-4 sm:grid-cols-[1fr_auto]"
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <Field
                label={`Milestone ${i + 1}: amount (${TUSDC_SYMBOL})`}
                htmlFor={`m${m.key}.amount`}
                error={err(`m${m.key}.amount`)}
              >
                <input
                  id={`m${m.key}.amount`}
                  inputMode="decimal"
                  value={m.amount}
                  placeholder="e.g. 250"
                  onChange={(e) =>
                    setMilestone(m.key, { amount: e.target.value })
                  }
                  className={inputClass(!!err(`m${m.key}.amount`))}
                />
              </Field>
              <Field
                label="Due within"
                htmlFor={`m${m.key}.due`}
                error={err(`m${m.key}.due`)}
              >
                <DurationInput
                  id={`m${m.key}.due`}
                  value={m.due}
                  onChange={(due) => setMilestone(m.key, { due })}
                  invalid={!!err(`m${m.key}.due`)}
                />
              </Field>
              {(repoSet || m.pr !== "") && (
                <Field
                  label="Pull request number (optional)"
                  htmlFor={`m${m.key}.pr`}
                  hint="When this pull request is merged, the payment can be released with a proof from GitHub."
                  error={err(`m${m.key}.pr`)}
                >
                  <input
                    id={`m${m.key}.pr`}
                    inputMode="numeric"
                    value={m.pr}
                    placeholder="e.g. 12"
                    onChange={(e) =>
                      setMilestone(m.key, { pr: e.target.value })
                    }
                    className={`${inputClass(!!err(`m${m.key}.pr`))} max-w-40`}
                  />
                </Field>
              )}
            </div>
            {draft.milestones.length > 1 && (
              <div>
                <Button
                  variant="link"
                  onClick={() => removeMilestone(m.key)}
                  aria-label={`Remove milestone ${i + 1}`}
                >
                  Remove
                </Button>
              </div>
            )}
          </div>
        ))}
        {draft.milestones.length < MAX_MILESTONES && (
          <Button onClick={addMilestone}>Add a milestone</Button>
        )}
        <p className="text-xs text-slate-500">
          Up to {MAX_MILESTONES} milestones per deal.
        </p>
      </section>

      <section className="space-y-3">
        <h3 className="font-semibold">Timers</h3>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field
            label="Time for the freelancer to accept"
            htmlFor="accept"
            hint="If they do not accept in time, anyone can cancel and your money comes back."
            error={err("accept")}
          >
            <DurationInput
              id="accept"
              value={draft.accept}
              onChange={(accept) => update({ accept })}
              invalid={!!err("accept")}
            />
          </Field>
          <Field
            label="Your time to review each delivery"
            htmlFor="review"
            hint="If you say nothing in this time, the freelancer is paid. Silence pays."
            error={err("review")}
          >
            <DurationInput
              id="review"
              value={draft.review}
              onChange={(review) => update({ review })}
              invalid={!!err("review")}
            />
          </Field>
          <Field
            label="Time for the arbiters to vote"
            htmlFor="vote"
            hint="If two arbiters do not agree in time, the payment is split 50/50."
            error={err("vote")}
          >
            <DurationInput
              id="vote"
              value={draft.vote}
              onChange={(vote) => update({ vote })}
              invalid={!!err("vote")}
            />
          </Field>
        </div>
        <p className="text-xs text-slate-500">
          Every timer is between 10 seconds and 365 days. Very short timers
          are for trying things out only.
        </p>
      </section>

      <section className="space-y-3">
        <h3 className="font-semibold">Objection deposit</h3>
        <Field
          label={`Deposit you lock if you raise an objection (${TUSDC_SYMBOL})`}
          htmlFor="deposit"
          hint="If the arbiters side with the freelancer, the freelancer gets this deposit too. If they side with you, or cannot decide, you get it back."
          error={err("deposit")}
        >
          <input
            id="deposit"
            inputMode="decimal"
            value={draft.deposit}
            placeholder="0"
            onChange={(e) => update({ deposit: e.target.value })}
            className={`${inputClass(!!err("deposit"))} max-w-40`}
          />
        </Field>
        {deposit === 0n && (
          <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            With a deposit of 0, objections are free. You could object to every
            delivery without risking anything. A fair deposit protects the
            freelancer.
          </p>
        )}
        {deposit !== null && deposit > 0n && (
          <p className="text-xs text-slate-500">
            Objecting locks {formatAmount(deposit)} from your balance at that
            moment.
          </p>
        )}
      </section>

      <section className="space-y-3">
        <h3 className="font-semibold">GitHub release (optional)</h3>
        <p className="text-xs text-slate-600">
          Name a public repository and, for each milestone, the freelancer's
          open pull request. When you merge that pull request, anyone can
          prove it on Solana and the payment is released. Merging is your
          acceptance.
        </p>
        <Field
          label='Repository ("owner/name")'
          htmlFor="repo"
          error={err("repo")}
        >
          <input
            id="repo"
            value={draft.repo}
            placeholder="e.g. acme/website"
            spellCheck={false}
            onChange={(e) => update({ repo: e.target.value })}
            className={`${inputClass(!!err("repo"))} max-w-md`}
          />
        </Field>
        {repoSet && (
          <p className="rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-900">
            Only use a repository where you decide what gets merged.
          </p>
        )}
        <details className="rounded-md border border-slate-200 px-3 py-2">
          <summary className="cursor-pointer text-sm font-medium">
            Advanced
          </summary>
          <div className="mt-3">
            <Field
              label="Attestor address"
              htmlFor="attestor"
              hint={
                <>
                  The independent service that witnesses what GitHub says.
                  Default: {DEFAULT_ATTESTOR}. Leave empty to switch the GitHub
                  release off.
                </>
              }
              error={err("attestor")}
            >
              <input
                id="attestor"
                value={draft.attestor}
                spellCheck={false}
                onChange={(e) => update({ attestor: e.target.value })}
                className={`${inputClass(!!err("attestor"))} max-w-md font-mono`}
              />
            </Field>
          </div>
        </details>
      </section>
    </div>
  );
}
