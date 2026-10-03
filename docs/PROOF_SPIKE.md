# Proof spike (WP-01)

**Status: RUN on 2026-10-03 against `nikgeo01/kept-demo` (PR #1 merged, PR #2 open with bait text).**

**Decision: GO.** A real Reclaim proof verifies with the program's own checks (unit test `real_attestor_proof_verifies`), and every forgery attempt against the new design failed.

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
| Date run, zk-fetch version | 2026-10-03, zk-fetch 1.1.0 |
| `claimData.provider` | `http` |
| Exact `claimData.parameters` | `{"body":"","method":"GET","responseMatches":[{"type":"contains","value":"\"merged_at\":\"2"}],"responseRedactions":[],"url":"https://api.github.com/repos/nikgeo01/kept-demo/issues/1"}` |
| Parameter bytes before / after the URL | Regenerated into `programs/milestone_escrow/src/proof/generated.rs` by `scripts/gen-proof-constants.ts` |
| Parameters equal to the old IDL placeholder? | No: the real request has no `geoLocation`, `headers` or `paramValues` keys. Constants regenerated. |
| Spacing of the `merged_at` needle | GitHub returns compact JSON: the match is `"merged_at":"2` (no space). The spaced form found nothing. |
| Context | `{"contextAddress":"<solana address>","contextMessage":"kept:v1:<deal hex>:<index>","providerHash":"0x…"}`, 243 bytes (limit 512) |
| Keys the attestor adds to the context | `providerHash` only |
| Does `contextAddress` accept a Solana address? | Yes |
| Is `claimData.owner` lowercase? | Yes |
| `witnesses[0].id` | `0x244897572368eadf65bfbc5aec98d8e5443a9072` (the Reclaim attestor) |
| Signature length and `v` | 65 bytes, `v` = 27 |
| Identifier recomputed as keccak256(provider \n parameters \n context) | Yes |
| Recovered signer equals the witness and the Reclaim attestor | Yes |
| Determinism | `parameters` byte-identical across runs |
| Latency per zkFetch | 3.5 to 7.6 seconds |

## Attack test (open PR #2)

| Design | Request | Private `Accept` | Expected | Result |
|---|---|---|---|---|
| Old | `/pulls/2`, match `"merged": true` | `application/vnd.github.patch` | proof produced (the forgery) | **proof produced**: the old design is forgeable |
| New | `/issues/2`, match `"merged_at":"2` | `application/vnd.github.patch` | no proof | no proof |
| New | `/issues/2` | `application/vnd.github.diff` | no proof | no proof |
| New | `/issues/2` | `application/vnd.github.raw+json` | no proof | no proof |
| New | `/issues/2` | `application/vnd.github.html+json` | no proof | no proof |
| New | `/issues/2` | `application/vnd.github.full+json` | no proof | no proof |
