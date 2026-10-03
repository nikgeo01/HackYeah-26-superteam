// TRUSTED CHECKER (TEMPORARY). This is the no-go path of ADR-08 and it is NOT a
// proof: we call the GitHub API ourselves and, if the pull request is merged,
// sign the same claim format the attestor would, with a secp256k1 key we hold.
// A deal accepts it only if both parties put this key's address in the deal's
// `proof_attestor` at creation, i.e. they chose to trust us, like an arbiter.
//
// The output is a ProofArgs JSON for `node scripts/prove.ts --load <file>`.
import { secp256k1 } from "@noble/curves/secp256k1.js";
import { PublicKey } from "@solana/web3.js";
import {
  addressOfSecretKey,
  bindingMessage,
  checkProofArgs,
  contextJson,
  DEFAULT_CONTEXT_ADDRESS,
  expectedParameters,
  expectedUrl,
  fromHex,
  signClaimWithKey,
  toHex,
} from "../client/proof.ts";
import { cli, intArg, run } from "./lib/cli.ts";
import { fetchDeal } from "./lib/deal.ts";
import { env } from "./lib/env.ts";
import { writePrivateFile } from "./lib/keys.ts";
import { connect, loadProgram } from "./lib/program.ts";

const LABEL = "trusted checker (temporary)";

const USAGE = `
Usage:
  node scripts/trusted-checker.ts --address
  node scripts/trusted-checker.ts --generate
  node scripts/trusted-checker.ts --deal <address> --index <n> [--save <file>] [--force]

The ${LABEL}: NOT a proof. Checks on the GitHub API that the deal's pull
request is merged, then signs the claim with TRUSTED_CHECKER_KEY. Use only when
the attestor cannot produce proofs, and say so in the UI and docs.

  --address        print the checker's 20-byte address (use it as the deal's proof_attestor)
  --generate       print a new random key to put in .env as TRUSTED_CHECKER_KEY
  --deal, --index  check and sign for this milestone
  --save <file>    write the signed ProofArgs JSON (default: print it)
  --force          sign even if the deal names another attestor (the program will reject it)

Env: TRUSTED_CHECKER_KEY (32-byte secp256k1 secret, hex), GITHUB_PAT (optional, read-only),
     RPC_URL, PROGRAM_ID
`;

function checkerKey(): Uint8Array {
  const key = fromHex(env.required("TRUSTED_CHECKER_KEY"));
  if (key.length !== 32 || !secp256k1.utils.isValidPrivateKey(key)) {
    throw new Error(
      "TRUSTED_CHECKER_KEY must be a valid 32-byte secp256k1 secret in hex",
    );
  }
  return key;
}

/** Asks GitHub whether `repo#pr` is a merged pull request (the same endpoint the proof uses). */
async function prMergedAt(repo: string, pr: number): Promise<string | null> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "kept-trusted-checker",
  };
  const token = env.optional("GITHUB_PAT");
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(expectedUrl(repo, pr), { headers });
  if (!response.ok)
    throw new Error(`GitHub answered ${response.status} for ${repo}#${pr}`);
  const body = (await response.json()) as {
    pull_request?: { merged_at?: string | null };
  };
  if (!body.pull_request)
    throw new Error(`${repo}#${pr} is an issue, not a pull request`);
  return body.pull_request.merged_at ?? null;
}

run(async () => {
  const args = cli(USAGE, {
    address: { type: "boolean" },
    generate: { type: "boolean" },
    deal: { type: "string" },
    index: { type: "string" },
    save: { type: "string" },
    force: { type: "boolean" },
  });
  if (args.generate) {
    const key = secp256k1.utils.randomPrivateKey();
    console.log(`# ${LABEL} key; keep it out of git`);
    console.log(`TRUSTED_CHECKER_KEY=${toHex(key)}`);
    console.log(`# address (proof_attestor): ${addressOfSecretKey(key)}`);
    return;
  }
  if (args.address) {
    console.log(addressOfSecretKey(checkerKey()));
    return;
  }
  if (!args.deal)
    throw new Error("--deal is required (or --address / --generate)");

  const key = checkerKey();
  const checker = addressOfSecretKey(key);
  const dealKey = new PublicKey(args.deal);
  const index = intArg(args.index, "index");
  const program = loadProgram(connect());
  const deal = await fetchDeal(program, dealKey);
  const m = deal.milestones[index];
  if (!m || m.proofKind !== "prMerged")
    throw new Error(`milestone ${index} has no pull request bound to it`);
  const named = `0x${toHex(deal.proofAttestor)}`;
  console.log(`[${LABEL}] ${checker}`);
  console.log(
    `Deal ${dealKey.toBase58()} #${index}: ${deal.proofRepo} PR #${m.proofRef}; deal's attestor ${named}`,
  );
  if (named !== checker && !args.force) {
    throw new Error(
      "this deal does not name the trusted checker as its attestor; the program would reject the signature",
    );
  }

  const mergedAt = await prMergedAt(deal.proofRepo, m.proofRef);
  if (!mergedAt)
    throw new Error(
      `${deal.proofRepo}#${m.proofRef} is not merged; refusing to sign`,
    );
  console.log(`GitHub reports the pull request merged at ${mergedAt}`);

  const proof = signClaimWithKey({
    secretKey: key,
    parameters: expectedParameters(deal.proofRepo, m.proofRef),
    context: contextJson(
      DEFAULT_CONTEXT_ADDRESS,
      bindingMessage(dealKey, index),
    ),
  });
  const problems = checkProofArgs(proof, {
    repo: deal.proofRepo,
    pr: m.proofRef,
    deal: dealKey,
    index,
    attestor: named,
  });
  for (const p of problems) console.log(`  warning: ${p}`);

  const json = JSON.stringify(proof, null, 2) + "\n";
  if (args.save) {
    writePrivateFile(args.save, json);
    console.log(`Saved the ${LABEL} signature to ${args.save}`);
    console.log(
      `Submit and settle with: node scripts/prove.ts --deal ${dealKey.toBase58()} --index ${index} --load ${args.save}`,
    );
  } else {
    process.stdout.write(json);
  }
});
