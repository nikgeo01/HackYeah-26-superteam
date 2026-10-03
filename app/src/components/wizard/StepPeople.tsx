// Step 1: who is in the deal. The connected wallet (or demo role) is the client.
import type { PublicKey } from "@solana/web3.js";
import { useActor } from "../../providers/ActorProvider";
import type { DemoRoleId } from "../../lib/actors";
import { shortAddress } from "../../lib/format";
import { Button, Field, inputClass } from "./fields";
import { JUDGE_LABELS, type DealDraft } from "./model";

const JUDGE_DEMO_ROLES: DemoRoleId[] = ["arbiter1", "arbiter2", "arbiter3"];

export function StepPeople({
  draft,
  update,
  err,
  client,
}: {
  draft: DealDraft;
  update: (patch: Partial<DealDraft>) => void;
  err: (key: string) => string | undefined;
  client: PublicKey | null;
}) {
  const { demoMode, demoActors } = useActor();
  const demoKey = (id: DemoRoleId) =>
    demoActors.find((a) => a.id === id)?.publicKey.toBase58() ?? null;
  const demoWorker = demoKey("worker");
  const demoJudges = JUDGE_DEMO_ROLES.map(demoKey);
  const canFillAll =
    demoMode && demoWorker !== null && demoJudges.every((k) => k !== null);

  const setJudge = (i: number, value: string) => {
    const judges = [...draft.judges] as DealDraft["judges"];
    judges[i] = value;
    update({ judges });
  };

  return (
    <div className="space-y-5">
      <p className="text-sm text-slate-700">
        You are the client: you lock the payment and approve the work.{" "}
        {client ? (
          <>
            Your address: <strong>{shortAddress(client)}</strong>.
          </>
        ) : (
          <strong>Connect a wallet (or pick a demo role) first.</strong>
        )}
      </p>

      {canFillAll && (
        <div className="flex flex-wrap items-center gap-2 rounded-md bg-violet-50 px-3 py-2 text-sm">
          <span className="text-violet-900">Demo mode:</span>
          <Button
            onClick={() =>
              update({
                worker: demoWorker!,
                judges: demoJudges as DealDraft["judges"],
              })
            }
          >
            Fill in the demo Worker and Arbiters
          </Button>
        </div>
      )}

      <Field
        label="Freelancer's Solana address"
        htmlFor="worker"
        hint="Ask the freelancer for the address of their wallet. Only this address can accept the deal and deliver the work."
        error={err("worker")}
      >
        <div className="flex gap-2">
          <input
            id="worker"
            value={draft.worker}
            onChange={(e) => update({ worker: e.target.value })}
            placeholder="e.g. 7xKX…"
            spellCheck={false}
            className={inputClass(!!err("worker"))}
          />
          {demoMode && demoWorker && (
            <Button onClick={() => update({ worker: demoWorker })}>
              Demo Worker
            </Button>
          )}
        </div>
      </Field>

      <fieldset className="space-y-3 rounded-lg border border-slate-200 p-4">
        <legend className="px-1 text-sm font-semibold">
          Three arbiters, in case you disagree
        </legend>
        <p className="text-xs text-slate-600">
          If you raise an objection, these three people vote. Two matching
          votes decide. They can never receive the money themselves. If they do
          not decide in time, the payment is split 50/50. They must be three
          different people, and neither of you.
        </p>
        {JUDGE_LABELS.map((label, i) => (
          <Field
            key={label}
            label={label}
            htmlFor={`judge${i}`}
            error={err(`judge${i}`)}
          >
            <div className="flex gap-2">
              <input
                id={`judge${i}`}
                value={draft.judges[i]}
                onChange={(e) => setJudge(i, e.target.value)}
                spellCheck={false}
                className={inputClass(!!err(`judge${i}`))}
              />
              {demoMode && demoJudges[i] && (
                <Button onClick={() => setJudge(i, demoJudges[i]!)}>
                  Demo Arbiter {i + 1}
                </Button>
              )}
            </div>
          </Field>
        ))}
      </fieldset>
    </div>
  );
}
