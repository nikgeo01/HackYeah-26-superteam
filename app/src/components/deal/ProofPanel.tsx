// "Prove with GitHub and get paid" (PLAN 4.4 encore, WP-41). The prover only fetches a signed
// claim; the program verifies it. Anyone may press the button.
import { useEffect, useRef, useState } from "react";
import { useProgram } from "../../hooks/useProgram";
import { useTx } from "../../hooks/useTx";
import { useActor } from "../../providers/ActorProvider";
import { useChainTime } from "../../providers/ChainTimeProvider";
import {
  proofsEnabled,
  type DealView,
  type MilestoneInfo,
  type Role,
} from "../../lib/deals";
import { COPY, type ExplainedError } from "../../lib/errors";
import { DEMO_MODE, PROVER_URL } from "../../lib/env";
import {
  settleMilestoneIx,
  submitProofIxs,
  type ProofInput,
} from "../../lib/instructions";
import { formatDateTime, shortAddress } from "../../lib/format";
import { ErrorBanner } from "../ErrorDetails";
import { ReceiptLink } from "../ReceiptLink";
import {
  Btn,
  localError,
  Note,
  proofPathOpen,
  PullLink,
  Spinner,
  type RecordReceipt,
} from "./common";

/** Prover request timeout. The spike measured well under a minute; this leaves headroom. */
const PROVER_TIMEOUT_MS = 90_000;
/** After this many seconds the first step shows "still working". */
const STILL_WORKING_SECS = 8;

const FOOTNOTE =
  "The proof helper is just a convenience. The Solana program checks the proof itself and rejects one that does not match this deal.";

const STEP_TITLES = [
  "Asking GitHub (witnessed by an independent attestor)",
  "Verifying the proof on Solana",
  "Paying the freelancer",
] as const;

type StepStatus = "idle" | "running" | "done" | "failed";
interface Step {
  status: StepStatus;
  detail?: string;
  signature?: string;
}
const IDLE: Step[] = [
  { status: "idle" },
  { status: "idle" },
  { status: "idle" },
];

function bytes(value: unknown, length: number, name: string): number[] {
  let out: number[] | null = null;
  if (Array.isArray(value)) out = value.map((v) => Number(v));
  else if (typeof value === "string") {
    const hex = value.trim().replace(/^0x/i, "");
    if (/^[0-9a-f]*$/i.test(hex) && hex.length === length * 2)
      out = Array.from({ length }, (_, i) =>
        parseInt(hex.slice(i * 2, i * 2 + 2), 16),
      );
  }
  if (
    !out ||
    out.length !== length ||
    out.some((b) => !Number.isInteger(b) || b < 0 || b > 255)
  )
    throw new Error(`"${name}" must be ${length} bytes`);
  return out;
}

/** Validates the shape of a ProofArgs JSON (from the prover or a saved file). */
export function parseProof(raw: unknown): ProofInput {
  const root = (raw ?? {}) as Record<string, unknown>;
  const p = (root.proof ?? root.proofArgs ?? root) as Record<string, unknown>;
  if (typeof p.context !== "string") throw new Error('"context" is missing');
  if (typeof p.owner !== "string") throw new Error('"owner" is missing');
  const timestampS = Number(p.timestampS);
  const epoch = Number(p.epoch);
  if (!Number.isInteger(timestampS) || !Number.isInteger(epoch))
    throw new Error('"timestampS" and "epoch" must be whole numbers');
  return {
    context: p.context,
    owner: p.owner.toLowerCase(),
    identifier: bytes(p.identifier, 32, "identifier"),
    signature: bytes(p.signature, 65, "signature"),
    timestampS,
    epoch,
  };
}

function StepRow({
  n,
  step,
  elapsed,
}: {
  n: number;
  step: Step;
  elapsed: number;
}) {
  const icon = {
    idle: <span className="h-5 w-5 rounded-full border-2 border-slate-300" />,
    running: <Spinner className="h-5 w-5 text-indigo-600" />,
    done: (
      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-xs font-bold text-white">
        ✓
      </span>
    ),
    failed: (
      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white">
        !
      </span>
    ),
  }[step.status];
  return (
    <li className="flex items-start gap-3 py-2">
      <span className="mt-0.5 flex w-5 shrink-0 justify-center">{icon}</span>
      <div className="flex-1 text-sm">
        <div
          className={`font-medium ${step.status === "idle" ? "text-slate-500" : "text-slate-900"}`}
        >
          {n + 1}. {STEP_TITLES[n]}
        </div>
        {n === 0 &&
          step.status === "running" &&
          elapsed >= STILL_WORKING_SECS && (
            <div className="text-amber-700">
              Still working… GitHub and the attestor can take up to a minute (
              {elapsed}s).
            </div>
          )}
        {step.detail && <div className="text-slate-600">{step.detail}</div>}
        {step.signature && (
          <ReceiptLink signature={step.signature} className="text-xs">
            Receipt
          </ReceiptLink>
        )}
      </div>
    </li>
  );
}

export function ProofPanel({
  deal,
  milestone,
  role,
  onReceipt,
}: {
  deal: DealView;
  milestone: MilestoneInfo;
  role: Role;
  onReceipt: RecordReceipt;
}) {
  const program = useProgram();
  const { publicKey } = useActor();
  const chain = useChainTime();
  const { sendAll, lastError } = useTx();
  const [steps, setSteps] = useState<Step[]>(IDLE);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<ExplainedError | null>(null);
  const [startedAt, setStartedAt] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!startedAt) return;
    const timer = setInterval(
      () => setElapsed(Math.floor((Date.now() - startedAt) / 1000)),
      1000,
    );
    return () => clearInterval(timer);
  }, [startedAt]);

  if (!proofsEnabled(deal) || milestone.proofKind !== "prMerged") return null;

  const n = milestone.proofRef;
  const undecided = !["approved", "settled"].includes(milestone.status);
  const canProve = proofPathOpen(deal, milestone.index);
  const started = steps.some((s) => s.status !== "idle");

  const setStep = (i: number, patch: Step) =>
    setSteps((all) => all.map((s, j) => (j === i ? patch : s)));

  async function fetchProof(): Promise<ProofInput> {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), PROVER_TIMEOUT_MS);
    setElapsed(0);
    setStartedAt(Date.now());
    try {
      let res: Response;
      try {
        res = await fetch(`${PROVER_URL.replace(/\/$/, "")}/prove`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            deal: deal.address.toBase58(),
            index: milestone.index,
          }),
          signal: ctrl.signal,
        });
      } catch (err) {
        if (ctrl.signal.aborted)
          throw new Error(
            `The proof helper did not answer within ${PROVER_TIMEOUT_MS / 1000} seconds. Try again${DEMO_MODE ? ", or use a saved proof" : ""}.`,
          );
        throw new Error(
          `Could not reach the proof helper at ${PROVER_URL}. It may not be running. (${String(err)})`,
        );
      }
      const text = await res.text();
      if (!res.ok) {
        let message = text;
        try {
          const body = JSON.parse(text) as { error?: string; message?: string };
          message = body.error ?? body.message ?? text;
        } catch {
          // plain text body
        }
        throw new Error(
          `GitHub could not confirm the merge yet: ${message || `HTTP ${res.status}`}`,
        );
      }
      return parseProof(JSON.parse(text));
    } finally {
      clearTimeout(timer);
      setStartedAt(0);
    }
  }

  async function run(saved?: ProofInput) {
    setError(null);
    setSteps([{ status: "running" }, { status: "idle" }, { status: "idle" }]);
    setRunning(true);
    try {
      let proof: ProofInput;
      try {
        proof = saved ?? (await fetchProof());
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setStep(0, { status: "failed" });
        setError(localError(message, String(err)));
        return;
      }
      setStep(0, {
        status: "done",
        detail: `${saved ? "Saved proof loaded. " : ""}Signed by attestor ${shortAddress(proof.owner, 6)} at ${formatDateTime(proof.timestampS)}.`,
      });
      setStep(1, { status: "running" });

      const sigs = await sendAll(
        "Prove with GitHub and get paid",
        async () => {
          if (!publicKey) throw new Error(COPY.noWallet);
          const verify = await submitProofIxs(program, {
            submitter: publicKey,
            deal: deal.address,
            index: milestone.index,
            proof,
          });
          const settle = await settleMilestoneIx(program, {
            cranker: publicKey,
            deal,
            index: milestone.index,
            now: Math.floor(chain.now()),
            assume: { milestone: { status: "approved" } },
          });
          return [
            { instructions: verify },
            { instructions: [settle.ix], atas: settle.atas },
          ];
        },
        (sig, i) => {
          if (i === 0) {
            setStep(1, {
              status: "done",
              detail: "The program accepted the proof.",
              signature: sig,
            });
            setStep(2, { status: "running" });
          } else {
            setStep(2, {
              status: "done",
              detail: "The freelancer has been paid.",
              signature: sig,
            });
          }
        },
      );
      if (!sigs) {
        setSteps((all) =>
          all.map((s) => (s.status === "running" ? { status: "failed" } : s)),
        );
        return;
      }
      if (publicKey && sigs[1])
        onReceipt(milestone.index, {
          signature: sigs[1],
          signer: publicKey,
          signerRole: role,
          kind: "proof",
        });
    } finally {
      setRunning(false);
    }
  }

  async function loadSaved(file: File | undefined) {
    if (!file) return;
    try {
      const proof = parseProof(JSON.parse(await file.text()));
      await run(proof);
    } catch (err) {
      setError(
        localError(
          `This file is not a saved proof: ${err instanceof Error ? err.message : String(err)}`,
          String(err),
        ),
      );
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  const hint =
    undecided && (role === "client" || role === "worker") ? (
      <Note tone="info">
        {role === "client" ? (
          <>Merging PR #{n} is your acceptance. It releases this payment.</>
        ) : (
          <>
            When the client merges <PullLink repo={deal.proofRepo} n={n} />,
            anyone can prove it and you are paid.
          </>
        )}
      </Note>
    ) : null;

  if (!canProve && !started) return hint;

  const txFailed = steps.some((s, i) => i > 0 && s.status === "failed");
  return (
    <div className="space-y-3">
      {hint}
      <div className="rounded-xl border-2 border-violet-200 bg-gradient-to-br from-violet-50 to-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h4 className="font-bold text-slate-900">
              Prove with GitHub and get paid
            </h4>
            <p className="text-sm text-slate-600">
              Once <PullLink repo={deal.proofRepo} n={n} /> is merged, anyone
              can release this payment with a proof from GitHub.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Btn
              variant="proof"
              disabled={running || !canProve}
              onClick={() => void run()}
            >
              {running && <Spinner />}
              {started && !running
                ? "Try again"
                : "Prove with GitHub and get paid"}
            </Btn>
            {DEMO_MODE && (
              <>
                <Btn
                  variant="secondary"
                  disabled={running || !canProve}
                  onClick={() => fileRef.current?.click()}
                >
                  Use saved proof
                </Btn>
                <input
                  ref={fileRef}
                  type="file"
                  accept="application/json,.json"
                  className="hidden"
                  onChange={(e) => void loadSaved(e.target.files?.[0])}
                />
              </>
            )}
          </div>
        </div>
        {started && (
          <ol className="mt-3 divide-y divide-violet-100 border-t border-violet-100">
            {steps.map((s, i) => (
              <StepRow key={STEP_TITLES[i]} n={i} step={s} elapsed={elapsed} />
            ))}
          </ol>
        )}
        {error && (
          <div className="mt-3">
            <ErrorBanner error={error} onClose={() => setError(null)} />
          </div>
        )}
        {txFailed && lastError && (
          <div className="mt-3">
            <ErrorBanner error={lastError} />
          </div>
        )}
        <p className="mt-3 text-xs text-slate-500">{FOOTNOTE}</p>
      </div>
    </div>
  );
}
