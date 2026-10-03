// Proof spike (WP-01 steps 4 to 10). Run once Reclaim credentials and a GitHub
// token exist; record the output in docs/PROOF_SPIKE.md.
//
//  4. zkFetch the Issues endpoint of a merged PR, token in private headers,
//     response match `contains "merged_at": "2`, context bound to a deal.
//  5. Print every field the plan needs pinned.
//  6. Recompute the identifier: keccak256(provider \n parameters \n context).
//  7. Rebuild the signed message (3.9 step 6) and recover the signer.
//  8. Run again and diff `parameters` (determinism).
//  9. Attack matrix against an OPEN PR (old /pulls design vs new /issues design).
// 10. Save fixtures/proof-pr-merged.json, checked to contain no token.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Keypair } from "@solana/web3.js";
import {
  bindingMessage,
  claimIdentifier,
  ethMessageDigest,
  expectedParameters,
  expectedUrl,
  proofArgsFromReclaim,
  RECLAIM_ATTESTOR,
  recoverSigner,
  signedMessage,
  toHex,
  zkFetchClaim,
  type ReclaimProofLike,
  type ZkFetchCredentials,
} from "../client/proof.ts";
import { cli, intArg, run } from "./lib/cli.ts";
import { DEMO_DIR, env, ROOT } from "./lib/env.ts";
import { writePrivateFile } from "./lib/keys.ts";
import { errorMessage } from "./lib/log.ts";

const USAGE = `
Usage: node scripts/reclaim-spike.ts --repo <owner/name> --merged-pr <n> --open-pr <n> [options]

WP-01 proof spike. Needs RECLAIM_APP_ID, RECLAIM_APP_SECRET and GITHUB_PAT
(fine-grained, read-only, public repositories) in the environment or root .env.

  --repo <owner/name>   public demo repository
  --merged-pr <n>       a merged pull request (PR #1 in the plan)
  --open-pr <n>         an open pull request whose commit message and a file line
                        contain "merged": true and "merged_at": "2026 (PR #2)
  --runs <n>            how many identical runs for the determinism diff (default 2)
  --skip-attacks        skip step 9
  --out <file>          fixture path (default fixtures/proof-pr-merged.json)
  -h, --help            this text

Writes the fixture and a full report to .demo/spike-report.json.
`;

/** The needle the plan specifies; the spike pins its spacing. */
const NEEDLE = `"merged_at": "2`;
const OLD_DESIGN_NEEDLE = `"merged": true`;
const ATTACK_ACCEPTS = [
  "application/vnd.github.patch",
  "application/vnd.github.diff",
  "application/vnd.github.raw+json",
  "application/vnd.github.html+json",
  "application/vnd.github.full+json",
];

interface RunResult {
  ms: number;
  contextAddress: string;
  proof: ReclaimProofLike;
}

async function timed(
  creds: ZkFetchCredentials,
  url: string,
  contextMessage: string,
  contextAddress: string,
  matches: { type: "contains" | "regex"; value: string }[],
  privateHeaders?: Record<string, string>,
): Promise<RunResult> {
  const started = Date.now();
  const proof = await zkFetchClaim(creds, url, contextMessage, {
    contextAddress,
    responseMatches: matches,
    privateHeaders,
  });
  return { ms: Date.now() - started, contextAddress, proof };
}

function firstDiff(
  a: string,
  b: string,
): { at: number; a: string; b: string } | null {
  if (a === b) return null;
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  let ea = a.length;
  let eb = b.length;
  while (ea > i && eb > i && a[ea - 1] === b[eb - 1]) {
    ea--;
    eb--;
  }
  return { at: i, a: a.slice(i, ea), b: b.slice(i, eb) };
}

function assertNoSecrets(text: string, secrets: string[]): void {
  for (const s of secrets)
    if (s && text.includes(s))
      throw new Error("the fixture contains a secret; not saving it");
  if (/authorization|bearer\s/i.test(text))
    throw new Error(
      "the fixture mentions an Authorization header; not saving it",
    );
}

run(async () => {
  const args = cli(USAGE, {
    repo: { type: "string" },
    "merged-pr": { type: "string" },
    "open-pr": { type: "string" },
    runs: { type: "string" },
    "skip-attacks": { type: "boolean" },
    out: { type: "string" },
  });
  const repo = args.repo ?? "";
  if (!/^[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+$/.test(repo))
    throw new Error("--repo owner/name is required");
  const mergedPr = intArg(args["merged-pr"], "merged-pr");
  const openPr = intArg(args["open-pr"], "open-pr");
  const runs = Math.max(2, intArg(args.runs, "runs", 2));
  const out = args.out ?? join(ROOT, "fixtures/proof-pr-merged.json");
  const creds: ZkFetchCredentials = {
    appId: env.required("RECLAIM_APP_ID"),
    appSecret: env.required("RECLAIM_APP_SECRET"),
    githubToken: env.required("GITHUB_PAT"),
  };
  const secrets = [creds.appSecret, creds.githubToken ?? ""];

  // A stand-in deal address: the binding format is what matters here.
  const fakeDeal = Keypair.generate().publicKey;
  const contextMessage = bindingMessage(fakeDeal, 0);
  const url = expectedUrl(repo, mergedPr);
  const matches = [{ type: "contains" as const, value: NEEDLE }];
  const report: Record<string, unknown> = {
    repo,
    mergedPr,
    openPr,
    url,
    contextMessage,
    needle: NEEDLE,
  };

  // Step 4, with the contextAddress question: try a Solana address first.
  console.log(`Step 4: zkFetch ${url}`);
  const solanaAddress = Keypair.generate().publicKey.toBase58();
  let first: RunResult;
  try {
    first = await timed(creds, url, contextMessage, solanaAddress, matches);
    report.contextAddressAcceptsSolana = true;
  } catch (error) {
    console.log(
      `  with a Solana contextAddress: ${errorMessage(error)}; retrying with 0x0`,
    );
    report.contextAddressAcceptsSolana = false;
    report.contextAddressSolanaError = errorMessage(error);
    first = await timed(creds, url, contextMessage, "0x0", matches);
  }

  // Step 5.
  const c = first.proof.claimData;
  const contextBytes = new TextEncoder().encode(c.context).length;
  const contextKeys = Object.keys(
    JSON.parse(c.context) as Record<string, unknown>,
  );
  const sig = first.proof.signatures[0] ?? "";
  const sigBytes = (sig.length - (sig.startsWith("0x") ? 2 : 0)) / 2;
  const fields = {
    provider: c.provider,
    parameters: c.parameters,
    context: c.context,
    contextBytes,
    contextWithin512: contextBytes <= 512,
    contextKeys,
    contextKeysAddedByAttestor: contextKeys.filter(
      (k) => k !== "contextAddress" && k !== "contextMessage",
    ),
    identifier: c.identifier,
    owner: c.owner,
    ownerIsLowercase: c.owner === c.owner.toLowerCase(),
    timestampS: c.timestampS,
    epoch: c.epoch,
    witness: first.proof.witnesses?.[0]?.id,
    signatureBytes: sigBytes,
    signatureLastByte: parseInt(sig.slice(-2), 16),
    wallClockMs: first.ms,
    contextAddressUsed: first.contextAddress,
  };
  report.fields = fields;
  console.log("Step 5:");
  for (const [k, v] of Object.entries(fields))
    console.log(`  ${k}: ${typeof v === "string" ? v : JSON.stringify(v)}`);

  // Step 6.
  const identifier = claimIdentifier(c.provider, c.parameters, c.context);
  const identifierOk = `0x${toHex(identifier)}` === c.identifier.toLowerCase();
  report.identifierRecomputed = identifierOk;
  console.log(
    `Step 6: identifier recomputed ${identifierOk ? "OK" : "MISMATCH"}`,
  );

  // Step 7 (as the program does it: owner lowercased, v - 27).
  const args7 = proofArgsFromReclaim(first.proof);
  const message = signedMessage(
    args7.identifier,
    args7.owner,
    args7.timestampS,
    args7.epoch,
  );
  const signer = recoverSigner(args7);
  report.signedMessage = message;
  report.signedDigest = toHex(ethMessageDigest(message));
  report.recoveredSigner = signer;
  report.signerIsWitness = signer === fields.witness?.toLowerCase();
  report.signerIsReclaimAttestor = signer === RECLAIM_ATTESTOR;
  report.vConvention =
    fields.signatureLastByte >= 27
      ? "27/28"
      : "0/1 (normalised to 27/28 by proofArgsFromReclaim)";
  console.log(
    `Step 7: recovered ${signer}; witness ${report.signerIsWitness ? "OK" : "MISMATCH"}; Reclaim attestor ${report.signerIsReclaimAttestor ? "OK" : "MISMATCH"}`,
  );

  // Parameters vs the constants currently in the IDL.
  const idlParams = expectedParameters(repo, mergedPr);
  report.matchesIdlParameters = idlParams === c.parameters;
  const at = c.parameters.indexOf(url);
  report.paramsBeforeUrl = at >= 0 ? c.parameters.slice(0, at) : null;
  report.paramsAfterUrl = at >= 0 ? c.parameters.slice(at + url.length) : null;
  console.log(
    `  parameters ${report.matchesIdlParameters ? "equal" : "DIFFER FROM"} the IDL's BEFORE_URL + url + AFTER_URL`,
  );
  console.log(`  before URL: ${JSON.stringify(report.paramsBeforeUrl)}`);
  console.log(`  after URL:  ${JSON.stringify(report.paramsAfterUrl)}`);

  // Step 8.
  const diffs: unknown[] = [];
  const latencies = [first.ms];
  for (let i = 1; i < runs; i++) {
    const again = await timed(
      creds,
      url,
      contextMessage,
      first.contextAddress,
      matches,
    );
    latencies.push(again.ms);
    diffs.push({
      run: i + 1,
      parameters: firstDiff(c.parameters, again.proof.claimData.parameters),
      context: firstDiff(c.context, again.proof.claimData.context),
    });
  }
  report.latenciesMs = latencies;
  report.determinism = diffs;
  const deterministic = diffs.every(
    (d) => (d as { parameters: unknown }).parameters === null,
  );
  report.parametersDeterministic = deterministic;
  console.log(
    `Step 8: parameters ${deterministic ? "byte-identical" : "VOLATILE"} over ${runs} runs; latencies ${latencies.join(", ")} ms`,
  );
  if (!deterministic) console.log(JSON.stringify(diffs, null, 2));

  // Step 9.
  if (!args["skip-attacks"]) {
    const attempt = async (
      label: string,
      u: string,
      needle: string,
      accept: string,
      expectProof: boolean,
    ) => {
      try {
        const r = await timed(
          creds,
          u,
          bindingMessage(fakeDeal, 1),
          first.contextAddress,
          [{ type: "contains", value: needle }],
          {
            Accept: accept,
          },
        );
        return {
          label,
          url: u,
          accept,
          needle,
          proofProduced: true,
          expectProof,
          ms: r.ms,
        };
      } catch (error) {
        return {
          label,
          url: u,
          accept,
          needle,
          proofProduced: false,
          expectProof,
          error: errorMessage(error),
        };
      }
    };
    const results = [
      await attempt(
        "old design (forgery)",
        `https://api.github.com/repos/${repo}/pulls/${openPr}`,
        OLD_DESIGN_NEEDLE,
        ATTACK_ACCEPTS[0],
        true,
      ),
    ];
    for (const accept of ATTACK_ACCEPTS) {
      results.push(
        await attempt(
          "new design",
          expectedUrl(repo, openPr),
          NEEDLE,
          accept,
          false,
        ),
      );
    }
    report.attacks = results;
    console.log("Step 9: attack matrix (open PR)");
    for (const r of results) {
      const verdict =
        r.proofProduced === r.expectProof ? "as expected" : "UNEXPECTED";
      console.log(
        `  ${r.label.padEnd(22)} Accept ${r.accept.padEnd(34)} proof ${r.proofProduced ? "PRODUCED" : "none"} (${verdict})`,
      );
    }
    const newDesignForged = results.some(
      (r) => !r.expectProof && r.proofProduced,
    );
    report.newDesignHolds = !newDesignForged;
    if (newDesignForged) {
      console.log(
        "STOP: the new design produced a proof for an open PR. The proof feature must not ship as acceptance.",
      );
    }
  }

  // Step 10.
  const fixture = {
    ...first.proof,
    meta: {
      note: "Real attestor proof from scripts/reclaim-spike.ts (WP-01). Contains no token or Authorization header.",
      url,
      contextMessage,
      recordedAt: new Date().toISOString(),
    },
  };
  const json = JSON.stringify(fixture, null, 2) + "\n";
  assertNoSecrets(json, secrets);
  writePrivateFile(out, json);
  const reportJson = JSON.stringify(report, null, 2) + "\n";
  assertNoSecrets(reportJson, secrets);
  writePrivateFile(join(DEMO_DIR, "spike-report.json"), reportJson);
  JSON.parse(readFileSync(out, "utf8")); // round-trips
  console.log(
    `Step 10: saved ${out} and .demo/spike-report.json (no secrets found)`,
  );
  console.log(
    "Next: node scripts/gen-proof-constants.ts (Dev A), then fill in docs/PROOF_SPIKE.md",
  );
});
