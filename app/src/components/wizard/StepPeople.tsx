// Step 1: who is in the deal. The connected wallet (or demo role) is the client.
import type { PublicKey } from "@solana/web3.js";
import { useActor } from "../../providers/ActorProvider";
import type { DemoRoleId } from "../../lib/actors";
import { Button } from "../ui";
import { RoleMark, type RoleShape } from "../RoleSwitcher";
import { Field, Part, inputClass } from "./fields";
import { Party } from "./Agreement";
import { JUDGE_LABELS, type DealDraft } from "./model";

const JUDGE_DEMO_ROLES: DemoRoleId[] = ["arbiter1", "arbiter2", "arbiter3"];

function AddressInput({
  id,
  value,
  onChange,
  invalid,
  demo,
  demoLabel,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  invalid: boolean;
  demo: string | null;
  demoLabel: string;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Solana address, 32 to 44 characters"
        spellCheck={false}
        autoComplete="off"
        aria-invalid={invalid || undefined}
        aria-describedby={`${id}-note`}
        className={`${inputClass(invalid)} flex-1 basis-60`}
      />
      {demo && demo !== value && (
        <Button kind="quiet" onClick={() => onChange(demo)} className="shrink-0">
          Use {demoLabel}
        </Button>
      )}
    </div>
  );
}

function Label({ shape, children }: { shape: RoleShape; children: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <RoleMark shape={shape} />
      {children}
    </span>
  );
}

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
  const demoWorker = demoMode ? demoKey("worker") : null;
  const demoJudges = JUDGE_DEMO_ROLES.map((id) => (demoMode ? demoKey(id) : null));
  const canFillAll = demoWorker !== null && demoJudges.every((k) => k !== null);

  const setJudge = (i: number, value: string) => {
    const judges = [...draft.judges] as DealDraft["judges"];
    judges[i] = value;
    update({ judges });
  };

  return (
    <div className="space-y-8">
      <Part
        title="You and the freelancer"
        intro={
          client ? (
            <>
              You are the client: you lock the payment and approve the work. You sign as{" "}
              <Party address={client} shape="client" fallback="" />.
            </>
          ) : (
            "You are the client: you lock the payment and approve the work. Connect a wallet, or pick a demo role in the header, to sign as the client."
          )
        }
      >
        {canFillAll && (
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-[var(--radius-control)] border border-dashed border-rule px-3 py-2.5 text-sm">
            <span className="text-ink-soft">Showing the demo? Fill in the demo Worker and all three Arbiters.</span>
            <Button
              kind="plain"
              onClick={() =>
                update({ worker: demoWorker!, judges: demoJudges as DealDraft["judges"] })
              }
            >
              Fill in the demo people
            </Button>
          </div>
        )}
        <Field
          label={<Label shape="worker">Freelancer&apos;s address</Label>}
          htmlFor="worker"
          hint="Ask the freelancer for their wallet address. Only this address can accept the deal and deliver the work."
          error={err("worker")}
        >
          <AddressInput
            id="worker"
            value={draft.worker}
            onChange={(worker) => update({ worker })}
            invalid={!!err("worker")}
            demo={demoWorker}
            demoLabel="Worker"
          />
        </Field>
      </Part>

      <Part
        title="Three arbiters, in case you disagree"
        intro="If you object to a delivery, these three vote and two matching votes decide. They can never receive the money. They must be three different people, and neither of you."
      >
        {JUDGE_LABELS.map((label, i) => (
          <Field
            key={label}
            label={<Label shape="arbiter">{label}</Label>}
            htmlFor={`judge${i}`}
            error={err(`judge${i}`)}
          >
            <AddressInput
              id={`judge${i}`}
              value={draft.judges[i]}
              onChange={(v) => setJudge(i, v)}
              invalid={!!err(`judge${i}`)}
              demo={demoJudges[i]}
              demoLabel={`Arbiter ${i + 1}`}
            />
          </Field>
        ))}
      </Part>
    </div>
  );
}
