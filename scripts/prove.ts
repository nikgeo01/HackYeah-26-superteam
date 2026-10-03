// Proof release from the command line (WP-41): get a proof that the deal's pull
// request is merged, then send `submit_proof` (with a 400k compute budget) and
// `settle_milestone` as two transactions signed together by one keypair.
//
// The proof can come from zkFetch (needs RECLAIM_APP_ID / RECLAIM_APP_SECRET and
// usually GITHUB_PAT), or from a saved ProofArgs JSON (--load), e.g. one written
// earlier with --save or by scripts/trusted-checker.ts.
import { existsSync, readFileSync } from "node:fs";
import { PublicKey } from "@solana/web3.js";
import {
  checkProofArgs,
  parseProofArgs,
  proveMilestone,
  toHex,
  type ProofArgs,
} from "../client/proof.ts";
import {
  loadActorSet,
  ROLES,
  SET_NAMES,
  type Role,
  type SetName,
} from "./lib/actors.ts";
import { cli, intArg, run } from "./lib/cli.ts";
import { fetchDeal, hasProofAttestor } from "./lib/deal.ts";
import { env } from "./lib/env.ts";
import { settleIxs, submitProofIx } from "./lib/instructions.ts";
import { loadKeypair, writePrivateFile } from "./lib/keys.ts";
import { explorerTx, formatTokens } from "./lib/log.ts";
import { connect, loadProgram } from "./lib/program.ts";
import { buildTx, computeUnits, sendSignedSequence } from "./lib/tx.ts";

const USAGE = `
Usage: node scripts/prove.ts --deal <address> --index <n> [options]

  --deal <address>     the deal (required)
  --index <n>          milestone index, 0-based (required)
  --load <file>        use a saved ProofArgs JSON instead of calling zkFetch
  --save <file>        write the ProofArgs JSON (no secrets in it) to <file>
  --no-submit          only produce / check the proof; send nothing
  --no-settle          submit the proof but do not settle
  --actor <set:role>   sign as a demo actor (e.g. pitch:passerBy) instead of the wallet
  --force              submit even if the local pre-check finds problems
  -h, --help           this text

Env: RPC_URL, PROGRAM_ID, ANCHOR_WALLET (signer), RECLAIM_APP_ID, RECLAIM_APP_SECRET,
     GITHUB_PAT (read-only, public repos), PROOF_CONTEXT_ADDRESS (default 0x0)
`;

function signerFromActor(spec: string) {
  const [set, role] = spec.split(":");
  if (
    !SET_NAMES.includes(set as SetName) ||
    !ROLES.some((r) => r.role === role)
  ) {
    throw new Error(
      `--actor must be <pitch|hosted>:<${ROLES.map((r) => r.role).join("|")}>`,
    );
  }
  return loadActorSet(set as SetName)[role as Role];
}

run(async () => {
  const args = cli(USAGE, {
    deal: { type: "string" },
    index: { type: "string" },
    load: { type: "string" },
    save: { type: "string" },
    "no-submit": { type: "boolean" },
    "no-settle": { type: "boolean" },
    actor: { type: "string" },
    force: { type: "boolean" },
  });
  if (!args.deal) throw new Error("--deal is required");
  const dealKey = new PublicKey(args.deal);
  const index = intArg(args.index, "index");
  const submit = args["no-submit"] !== true;

  const connection = connect();
  const signer = !submit
    ? undefined
    : args.actor
      ? signerFromActor(args.actor)
      : loadKeypair(env.walletPath());
  const program = loadProgram(connection, signer);
  const deal = await fetchDeal(program, dealKey);
  const m = deal.milestones[index];
  if (!m) throw new Error(`the deal has no milestone ${index}`);
  if (m.proofKind !== "prMerged" || !hasProofAttestor(deal)) {
    throw new Error(`milestone ${index} has no pull request bound to it`);
  }
  const attestor = `0x${toHex(deal.proofAttestor)}`;
  console.log(
    `Deal ${dealKey.toBase58()} #${index}: ${deal.proofRepo} PR #${m.proofRef}, status ${m.status}`,
  );
  console.log(`Attestor named in the deal: ${attestor}`);

  let proof: ProofArgs;
  if (args.load) {
    if (!existsSync(args.load)) throw new Error(`no such file: ${args.load}`);
    proof = parseProofArgs(JSON.parse(readFileSync(args.load, "utf8")));
    console.log(`Loaded proof from ${args.load}`);
  } else {
    const started = Date.now();
    console.log("Asking GitHub, witnessed by the attestor (zkFetch)...");
    const result = await proveMilestone(
      program,
      dealKey,
      index,
      {
        appId: env.required("RECLAIM_APP_ID"),
        appSecret: env.required("RECLAIM_APP_SECRET"),
        githubToken: env.optional("GITHUB_PAT"),
      },
      { contextAddress: env.optional("PROOF_CONTEXT_ADDRESS") },
    );
    proof = result.proof;
    console.log(
      `Proof received in ${((Date.now() - started) / 1000).toFixed(1)} s for ${result.target.url}`,
    );
  }
  if (args.save) {
    writePrivateFile(args.save, JSON.stringify(proof, null, 2) + "\n");
    console.log(`Saved ProofArgs to ${args.save}`);
  }

  const problems = checkProofArgs(proof, {
    repo: deal.proofRepo,
    pr: m.proofRef,
    deal: dealKey,
    index,
    attestor,
  });
  if (problems.length) {
    console.log("Local pre-check (the program will check the same):");
    for (const p of problems) console.log(`  - ${p}`);
    if (!args.force)
      throw new Error(
        "the proof would be rejected on-chain (use --force to send anyway)",
      );
  } else {
    console.log(
      "Local pre-check passed: identifier, binding and signer match the deal.",
    );
  }
  if (!submit || !signer) return;

  const latest = await connection.getLatestBlockhash("confirmed");
  const txs = [];
  const labels: string[] = [];
  if (
    m.status === "pending" ||
    m.status === "submitted" ||
    m.status === "disputed"
  ) {
    txs.push(
      buildTx(
        [
          computeUnits(400_000),
          await submitProofIx(program, signer.publicKey, dealKey, index, proof),
        ],
        signer,
        latest.blockhash,
      ),
    );
    labels.push("proof verified on Solana");
  } else if (m.status !== "approved") {
    throw new Error(`milestone ${index} is ${m.status}; nothing to prove`);
  }
  if (args["no-settle"] !== true) {
    // After an approval the worker receives amount + any locked deposit; the client nothing.
    const toWorker = m.amount + m.depositLocked;
    txs.push(
      buildTx(
        await settleIxs(program, signer.publicKey, deal, index, {
          toWorker,
          toClient: 0n,
        }),
        signer,
        latest.blockhash,
      ),
    );
    labels.push(`worker paid ${formatTokens(toWorker)} tUSDC`);
  }
  for (const tx of txs) tx.sign(signer); // both signed up front, sent one after the other
  const signatures = await sendSignedSequence(connection, txs, latest);
  signatures.forEach((sig, i) =>
    console.log(`  ok  ${labels[i]}\n      ${explorerTx(sig)}`),
  );
});
