# Proof spike (WP-01)

**Status: NOT RUN YET. It needs `RECLAIM_APP_ID` / `RECLAIM_APP_SECRET` and a read-only GitHub PAT.**

**Decision: (go / no-go): _pending_**

This page records what the attestor actually signs, so the on-chain checks
(INTERFACE 3.9) are built from real bytes and not from guesses. Every `_pending_`
field below is filled in from the output of `scripts/reclaim-spike.ts` (the full
output is also saved to `.demo/spike-report.json`, which is gitignored).

## How to run it

1. **Reclaim app.** At dev.reclaimprotocol.org, create an application and enable zkFetch
   in its Integration tab. Put the ID and the secret in the root `.env` (gitignored):
   ```
   RECLAIM_APP_ID=...
   RECLAIM_APP_SECRET=...
   ```
2. **GitHub token.** Create a fine-grained token with read-only access to public
   repositories only, and add it to `.env` as `GITHUB_PAT=...`.
3. **Demo repository** (public, owned by the "client"):
   - PR #1: merged.
   - PR #2: open. Its commit message and one line of a file contain the text
     `"merged": true` and `"merged_at": "2026`. These are the forgery bait for the attack test.
4. **Install** the dependencies at the repo root (`npm ci`). `@reclaimprotocol/zk-fetch` is
   pinned to exactly `1.1.0`, and the lockfile pins `@reclaimprotocol/attestor-core`. If
   zkFetch complains about missing circuit files, download them once:
   ```
   node node_modules/@reclaimprotocol/zk-symmetric-crypto/lib/scripts/download-files
   ```
5. **Run** the spike, which carries out steps 4 to 10 of WP-01:
   ```
   node scripts/reclaim-spike.ts --repo <owner>/<repo> --merged-pr 1 --open-pr 2
   ```
   Options: `--runs <n>` sets the number of runs used for the determinism diff (default 2),
   `--skip-attacks` skips the attack matrix, and `--out <file>` changes the fixture path.
6. **Check the fixture** at `fixtures/proof-pr-merged.json`. The script refuses to write
   it if the token, the app secret or an `Authorization` header appears anywhere in it.
   Check it by eye anyway before committing.
7. **Hand over to Dev A:** `node scripts/gen-proof-constants.ts` regenerates
   `proof/generated.rs` from the fixture, then the program is rebuilt and the IDL is re-synced.
   The scripts and the prover read `PROOF_PARAMS_*` from the IDL, so they pick up the
   change automatically.
8. Fill in this page and set the decision.

## Results

| Item | Value |
|---|---|
| Date run, zk-fetch version | _pending_ (zk-fetch 1.1.0) |
| `claimData.provider` | _pending_ (expected `http`) |
| Exact `claimData.parameters` | _pending_ |
| Parameter bytes before the URL (`PROOF_PARAMS_BEFORE_URL`) | _pending_ |
| Parameter bytes after the URL (`PROOF_PARAMS_AFTER_URL`) | _pending_ |
| Parameters equal to the IDL placeholder? | _pending_ |
| Spacing of the `merged_at` needle in GitHub's response | _pending_. The match `"merged_at": "2` was used. If GitHub returns compact JSON here, switch to the regex `"merged_at":\s*"\d{4}-` (INTERFACE 3.9). |
| Exact `claimData.context` | _pending_ |
| Context byte length (must be ≤ 512) | _pending_ |
| Keys the attestor adds to the context (e.g. `extractedParameters`, `providerHash`) | _pending_ |
| Does `contextAddress` accept a Solana address? | _pending_. The spike tries a base58 address first and falls back to `0x0`. The client currently sends `0x0` (override with `PROOF_CONTEXT_ADDRESS`). |
| identifier / owner / timestampS / epoch | _pending_ |
| Is `claimData.owner` lowercase? | _pending_. `client/proof.ts` lowercases it either way. |
| `witnesses[0].id` | _pending_ |
| Signature length and last byte (`v` convention) | _pending_. The program expects `v` to be 27 or 28; `proofArgsFromReclaim` turns 0 or 1 into 27 or 28. |
| Identifier recomputed as keccak256(provider \n parameters \n context) | _pending_ |
| Recovered signer = `witnesses[0].id` = `0x244897572368eadf65bfbc5aec98d8e5443a9072` | _pending_ |
| Determinism: `parameters` byte-identical across runs | _pending_ (the volatile span, if any: _pending_) |
| Latency (wall clock per zkFetch) | _pending_. This sets the UI request timeout (PLAN 4.4). |

## Attack test (open PR)

| Design | Request | Private `Accept` | Expected | Result |
|---|---|---|---|---|
| Old | `/pulls/2`, match `"merged": true` | `application/vnd.github.patch` | proof produced (the forgery) | _pending_ |
| New | `/issues/2`, match `"merged_at": "2` | `application/vnd.github.patch` | no proof | _pending_ |
| New | `/issues/2` | `application/vnd.github.diff` | no proof | _pending_ |
| New | `/issues/2` | `application/vnd.github.raw+json` | no proof | _pending_ |
| New | `/issues/2` | `application/vnd.github.html+json` | no proof | _pending_ |
| New | `/issues/2` | `application/vnd.github.full+json` | no proof | _pending_ |

If any row of the new design produces a proof, stop: the proof feature must not
ship as acceptance, and this page must say so.

## If the result is no-go

The no-go path keeps the same instruction and the same checks. The deal's
`proof_attestor` is set to a key we hold, and `scripts/trusted-checker.ts` checks the
GitHub API and signs the same claim format:

```
node scripts/trusted-checker.ts --generate          # once; put TRUSTED_CHECKER_KEY in .env
node scripts/trusted-checker.ts --address           # use as the deal's proof_attestor
node scripts/trusted-checker.ts --deal <addr> --index 0 --save .demo/proofs/d.json
node scripts/prove.ts --deal <addr> --index 0 --load .demo/proofs/d.json
```

Everywhere it appears, it is called a "trusted checker (temporary)" and never a proof.
