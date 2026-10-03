// Step 2: milestones, timers, objection deposit and the optional GitHub release.
import { TUSDC_SYMBOL, formatAmount, parseAmount } from "../../lib/format";
import { DEFAULT_ATTESTOR } from "../../lib/env";
import { Button, Notice } from "../ui";
import { DurationInput, Field, Part, inputClass } from "./fields";
import {
  MAX_MILESTONES,
  newMilestone,
  withDemoTimings,
  type DealDraft,
  type MilestoneDraft,
} from "./model";

/** An amount input with the currency written inside the box, on the right. */
function MoneyInput({
  id,
  value,
  onChange,
  invalid,
  placeholder,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  invalid: boolean;
  placeholder: string;
}) {
  return (
    <div className="relative">
      <input
        id={id}
        inputMode="decimal"
        value={value}
        placeholder={placeholder}
        aria-invalid={invalid || undefined}
        aria-describedby={`${id}-note`}
        onChange={(e) => onChange(e.target.value)}
        className={`${inputClass(invalid)} figures pr-16 font-semibold`}
      />
      <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-ink-soft">
        {TUSDC_SYMBOL}
      </span>
    </div>
  );
}

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
      milestones: draft.milestones.map((m) => (m.key === key ? { ...m, ...patch } : m)),
    });
  const removeMilestone = (key: number) =>
    update({ milestones: draft.milestones.filter((m) => m.key !== key) });
  const addMilestone = () =>
    update({
      milestones: [...draft.milestones, newMilestone(draft.milestones.at(-1)?.due)],
    });

  const deposit = draft.deposit.trim() === "" ? 0n : parseAmount(draft.deposit);
  const repoSet = draft.repo.trim() !== "";
  const count = draft.milestones.length;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-[var(--radius-control)] border border-dashed border-rule px-3 py-2.5 text-sm">
        <span className="text-ink-soft">
          Trying it out? Short timers let you see every rule play out in a few minutes.
        </span>
        <Button kind="plain" onClick={() => setDraft(withDemoTimings(draft))}>
          Use demo timings
        </Button>
      </div>

      <Part
        title="Milestones"
        intro="Each milestone is paid on its own. Its due time counts from the moment the freelancer accepts; if nothing is delivered by then, that money can go back to you."
      >
        {err("milestones") && <p className="text-sm text-void">{err("milestones")}</p>}
        <ol className="ledger border-y border-rule">
          {draft.milestones.map((m, i) => (
            <li key={m.key} className="grid grid-cols-[2rem_minmax(0,1fr)] gap-x-3 py-4">
              <span
                aria-hidden
                className="figures mt-7 flex h-7 w-7 items-center justify-center rounded-full border-2 border-ink text-sm font-semibold"
              >
                {i + 1}
              </span>
              <div className="space-y-3">
                <div className="grid gap-3 sm:grid-cols-[minmax(0,11rem)_minmax(0,1fr)]">
                  <Field
                    label={`Milestone ${i + 1} amount`}
                    htmlFor={`m${m.key}.amount`}
                    error={err(`m${m.key}.amount`)}
                  >
                    <MoneyInput
                      id={`m${m.key}.amount`}
                      value={m.amount}
                      placeholder="250"
                      onChange={(amount) => setMilestone(m.key, { amount })}
                      invalid={!!err(`m${m.key}.amount`)}
                    />
                  </Field>
                  <Field label="Due within" htmlFor={`m${m.key}.due`} error={err(`m${m.key}.due`)}>
                    <DurationInput
                      id={`m${m.key}.due`}
                      value={m.due}
                      onChange={(due) => setMilestone(m.key, { due })}
                      invalid={!!err(`m${m.key}.due`)}
                    />
                  </Field>
                </div>
                {(repoSet || m.pr !== "") && (
                  <Field
                    label="Pull request number (optional)"
                    htmlFor={`m${m.key}.pr`}
                    hint="When you merge this pull request, the payment can be released with a proof from GitHub."
                    error={err(`m${m.key}.pr`)}
                  >
                    <input
                      id={`m${m.key}.pr`}
                      inputMode="numeric"
                      value={m.pr}
                      placeholder="12"
                      aria-describedby={`m${m.key}.pr-note`}
                      onChange={(e) => setMilestone(m.key, { pr: e.target.value })}
                      className={`${inputClass(!!err(`m${m.key}.pr`))} figures max-w-32`}
                    />
                  </Field>
                )}
                {count > 1 && (
                  <Button
                    kind="quiet"
                    onClick={() => removeMilestone(m.key)}
                    className="-ml-3.5"
                  >
                    Remove milestone {i + 1}
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ol>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          {count < MAX_MILESTONES && (
            <Button kind="plain" onClick={addMilestone}>
              Add milestone {count + 1}
            </Button>
          )}
          <span className="text-sm text-ink-soft">
            {count < MAX_MILESTONES
              ? `Up to ${MAX_MILESTONES} milestones per deal.`
              : `${MAX_MILESTONES} milestones is the most a deal can hold.`}
          </span>
        </div>
      </Part>

      <Part
        title="Timers"
        intro="Every timer runs between 10 seconds and 365 days. Very short timers are for trying things out only."
      >
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
          hint="If you say nothing in this time, the freelancer is paid."
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
      </Part>

      <Part title="Objection deposit">
        <Field
          label="Deposit you lock if you object"
          htmlFor="deposit"
          hint="If the arbiters side with the freelancer, the freelancer gets this deposit too. If they side with you, or cannot decide, you get it back."
          error={err("deposit")}
        >
          <div className="max-w-44">
            <MoneyInput
              id="deposit"
              value={draft.deposit}
              placeholder="0"
              onChange={(v) => update({ deposit: v })}
              invalid={!!err("deposit")}
            />
          </div>
        </Field>
        {deposit === 0n && (
          <Notice tone="clock">
            With a deposit of 0, objections are free: you could object to every delivery without
            risking anything. A fair deposit protects the freelancer.
          </Notice>
        )}
        {deposit !== null && deposit > 0n && (
          <p className="text-sm text-ink-soft">
            Objecting locks {formatAmount(deposit)} from your balance at that moment.
          </p>
        )}
      </Part>

      <Part
        title="GitHub release (optional)"
        intro="Name a public repository and, for each milestone, the freelancer's open pull request. When you merge it, anyone can prove that on Solana and the payment is released. Merging is your acceptance."
      >
        <Field
          label="Repository"
          htmlFor="repo"
          hint={repoSet ? "Only use a repository where you decide what gets merged." : 'Written as "owner/name".'}
          error={err("repo")}
        >
          <input
            id="repo"
            value={draft.repo}
            placeholder="acme/website"
            spellCheck={false}
            autoComplete="off"
            aria-describedby="repo-note"
            onChange={(e) => update({ repo: e.target.value })}
            className={`${inputClass(!!err("repo"))} max-w-sm`}
          />
        </Field>
        <details className="group">
          <summary className="cursor-pointer text-sm font-semibold text-ink-soft hover:text-ink">
            Advanced: the attestor
          </summary>
          <div className="mt-3">
            <Field
              label="Attestor address"
              htmlFor="attestor"
              hint={
                <>
                  The independent service that witnesses what GitHub says. The default is{" "}
                  <span className="break-all">{DEFAULT_ATTESTOR}</span>. Leave it empty to switch the
                  GitHub release off.
                </>
              }
              error={err("attestor")}
            >
              <input
                id="attestor"
                value={draft.attestor}
                spellCheck={false}
                autoComplete="off"
                aria-describedby="attestor-note"
                onChange={(e) => update({ attestor: e.target.value })}
                className={`${inputClass(!!err("attestor"))} max-w-md text-sm`}
              />
            </Field>
          </div>
        </details>
      </Part>
    </div>
  );
}
