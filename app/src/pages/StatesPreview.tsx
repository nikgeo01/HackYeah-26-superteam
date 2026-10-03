// Dev-only design QA for the deal page (/#/_states): the real deal sheet rendered from fixture
// deals, as each kind of viewer. Nothing is sent: clicks on buttons that would sign are swallowed.
import { useEffect, useState, type MouseEvent, type SyntheticEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { PublicKey } from "@solana/web3.js";
import type { DealView, MilestoneInfo, Role } from "../lib/deals";
import { DealSheet } from "../components/deal/DealSheet";
import type { MilestoneReceipt } from "../components/deal/common";
import { Button } from "../components/ui";

const key = (seed: number) =>
  new PublicKey(Uint8Array.from({ length: 32 }, (_, i) => (seed * 37 + i * 11) % 256));

const CLIENT = key(1);
const WORKER = key(2);
const JUDGES: [PublicKey, PublicKey, PublicKey] = [key(3), key(4), key(5)];
const STRANGER = key(9);
const UNIT = 1_000_000n;

function ms(index: number, over: Partial<MilestoneInfo> = {}): MilestoneInfo {
  return {
    index,
    amount: 5n * UNIT,
    depositLocked: 0n,
    status: "pending",
    votes: [0, 0, 0],
    submitDeadline: 0,
    reviewDeadline: 0,
    voteDeadline: 0,
    outcome: "unset",
    proofKind: "off",
    proofRef: 0,
    dueSecs: 7200,
    submittedAt: 0,
    deliverableHash: Uint8Array.from({ length: 32 }, (_, i) => (i * 29 + 7) % 256),
    ...over,
  };
}

function deal(t: number, milestones: MilestoneInfo[], over: Partial<DealView> = {}): DealView {
  const settledCount = milestones.filter((m) => m.status === "settled").length;
  return {
    address: key(42),
    client: CLIENT,
    worker: WORKER,
    judges: JUDGES,
    mint: key(50),
    dealId: 7n,
    status: "active",
    bump: 255,
    vaultBump: 254,
    cancelFlags: 0,
    settledCount,
    createdAt: t - 3600,
    acceptDeadline: t - 3000,
    acceptedAt: t - 3300,
    reviewWindowSecs: 60,
    voteWindowSecs: 120,
    disputeDeposit: UNIT,
    proofAttestor: new Uint8Array(20),
    proofRepo: "",
    milestones,
    total: milestones.reduce((s, m) => s + m.amount, 0n),
    ...over,
  };
}

const paid = (i: number) => ms(i, { status: "settled", outcome: "workerPaid", submittedAt: 1 });
const submitted = (i: number, t: number, left: number) =>
  ms(i, { status: "submitted", submittedAt: t - (60 - left), reviewDeadline: t + left });

type Viewer = "client" | "worker" | "arbiter1" | "arbiter2" | "stranger";
const VIEWER: Record<Viewer, { role: Role; slot: number; me: PublicKey; label: string }> = {
  client: { role: "client", slot: -1, me: CLIENT, label: "As the client" },
  worker: { role: "worker", slot: -1, me: WORKER, label: "As the freelancer" },
  arbiter1: { role: "arbiter", slot: 0, me: JUDGES[0], label: "As arbiter 1 (client's pick)" },
  arbiter2: { role: "arbiter", slot: 1, me: JUDGES[1], label: "As arbiter 2 (freelancer's pick)" },
  stranger: { role: "stranger", slot: -1, me: STRANGER, label: "As a passer-by" },
};

interface Scenario {
  id: string;
  title: string;
  viewers: Viewer[];
  build: (t: number, played: boolean) => { deal: DealView; receipts?: Record<number, MilestoneReceipt> };
  /** Offers a button that settles the milestone by rule, to watch the stamp land. */
  playable?: boolean;
}

const SCENARIOS: Scenario[] = [
  {
    id: "open",
    title: "Open, waiting for the freelancer",
    viewers: ["worker", "client", "stranger"],
    build: (t) => ({
      deal: deal(t, [ms(0), ms(1, { amount: 3n * UNIT }), ms(2, { amount: 2n * UNIT })], {
        status: "open",
        acceptDeadline: t + 600,
        acceptedAt: 0,
      }),
    }),
  },
  {
    id: "open-expired",
    title: "Open, the time to accept is over",
    viewers: ["stranger", "client"],
    build: (t) => ({
      deal: deal(t, [ms(0), ms(1)], { status: "open", acceptDeadline: t - 60, acceptedAt: 0 }),
    }),
  },
  {
    id: "pending",
    title: "Pending delivery",
    viewers: ["worker", "client"],
    build: (t) => ({
      deal: deal(t, [ms(0, { submitDeadline: t + 3400 }), ms(1, { submitDeadline: t + 7000 })]),
    }),
  },
  {
    id: "submitted",
    title: "Delivered, 40 seconds of review left",
    viewers: ["client", "worker", "stranger"],
    build: (t) => ({
      deal: deal(t, [paid(0), submitted(1, t, 40), ms(2, { submitDeadline: t + 5000 })]),
    }),
  },
  {
    id: "release",
    title: "Review time over: the release moment",
    viewers: ["stranger", "worker", "client"],
    playable: true,
    build: (t, played) => ({
      deal: deal(t, [
        paid(0),
        played
          ? ms(1, { status: "settled", outcome: "workerPaid", submittedAt: t - 70 })
          : submitted(1, t, -10),
        ms(2, { submitDeadline: t + 5000 }),
      ]),
      receipts: played
        ? {
            1: {
              signature: "5Kq1".padEnd(88, "x"),
              signer: STRANGER,
              signerRole: "stranger",
              kind: "silence",
            },
          }
        : undefined,
    }),
  },
  {
    id: "disputed",
    title: "Objection, votes 1 to 0",
    viewers: ["arbiter2", "arbiter1", "client", "worker"],
    build: (t) => ({
      deal: deal(t, [
        paid(0),
        ms(1, { status: "disputed", votes: [1, 0, 0], voteDeadline: t + 80, depositLocked: UNIT, submittedAt: t - 200 }),
      ]),
    }),
  },
  {
    id: "disputed-over",
    title: "Objection, voting time over without a majority",
    viewers: ["stranger", "client"],
    build: (t) => ({
      deal: deal(t, [
        paid(0),
        ms(1, { status: "disputed", votes: [1, 0, 0], voteDeadline: t - 10, depositLocked: UNIT, submittedAt: t - 300 }),
      ]),
    }),
  },
  {
    id: "approved",
    title: "Approved, payout not sent yet",
    viewers: ["worker", "stranger"],
    build: (t) => ({ deal: deal(t, [paid(0), ms(1, { status: "approved", submittedAt: t - 100 })]) }),
  },
  {
    id: "withdraw",
    title: "Two payments ready",
    viewers: ["worker"],
    build: (t) => ({
      deal: deal(t, [ms(0, { status: "approved" }), ms(1, { status: "approved" }), ms(2, { submitDeadline: t + 900 })]),
    }),
  },
  {
    id: "settled",
    title: "Settled, every outcome",
    viewers: ["client", "stranger"],
    build: (t) => ({
      deal: deal(t, [
        paid(0),
        ms(1, { status: "settled", outcome: "clientRefunded", amount: 3n * UNIT }),
        ms(2, { status: "settled", outcome: "split", votes: [1, 2, 0], amount: 4n * UNIT }),
        ms(3, { status: "settled", outcome: "cancelled", amount: 2n * UNIT }),
      ]),
      receipts: {
        0: { signature: "3Zp9".padEnd(88, "y"), signer: STRANGER, signerRole: "stranger", kind: "silence" },
      },
    }),
  },
  {
    id: "cancelled",
    title: "Cancelled deal",
    viewers: ["client", "worker"],
    build: (t) => ({
      deal: deal(
        t,
        [paid(0), ms(1, { status: "settled", outcome: "cancelled" }), ms(2, { status: "approved" })],
        { status: "cancelled", cancelFlags: 3 },
      ),
    }),
  },
  {
    id: "cancel-requested",
    title: "Cancel requested by the client",
    viewers: ["worker", "client", "stranger"],
    build: (t) => ({
      deal: deal(t, [paid(0), submitted(1, t, 50)], { cancelFlags: 1 }),
    }),
  },
  {
    id: "proof",
    title: "Released by a merged pull request",
    viewers: ["client", "worker"],
    build: (t) => ({
      deal: deal(
        t,
        [
          ms(0, { proofKind: "prMerged", proofRef: 12, submitDeadline: t + 3000 }),
          ms(1, { submitDeadline: t + 6000 }),
        ],
        { proofAttestor: Uint8Array.from({ length: 20 }, (_, i) => i + 1), proofRepo: "kasia/invoice-api" },
      ),
    }),
  },
];

/** Swallows clicks that would send a transaction; toggles marked data-preview-ok still work. */
function inert(e: MouseEvent | SyntheticEvent) {
  const target = e.target as HTMLElement;
  if (target.closest("[data-preview-ok], summary, a")) return;
  if (target.closest("button, input[type=file]")) {
    e.preventDefault();
    e.stopPropagation();
  }
}

function useTicker(): number {
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  useEffect(() => {
    const id = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}

function ScenarioView({
  scenario,
  only,
  autoplay,
}: {
  scenario: Scenario;
  only: Viewer | null;
  autoplay: boolean;
}) {
  const now = useTicker();
  const [t] = useState(() => Math.floor(Date.now() / 1000));
  const [played, setPlayed] = useState(false);
  // ?play=1 settles the playable milestone after a moment, so a screenshot can catch the stamp.
  useEffect(() => {
    if (!autoplay || !scenario.playable) return;
    const id = setTimeout(() => setPlayed(true), 1200);
    return () => clearTimeout(id);
  }, [autoplay, scenario.playable]);
  const { deal: d, receipts } = scenario.build(t, played);
  const viewers = only ? [only] : scenario.viewers;
  return (
    <div className="space-y-10">
      {scenario.playable && (
        <Button kind="plain" onClick={() => setPlayed((p) => !p)}>
          {played ? "Reset" : "Settle it by rule and watch the stamp"}
        </Button>
      )}
      {viewers.map((v) => (
        <section key={v} className="space-y-3">
          <h2 className="text-sm font-semibold text-ink-soft">{VIEWER[v].label}</h2>
          <div onClickCapture={inert} onSubmitCapture={inert}>
            <DealSheet
              deal={d}
              role={VIEWER[v].role}
              arbiterSlot={VIEWER[v].slot}
              me={VIEWER[v].me}
              now={now}
              onFinished={() => undefined}
              extraReceipts={receipts}
            />
          </div>
        </section>
      ))}
    </div>
  );
}

export default function StatesPreview() {
  const [params] = useSearchParams();
  const scenario = SCENARIOS.find((s) => s.id === params.get("s")) ?? SCENARIOS[4];
  const v = params.get("as") as Viewer | null;
  const only = v && v in VIEWER ? v : null;
  return (
    <div className="space-y-6">
      <nav aria-label="Deal states" className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
        {SCENARIOS.map((s) => (
          <Link
            key={s.id}
            to={`/_states?s=${s.id}`}
            aria-current={s.id === scenario.id ? "page" : undefined}
            className={s.id === scenario.id ? "font-semibold text-ink" : "text-ink-soft hover:text-ink"}
          >
            {s.title}
          </Link>
        ))}
      </nav>
      <ScenarioView
        key={scenario.id + (only ?? "")}
        scenario={scenario}
        only={only}
        autoplay={params.get("play") === "1"}
      />
    </div>
  );
}
