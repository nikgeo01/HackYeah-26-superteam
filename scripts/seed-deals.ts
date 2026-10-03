// Seeds the pre-made demo deals of PLAN 8.3 with one actor set and prints their
// app URLs. Deals that must be past a deadline (D3, D5) use short windows and
// are created first; the script then polls chain time (Clock sysvar) until the
// deadline has passed instead of sleeping blindly.
//
//   D1 Open                          D5 Disputed past the vote deadline (split)
//   D2 Submitted, long review window D6 Proof-bound, PR already merged (+ saved proof)
//   D3 Submitted, review expired     D7 Proof-bound, PR open (live merge)
//   D4 Disputed with one vote        D8 Fully settled
import { createHash } from "node:crypto";
import { join } from "node:path";
import { getAccount } from "@solana/spl-token";
import {
  Keypair,
  PublicKey,
  type TransactionInstruction,
} from "@solana/web3.js";
import {
  attestorBytes,
  proveMilestone,
  RECLAIM_ATTESTOR,
} from "../client/proof.ts";
import {
  loadActorSet,
  resolveMint,
  SET_NAMES,
  type ActorKeys,
  type SetName,
} from "./lib/actors.ts";
import { cli, intArg, run } from "./lib/cli.ts";
import { chainNow, fetchDeal, waitForChainTime } from "./lib/deal.ts";
import { DEMO_DIR, env } from "./lib/env.ts";
import {
  acceptIx,
  approveIx,
  ata,
  createDealIx,
  openDisputeIx,
  settleIxs,
  submitWorkIx,
  voteIx,
  type DealSpec,
  type MilestoneSpec,
} from "./lib/instructions.ts";
import { writePrivateFile } from "./lib/keys.ts";
import { dealUrl, errorMessage, formatTokens, sent, UNIT } from "./lib/log.ts";
import { connect, loadProgram, type EscrowProgram } from "./lib/program.ts";
import { sendTx } from "./lib/tx.ts";

const USAGE = `
Usage: node scripts/seed-deals.ts --set <pitch|hosted> [options]

Creates the pre-seeded demo deals (PLAN 8.3) with the chosen actor set from
.demo/actors.json and prints their app URLs.

  --set <pitch|hosted>     actor set (required)
  --only <D1,D3,...>       seed only these deals (default: all that apply)
  --short <secs>           window for deals that must expire (default 30; 10..45)
  --with-proof             also seed D6 and D7 (needs the three options below)
  --repo <owner/name>      public demo repository the client controls
  --merged-pr <n>          an already merged PR (D6)
  --open-pr <n>            an open PR to merge live (D7)
  --attestor <0x..>        proof attestor address (default Reclaim's, or PROOF_ATTESTOR)
  --dry-run                print the plan; send nothing
  -h, --help               this text

Env: RPC_URL, PROGRAM_ID, TUSDC_MINT, APP_URL (default http://localhost:5173),
     RECLAIM_APP_ID / RECLAIM_APP_SECRET / GITHUB_PAT (only to save D6's proof)
`;

const LONG = 2 * 24 * 3600; // two days: stays open through rehearsals and the pitch

type Step = {
  label: string;
  locksDeposit?: boolean;
  signers: (a: ActorKeys) => Keypair[];
  build: (ctx: Ctx) => Promise<TransactionInstruction[]>;
};

interface Ctx {
  program: EscrowProgram;
  actors: ActorKeys;
  mint: PublicKey;
  deal: PublicKey;
  createIx: TransactionInstruction;
}

interface Plan {
  id: string;
  title: string;
  spec: DealSpec;
  steps: Step[];
  /** Which deadline must pass before the deal is in its demo state. */
  waitFor?: "review" | "vote";
}

const tusdc = (n: number): bigint => BigInt(n) * UNIT;
const hashOf = (text: string): number[] =>
  Array.from(createHash("sha256").update(text).digest());

function plans(
  a: ActorKeys,
  opts: {
    short: number;
    withProof: boolean;
    repo: string;
    mergedPr: number;
    openPr: number;
    attestor: string;
  },
): Plan[] {
  const base = BigInt(Date.now());
  let n = 0n;
  const spec = (
    milestones: MilestoneSpec[],
    over: Partial<DealSpec> = {},
  ): DealSpec => ({
    dealId: base + n++,
    worker: a.worker.publicKey,
    judges: [a.arbiter1.publicKey, a.arbiter2.publicKey, a.arbiter3.publicKey],
    acceptWindowSecs: LONG,
    reviewWindowSecs: LONG,
    voteWindowSecs: LONG,
    disputeDeposit: tusdc(25),
    proofAttestor: Array(20).fill(0),
    proofRepo: "",
    milestones,
    ...over,
  });
  const m = (amount: number, proofRef = 0): MilestoneSpec => ({
    amount: tusdc(amount),
    dueSecs: LONG,
    proofRef,
  });

  const create: Step = {
    label: "create and fund",
    signers: (x) => [x.client],
    build: async (c) => [c.createIx],
  };
  const acceptStep: Step = {
    label: "worker accepts",
    signers: (x) => [x.worker],
    build: async (c) => [
      await acceptIx(c.program, c.actors.worker.publicKey, c.deal),
    ],
  };
  const acceptAndSubmit: Step = {
    label: "worker accepts and delivers milestone 1",
    signers: (x) => [x.worker],
    build: async (c) => {
      const uri = "https://github.com/kept-demo/deliverable/pull/1";
      return [
        await acceptIx(c.program, c.actors.worker.publicKey, c.deal),
        await submitWorkIx(
          c.program,
          c.actors.worker.publicKey,
          c.deal,
          0,
          hashOf(uri),
          uri,
        ),
      ];
    },
  };
  const disputeAndVote: Step = {
    label:
      "client objects (locks the deposit); Arbiter 1 sides with the worker",
    locksDeposit: true,
    signers: (x) => [x.client, x.arbiter1],
    build: async (c) => [
      await openDisputeIx(
        c.program,
        c.actors.client.publicKey,
        c.deal,
        c.mint,
        0,
      ),
      await voteIx(c.program, c.actors.arbiter1.publicKey, c.deal, 0, "worker"),
    ],
  };
  const approveAndSettle: Step = {
    label: "client approves and pays in one transaction",
    signers: (x) => [x.client],
    build: async (c) => {
      const d = await fetchDeal(c.program, c.deal);
      const amount = d.milestones[0].amount;
      return [
        await approveIx(c.program, c.actors.client.publicKey, c.deal, 0),
        ...(await settleIxs(c.program, c.actors.client.publicKey, d, 0, {
          toWorker: amount,
          toClient: 0n,
        })),
      ];
    },
  };

  const out: Plan[] = [
    {
      id: "D1",
      title: "Open (waiting for the worker)",
      spec: spec([m(120), m(80)]),
      steps: [create],
    },
    {
      id: "D2",
      title: "Submitted, long review window (approve live)",
      spec: spec([m(150)]),
      steps: [create, acceptAndSubmit],
    },
    {
      id: "D3",
      title: "Submitted, review window expired (anyone can release)",
      spec: spec([m(100)], { reviewWindowSecs: opts.short }),
      steps: [create, acceptAndSubmit],
      waitFor: "review",
    },
    {
      id: "D4",
      title: "Disputed with one vote (second arbiter decides live)",
      spec: spec([m(200)]),
      steps: [create, acceptAndSubmit, disputeAndVote],
    },
    {
      id: "D5",
      title: "Disputed past the vote deadline (50/50 split)",
      spec: spec([m(100)], { voteWindowSecs: opts.short }),
      steps: [create, acceptAndSubmit, disputeAndVote],
      waitFor: "vote",
    },
  ];
  if (opts.withProof) {
    const proofOver = {
      proofRepo: opts.repo,
      proofAttestor: attestorBytes(opts.attestor),
    };
    out.push(
      {
        id: "D6",
        title: `Proof-bound to merged PR #${opts.mergedPr} (saved proof)`,
        spec: spec([m(100, opts.mergedPr)], proofOver),
        steps: [create, acceptStep],
      },
      {
        id: "D7",
        title: `Proof-bound to open PR #${opts.openPr} (merge live)`,
        spec: spec([m(100, opts.openPr)], proofOver),
        steps: [create, acceptStep],
      },
    );
  }
  out.push({
    id: "D8",
    title: "Fully settled (paid on approval)",
    spec: spec([m(80)]),
    steps: [create, acceptAndSubmit, approveAndSettle],
  });
  return out;
}

/** In a dry run, missing actors or mint are replaced by placeholders so the plan still prints. */
function orPlaceholder<T>(
  dryRun: boolean,
  get: () => T,
  placeholder: () => T,
): T {
  try {
    return get();
  } catch (error) {
    if (!dryRun) throw error;
    console.log(
      `note: ${errorMessage(error)}; using a placeholder for the dry run`,
    );
    return placeholder();
  }
}

function placeholderActors(): ActorKeys {
  const k = () => Keypair.generate();
  return {
    client: k(),
    worker: k(),
    arbiter1: k(),
    arbiter2: k(),
    arbiter3: k(),
    passerBy: k(),
  };
}

function totalNeeded(p: Plan): bigint {
  const amounts = p.spec.milestones.reduce((s, x) => s + x.amount, 0n);
  const disputes = p.steps.some((s) => s.locksDeposit)
    ? p.spec.disputeDeposit
    : 0n;
  return amounts + disputes;
}

run(async () => {
  const args = cli(USAGE, {
    set: { type: "string" },
    only: { type: "string" },
    short: { type: "string" },
    "with-proof": { type: "boolean" },
    repo: { type: "string" },
    "merged-pr": { type: "string" },
    "open-pr": { type: "string" },
    attestor: { type: "string" },
    "dry-run": { type: "boolean" },
  });
  if (!args.set || !SET_NAMES.includes(args.set as SetName))
    throw new Error("--set pitch|hosted is required");
  const set = args.set as SetName;
  const short = intArg(args.short, "short", 30);
  if (short < 10 || short > 45)
    throw new Error("--short must be between 10 and 45 seconds");
  const withProof = args["with-proof"] === true;
  const repo = args.repo ?? "";
  const mergedPr = withProof ? intArg(args["merged-pr"], "merged-pr") : 0;
  const openPr = withProof ? intArg(args["open-pr"], "open-pr") : 0;
  if (withProof) {
    if (!/^[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+$/.test(repo) || repo.length > 80)
      throw new Error("--repo must look like owner/name");
    if (mergedPr === 0 || openPr === 0 || mergedPr === openPr)
      throw new Error("--merged-pr and --open-pr must be distinct PR numbers");
  }
  const attestor = (
    args.attestor ??
    env.optional("PROOF_ATTESTOR") ??
    RECLAIM_ATTESTOR
  ).toLowerCase();

  const dryRun = args["dry-run"] === true;
  const actors = orPlaceholder(
    dryRun,
    () => loadActorSet(set),
    placeholderActors,
  );
  const mint = orPlaceholder(
    dryRun,
    resolveMint,
    () => Keypair.generate().publicKey,
  );
  const only = args.only
    ? new Set(
        args.only
          .toUpperCase()
          .split(",")
          .map((s) => s.trim()),
      )
    : undefined;
  const selected = plans(actors, {
    short,
    withProof,
    repo,
    mergedPr,
    openPr,
    attestor,
  }).filter((p) => !only || only.has(p.id));
  if (selected.length === 0) throw new Error("nothing to seed");

  const connection = connect();
  const program = loadProgram(connection, actors.client);
  const need = selected.reduce((s, p) => s + totalNeeded(p), 0n);
  console.log(
    `Set ${set}; program ${program.programId.toBase58()}; mint ${mint.toBase58()}`,
  );
  console.log(
    `Client ${actors.client.publicKey.toBase58()} needs ${formatTokens(need)} tUSDC for ${selected.length} deal(s)`,
  );
  for (const p of selected) {
    console.log(`  ${p.id} ${p.title}`);
    for (const s of p.steps) console.log(`       - ${s.label}`);
    if (p.waitFor)
      console.log(
        `       - wait on chain time until the ${p.waitFor} deadline (${short} s window) passes`,
      );
  }
  if (withProof && selected.some((p) => p.id === "D6" || p.id === "D7")) {
    console.log(
      `  proof attestor ${attestor}${attestor === RECLAIM_ATTESTOR ? " (Reclaim)" : " (custom: trusted checker?)"}`,
    );
  }
  if (dryRun) {
    console.log("\n--dry-run: nothing sent.");
    return;
  }

  const held = (
    await getAccount(
      connection,
      ata(mint, actors.client.publicKey),
      "confirmed",
    )
  ).amount;
  if (held < need)
    throw new Error(
      `the client holds ${formatTokens(held)} tUSDC; run demo-setup.ts to top up`,
    );

  const seeded: { id: string; title: string; deal: string; url: string }[] = [];
  for (const p of selected) {
    console.log(`\n${p.id} ${p.title}`);
    const { deal, ix } = await createDealIx(
      program,
      actors.client.publicKey,
      mint,
      p.spec,
    );
    const ctx: Ctx = { program, actors, mint, deal, createIx: ix };
    for (const s of p.steps) {
      sent(
        s.label,
        await sendTx(connection, await s.build(ctx), s.signers(actors)),
      );
    }
    seeded.push({
      id: p.id,
      title: p.title,
      deal: deal.toBase58(),
      url: dealUrl(deal.toBase58()),
    });
  }

  // Wait for D3 / D5 deadlines on chain time.
  let target = 0;
  for (const p of selected) {
    if (!p.waitFor) continue;
    const s = seeded.find((x) => x.id === p.id);
    if (!s) continue;
    const d = await fetchDeal(program, new PublicKey(s.deal));
    const m = d.milestones[0];
    target = Math.max(
      target,
      (p.waitFor === "review" ? m.reviewDeadline : m.voteDeadline) + 1,
    );
  }
  if (target > 0) {
    const now = await chainNow(connection);
    console.log(
      `\nWaiting for chain time ${target} (now ${now}, ~${Math.max(0, target - now)} s)...`,
    );
    await waitForChainTime(connection, target, (t) =>
      process.stdout.write(`  ${target - t} s left\r`),
    );
    console.log("  deadline passed on chain.        ");
  }

  // D6: save a proof if credentials exist; otherwise say how.
  const d6 = seeded.find((s) => s.id === "D6");
  if (d6) {
    const proofPath = join(DEMO_DIR, "proofs", `${set}-D6.json`);
    const appId = env.optional("RECLAIM_APP_ID");
    const appSecret = env.optional("RECLAIM_APP_SECRET");
    if (appId && appSecret && attestor === RECLAIM_ATTESTOR) {
      try {
        const { proof } = await proveMilestone(
          program,
          new PublicKey(d6.deal),
          0,
          {
            appId,
            appSecret,
            githubToken: env.optional("GITHUB_PAT"),
          },
        );
        writePrivateFile(proofPath, JSON.stringify(proof, null, 2) + "\n");
        console.log(`\nSaved D6 proof to ${proofPath}`);
      } catch (error) {
        console.log(`\nD6 proof not saved: ${errorMessage(error)}`);
      }
    } else {
      console.log(
        `\nD6: save its proof with\n  node scripts/prove.ts --deal ${d6.deal} --index 0 --save ${proofPath} --no-submit`,
      );
      if (attestor !== RECLAIM_ATTESTOR) {
        console.log(
          `  or, with the trusted checker: node scripts/trusted-checker.ts --deal ${d6.deal} --index 0 --save ${proofPath}`,
        );
      }
    }
  }

  writePrivateFile(
    join(DEMO_DIR, `seeded-${set}.json`),
    JSON.stringify(
      { set, createdAt: new Date().toISOString(), deals: seeded },
      null,
      2,
    ) + "\n",
  );
  console.log(`\nSeeded (${set}), also in .demo/seeded-${set}.json:`);
  for (const s of seeded) console.log(`  ${s.id}  ${s.url}\n      ${s.title}`);
});
