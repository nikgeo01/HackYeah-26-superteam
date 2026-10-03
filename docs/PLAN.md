# Kept: Implementation Plan (HackYeah 2026, Superteam Poland "Finance Without Intermediaries")

Repo root: `/Users/nikgeo/Documents/programing-git-repos/HackYeah-26-superteam` (all relative paths below are relative to it).

## Context

Two people (Dev A = Nikola, Dev B = friend), both new to Solana and both driving AI coding agents, are entering the Superteam Poland challenge at HackYeah 2026. The challenge asks for a working Solana (devnet) application in which an on-chain program replaces a trusted financial intermediary. Submission closes Sunday 2026-10-04 at 11:00 (work started Saturday at 11:00; both times confirmed by Nikola, correcting the "11:00 PM" printed in the rules PDF). The repo is empty (one commit, only `.gitattributes`). This plan is the full architecture, specification, phase schedule and two-person split, written so each work package in section 7 can be handed to an AI agent as its brief.

**How this plan was produced (revision 2).** Three research agents gathered facts (toolchain, Reclaim zkTLS, escrow engineering). An architect agent drafted the plan. An independent review agent then checked it against both challenge PDFs and against primary sources, and its corrections are applied throughout: a proof-forgery hole was closed (section 3.9), a cancel-consent bug was fixed (3.5, 3.6), missing authorization constraints were added (3.7), the proof interface was made independent of the verification path, and the schedule was re-based. A second verification agent then confirmed every blocker as fixed, re-executed the state machine (no double payment, no stranded funds, no state without an exit) and found sequencing gaps in the work packages, which are also fixed (revision 3). Items the Phase 0 spike must still confirm are marked **[SPIKE]**.

**Commit history.** The existing history was checked: one commit, authored by Nikola, with no Claude or AI attribution. Nothing needs rewriting. Section 5.3 keeps it that way with an enforced hook.

Three design points up front, so they are not buried:

1. **The deadline is 11:00 on Sunday, not 23:00.** The rules PDF prints "11:00 PM" for both the start and the end; the real window is 11:00 Saturday to 11:00 Sunday. Section 6 is scheduled against that, and the proof layer is conditional on being ahead of schedule.
2. **Refinement: "verdict then payout".** Every decision instruction (approve, vote, proof, cancel) only records state. A single permissionless instruction, `settle_milestone`, is the only code that ever moves escrowed money out of the vault. This solves the proof transaction-size problem and removes recipient-account griefing from decision paths. It also gives the jury one function to look at for "where does the intermediary disappear". The frontend bundles decision + settle in one transaction where possible, so the user still sees "approve, paid" as one confirmed transaction.
3. **Refinement: the proof target (PR number) is fixed by the client and consented to by the worker.** The worker never supplies it at proof time. Otherwise a worker could point at any old merged PR. The "CI check passed" condition is Stretch only, because a PR author can edit the workflow file and make a same-named check pass trivially.

---

## 0. Executive summary

### Product one-liner
**Kept** is milestone escrow for freelance developers and their clients. The payment rules live in a Solana program, not a platform: silence pays the freelancer, an objection costs a deposit, a party-appointed panel of three arbiters settles disputes, and a merged pull request can release payment by cryptographic proof. No platform holds the money and, once the program is finalized, nobody can change the rules.

**Naming.** In the UI, slides and pitch the panel members are called **arbiters**, because "judges" collides with the hackathon jury. Code identifiers keep `judges` / `cast_vote` (frozen in the IDL). In this plan, "judge" inside section 3 means a panel arbiter; "jury" or "hackathon judges" means the people grading us.

("Kept" is a working title and can be changed freely. The on-chain crate name `milestone_escrow` is frozen at the interface freeze.)

### Target user (name it explicitly, everywhere)
**Freelance software developers who invoice clients abroad, and the small companies that hire them.** The persona is "Kasia, a freelance developer in Kraków, working for a startup client in another country she has never met."

Consequences for the UI:
- Plain language: "Payment locked", "Deliver work", "Approve and pay", "Raise an objection".
- No jargon on primary screens: no PDA, lamports, or raw addresses unless "Details" is expanded.
- Every action links to a "receipt" (the Solana Explorer transaction).
- GitHub is a first-class concept, because the user is a developer.

### Design rationale (reusable in README and submission)

**Which financial relationship was redesigned.** A client pays a freelancer for work delivered in milestones. Neither can go first safely. If the client pays first, the freelancer can vanish. If the freelancer delivers first, the client can take the code and not pay. Cross-border, neither can realistically sue.

**Who the intermediary was.** A freelance marketplace (Upwork/Fiverr style) performs three jobs:
1. It holds the money (custody).
2. It decides when the money is released (approval timers).
3. It arbitrates disputes with its own staff.

For this it charges both sides (roughly 10 to 20 percent of contract value combined; **verify exact numbers before putting them on a slide**). It decides who may use it, can freeze accounts or reverse payouts, and is a single point of failure.

**What changes when it is removed.**

| Job of the intermediary | Replaced by | Where in code |
|---|---|---|
| Custody | A program-owned token vault. No person holds a key to it. | `create_deal.rs` (vault init), `settle_milestone.rs` (only exit) |
| Release decision | A deterministic rule. Client approves, or the client's review window lapses and anyone can trigger payment. | `settle_milestone.rs`, `decide_outcome()` |
| Dispute resolution | A panel fixed at deal creation (client picks one, worker picks one, one mutual). Two matching votes settle. No majority by the deadline gives a 50/50 split. | `cast_vote.rs`, `settle_milestone.rs` |
| "Did the client take the work?" (optional) | A zkTLS proof that GitHub reports the agreed PR as merged, verified on-chain. The client's merge is the payment: they cannot take the work on GitHub and withhold the money. | `submit_proof.rs` |
| Platform's power to change rules | Removed: no admin instruction, no fee account, no pause. Upgrade authority burned with `--final`. | `lib.rs` (no admin instruction exists) |

Further properties:
- Arbiters and the program author can never receive escrowed funds. The only two recipients the program can pay are the stored `client` and `worker`.
- An objection is not free. The client locks a deposit that is forfeited to the freelancer if the panel sides with the freelancer.
- Every state has a deadline-driven exit, so funds cannot be stranded by someone disappearing.

**Honest limits (state these; the jury rewards it).**
- A proof or a test only checks what it encodes. "PR merged" does not mean "the work is good".
- Subjective disputes still need humans. The arbiters are trusted not to collude, but they can never take the money, and the worst case with absent arbiters is a 50/50 split.
- The proof is a signature from one attestor that both parties chose when the deal was made (by default the Reclaim-operated one): a third party neither side controls, not full trustlessness.
- "Merged" means acceptance only if the client controls merges on the agreed repository. The worker must check that before accepting. Public repositories only. A client can still copy the code without merging; then the review timer and the panel apply.
- With a 1–1 vote and an absent third arbiter the result is a 50/50 split with the deposit returned, so an objection is cheap when the panel cannot decide (see Open Question Q7). A deposit of zero makes objections free.
- Until `--final`, the upgrade authority is a backdoor. Show `solana program show` live.
- The token issuer (a real stablecoin's freeze authority) is outside our control.
- Timer minimums are short for demo purposes.
- Marketplace fee figures and prior-art names (Stillpaid, Escrowl) must be verified before they appear on a slide.

### Scope lines (the full specification stays; tiers only set the build order)
- **MVP-0, Saturday 22:45 (submission-safe):** create, accept, deliver, approve, silence-pays release and no-submission refund on devnet through the UI with explorer receipts; README; a backup recording.
- **MVP-1, Sunday 01:30 (before sleep):** cancel and close, arbiter panel with deposit and 50/50 fallback, role switcher for all six demo actors, crank script.
- **Target:** hosted frontend, `--final`, and, only if MVP-1 is on devnet by 23:30 on Saturday, the proof-based release (PR merged, zkTLS, on-chain verification with a per-deal attestor) with its prover service. If that condition is missed, the proof layer is presented as specified roadmap.
- **Stretch:** the e2e devnet script, CPI into Reclaim's deployed verifier as a second verification path, CI check-run condition, activity log from events, verifiable build, exhaustive authorization tests, crank `--watch`.

---

## 1. Architecture decisions (ADRs)

### ADR-01 Development environment
- **Decision:** Primary is a native install on macOS arm64 using the official `curl --proto '=https' --tlsv1.2 -sSfL https://solana.com/install | bash`, then pinning Anchor to 1.1.2 and the Solana CLI to 3.1.10. Fallback is GitHub Codespaces using the organizers' dev container. Their `Dockerfile` (base `quay.io/ottersec/anchor:v1.1.2`, plus Node 24, Rust 1.95.0 and Surfpool, build target `toolchain`) and `.devcontainer/` are copied into the repo together; the bare base image alone has no Surfpool and ships Node 22. `postCreateCommand` becomes `npm ci && npm --prefix app ci`.
- **Pin commands:** `avm install 1.1.2 && avm use 1.1.2`, `agave-install init 3.1.10`.
- **Hedge:** at T0 each dev starts the native install and also opens a Codespace on the repo, so the container image pulls in the background.
- **30-minute timebox rule:** if `anchor build` on the scaffold has not succeeded natively 30 minutes after starting, that dev switches to the Codespace permanently and does not look back. The frontend and Phantom still run on the local machine either way.
- **Rationale:** native arm64 Rust builds are several times faster than amd64 under Rosetta. Codespaces is the exact mentor environment (amd64, no emulation), so booth help applies.
- **Rejected:** dev container under Rosetta locally (slow, flaky file watching); Solana Playground (old Anchor, cannot compile Anchor 1.x).
- **[SPIKE]** Confirm `surfpool --version` exists after the installer. If missing, install Surfpool per its README or use the Codespace.

### ADR-02 Anchor version
- **Decision:** Anchor 1.1.2 with Solana CLI 3.1.10, pinned in `Anchor.toml` (`[toolchain] anchor_version = "1.1.2"`).
- **Rationale:** identical to the mentors' container and the `plan:diamond-hands` template, so booth help and CI are reproducible.
- **Rejected:** 1.2.0 (newer, but nobody at the event runs it and it brings no feature we need).

### ADR-03 Test strategy
- **Decision:** one primary: TypeScript mocha tests on Surfpool with `surfnet_timeTravel`, following the `diamond-hands` template.
- **Rationale:** the test code is the same `@anchor-lang/core` client code the frontend needs, so tests double as the reference client. Time travel makes timer tests instant.
- **Constraint:** time travel is forward-only. Every test creates its own deal and travels relative to current chain time.
- **Helpers (exact):** `timeTravelTo(unixSeconds)` posts JSON-RPC `surfnet_timeTravel` with `params: [{ absoluteTimestamp: unixSeconds * 1000 }]` (milliseconds). `chainNow()` reads the Clock sysvar account and decodes the `i64` at byte offset 32.
- **Fallback if time travel misbehaves:** write the Clock sysvar with `surfnet_setAccount`, or run the timer tests against devnet with 10-second windows. Sleeping does not work: under `anchor test`, Surfpool only produces blocks when a transaction arrives, so its clock is frozen while a test sleeps.
- **Runtime notes:** tests run under Node's native type stripping, so use erasable TypeScript only, `.ts` import extensions, `BN` from `bn.js`, and `npx tsc --noEmit` as a separate check.
- **Rejected:** LiteSVM Rust tests (no code sharing with the frontend, second mental model).
- **Exception:** `proof::verify` gets plain Rust unit tests (`cargo test`) for pure string and hash logic.

### ADR-04 Frontend stack
- **Decision:** Vite + React + TypeScript + Tailwind, scaffolded from create-solana-dapp 4.8.5 template `web3js-react-vite-tailwind-counter`. Libraries: `@anchor-lang/core`, `@solana/web3.js` v1, wallet-adapter, `@solana/spl-token`, react-query. `HashRouter` for static hosting.
- **Rationale:** same client library as the tests, no SSR hydration issues with wallets, static deploy.
- **Rejected:** Next.js (SSR pitfalls, no benefit); Kit + Codama (not compatible with the Anchor TS client, extra codegen step).

### ADR-05 Account model
- **Decision:** one `Deal` account per deal (PDA `[b"deal", client, deal_id_le]`) with milestones inline (`Vec<Milestone>`, max 5), plus one vault token account (PDA `[b"vault", deal]`, authority = Deal PDA). No global config account and no per-milestone accounts.
- **Rationale:** one fetch renders a whole deal. A fixed-offset header allows `memcmp` queries by role. No global account means no admin.
- **Rejected:** per-milestone PDAs (more accounts per transaction, more fetches); a global registry (creates an admin surface).

### ADR-06 Settlement: verdict then payout
- **Decision:** decision instructions never transfer escrowed funds out. `settle_milestone` is permissionless and is the only instruction that pays out of the vault. `close_deal` additionally sweeps any dust to the client.
- **Recipient accounts:** any classic SPL token account with `mint == deal.mint` and `owner == stored party`, not strictly the associated token account. Recipient accounts are optional, required only when that side's payout is non-zero.
- **Rationale, griefing:**
  - An arbiter's vote or a client's approval can never fail because of someone's token account.
  - A party who bricks their own associated token account cannot block anything, because anyone can create a fresh token account owned by them and crank.
  - A missing worker account never blocks a client-only refund, because of the optional accounts.
- **Rationale, transaction size:** proof verification carries no token accounts.
- **Rationale, demo:** the frontend composes `[decision, settle]` in one transaction for approve and for the deciding vote, so the explorer shows one transaction with both.
- **Rationale, story:** one 40-line function is the entire "intermediary".
- **Rejected:** direct transfer inside each decision instruction (seven places that move money, recipient-account failure modes in votes); a full pull-payment ledger with `claimable_*` (an extra state and an extra click for the same guarantee).
- **De-risking:** optional accounts are exercised in the P1 vertical slice before the interface is frozen (a settle with `client_token = null`). If they cost more than 20 minutes there, both recipient accounts become required before the freeze, not after. Permissionless account creation still prevents permanent blocking.
- **Accepted trade-off:** the cranker chooses which of the recipient's token accounts is paid, so it could pay into an obscure non-ATA account the recipient owns. The frontend and scripts always use the ATA.

### ADR-07 Token program restriction
- **Decision:** classic SPL Token only, using `anchor_spl::token::{Token, Mint, TokenAccount}` types, with `transfer_checked`. The mint is passed as an account and stored in the Deal, never hard-coded.
- **Rationale:** Token-2022 extensions (transfer fee, hooks, permanent delegate, pausable) each break an invariant.
- **Rejected:** `token_interface` accepting both programs.

### ADR-08 Proof layer
- **Decision:**
  - `submit_proof` is permissionless. Our program verifies the attestor's signature itself (keccak + `secp256k1_recover`) and compares the recovered Ethereum-style address with `deal.proof_attestor`, a 20-byte address fixed at deal creation. The UI defaults it to the Reclaim attestor `0x244897572368eadf65bfbc5aec98d8e5443a9072`.
  - Our program reconstructs the expected claim parameters on-chain from the Deal (repo and PR number) and recomputes the claim identifier, so a proof for any other URL or response match cannot verify.
  - It checks that the signed context contains this deal's binding string.
  - On success the milestone becomes `Approved`. Payout happens via the normal `settle_milestone`.
  - The instruction takes only `submitter` and `deal`. The interface is therefore identical for every verification path below.
- **Rationale:**
  - The whole proof path is testable on localnet: tests sign claims with a test secp256k1 key and set it as the deal's attestor.
  - The trust statement is honest and symmetrical with the panel: the parties choose the attestor like they choose the arbiters.
  - No dependency on a third-party on-chain program whose source is not published.
  - Reclaim remains the ecosystem building block for the part that matters: producing the zkTLS attestation.
- **Path ladder (same IDL in every case):**
  - Primary: inline verification against the per-deal attestor, with the Reclaim attestor address.
  - No-go (Reclaim cannot produce a proof at all): the same instruction with the deal's attestor set to a key we run ourselves, which signs the same claim format after checking the GitHub API. The UI and docs call this a "trusted checker (temporary)", never a proof.
  - Stretch: an additional CPI into Reclaim's deployed devnet verifier `8rYXFrtST4ePpMWcEqhazFyRG2DtCUqgtFmKT7FdjRyp`, shown as "also verified by Reclaim's own program". Only attempt this if it adds no accounts to the frozen interface (use `remaining_accounts`).
- **Trust note for the limitations doc:** the trust base for proof-enabled milestones is one pinned attestor key plus GitHub. Attestor rotation is not followed automatically; a deal keeps the key it was created with.
- **Rejected:** CPI into `8rYX…` as the primary path (source unpublished, cannot be tested locally, adds accounts); crates.io `reclaim-solana` 0.1.0 (Anchor 0.29 conflict); program `rEcL…` (old ABI); verify + release in one instruction (size).

### ADR-09 RPC
- **Decision:** free Helius devnet endpoint for the app, scripts and deploys (`VITE_RPC_URL`, `RPC_URL`), with fallback to `https://api.devnet.solana.com`.
- **Rationale:** public RPC rate limits will break a live demo that polls and subscribes.
- **Note:** a devnet key in a client bundle is acceptable.

### ADR-10 Demo role switcher
- **Decision:** an app-level `ActorContext` exposes the active signer `{ publicKey, signTransaction, signAllTransactions, label }`.
  - Source 1: the real wallet via wallet-adapter (Phantom). This is the client in the main demo flow.
  - Source 2: demo keypairs loaded from `VITE_DEMO_ACTORS`, only when `VITE_DEMO_MODE=true`. Roles: Client, Worker, Arbiter 1 to 3, and Passer-by.
- **Security framing (stated in UI and README):** "Demo mode embeds throwaway devnet keys in the page so one person can play all roles. These keys are public by design and hold only test tokens. A real deployment would ship without demo mode."
- **Two actor sets, because public keys will be abused:**
  - Hosted set: baked into the public demo build, about 0.05 SOL each, used only on public showcase deals. Anyone may drain or consume these.
  - Pitch set: lives only in the pitch laptop's `app/.env.local`, never deployed or committed. Its deals are re-seeded 30 minutes before the pitch.
- **Anchor wiring:** `useProgram()` builds an `AnchorProvider` from an object `{ publicKey, signTransaction, signAllTransactions }` supplied by the active actor, so wallet and demo keys go through the same code path.
- **Rationale:** six actors (client, worker, three arbiters, passer-by) on one laptop with Phantom account switching is the top live-demo failure risk. The Passer-by makes the permissionless crank vivid.
- **Rejected:** a custom wallet-adapter plugin (more code for the same effect); six browser profiles.

### ADR-11 Network configuration
- **Decision:** localnet (Surfpool) for tests; devnet for everything shown. There is one program ID for the whole event, upgraded in place until the freeze and then finalized. The frontend filters deal accounts by `dataSize`, so old-layout accounts from earlier deploys are ignored.
- **Rejected:** a separate "release" program ID (doubles SOL needs while the faucet is unreliable).

### ADR-12 Monorepo layout
- **Decision:** two npm projects.
  - Root: Anchor workspace, tests, scripts, prover, shared `client/` helpers.
  - `app/`: the frontend.
- Shared pure logic (`client/pdas.ts`, `client/rules.ts`) exists once, in `client/`. The app imports it through a Vite alias (`@client` → `../client`) and a matching `tsconfig` path. These two files import nothing except `@solana/web3.js` types, so they resolve from either project.
- The IDL is generated by Dev A only and copied by a script into `idl/` and `app/src/idl/`.
- **Rationale:** avoids duplicate `@solana/web3.js` instances and gives clean directory ownership.
- **Rejected:** npm workspaces (hoisting surprises with the dapp template); a published SDK package.

### ADR-13 Test token
- **Decision:** our own 6-decimal classic SPL mint "tUSDC". Its mint authority is a throwaway keypair embedded in the app for an in-app "Get test dollars" button.
- **Rationale:** the Circle faucet gives 20 USDC per 2 hours, which is unusable for rehearsals.
- **Rejected:** devnet USDC (still works, since the mint is an account); a faucet instruction in the escrow program (pollutes the program we want judges to read).

---

## 2. System architecture

```
                 (humans)                                         (public internet)
  Client   Worker   Arbiter1..3 Passer-by                       GitHub REST API
    |        |         |           |                                    ^
    v        v         v           v                                    | TLS session witnessed
 +---------------------------------------+                              | by Reclaim attestor
 |  Frontend (app/, static site)         |   POST /prove    +-----------+-----------+
 |  ActorContext: Phantom | demo keys    |----------------->| Prover (prover/)      |
 |  Anchor TS client + committed IDL     |<-----------------| stateless, zkFetch,   |
 +-------------------+-------------------+   proof JSON     | holds APP_SECRET+PAT, |
                     | signed transactions (RPC: Helius)    | ENFORCES NOTHING      |
                     v                                      +-----------------------+
 +---------------------------------------------------------------------------------+
 | Solana devnet                                                                   |
 |  +----------------------------+                                                 |
 |  | milestone_escrow (ours)    |  verifies the attestor signature itself         |
 |  |  Deal PDA (state)          |  (keccak + secp256k1_recover syscalls)          |
 |  |  Vault PDA (token account) |--CPI transfer_checked---->  SPL Token program   |
 |  +----------------------------+                                                 |
 +---------------------------------------------------------------------------------+
 scripts/: create-test-mint, demo-setup, seed-deals, crank (script), prove (CLI), e2e-devnet
```

### Trust boundaries
1. **Enforcing (trusted because it is verifiable):** the `milestone_escrow` program, the SPL Token program, Solana consensus.
2. **Not enforcing (untrusted by the program):** the frontend, the prover service, the crank script, RPC providers. If all of them vanish, any party can still call the program from a script and get the same outcomes. Say this sentence in the pitch.
3. **Trusted third parties, named honestly:**
   - the three arbiters (verdict only, never custody);
   - the attestor chosen in the deal, by default Reclaim's (proof milestones only);
   - GitHub (the fact source);
   - the token issuer;
   - the upgrade authority until `--final`.

### Data flows per scenario
- **S1 Happy path.** Client `create_deal` (tokens move client to vault). Worker `accept_deal`. Worker `submit_work(hash)`. Client `[approve_milestone, settle_milestone]` in one transaction (vault to worker).
- **S2 Silent client.** As S1 up to submit. The client does nothing. After `review_deadline`, anyone (Passer-by or the crank script) calls `settle_milestone` (vault to worker).
- **S3 Dispute.** After submit, the client calls `open_dispute` (deposit moves client to vault). Arbiters call `cast_vote`; the second matching vote is bundled with `settle_milestone`.
  - Worker wins: amount + deposit go to the worker.
  - Client wins: amount + deposit go to the client.
- **S4 No majority.** After `vote_deadline`, anyone calls `settle_milestone`. The amount is split 50/50 (the odd unit goes to the worker) and the deposit returns to the client.
- **S5 No submission.** After `submit_deadline`, anyone calls `settle_milestone` (amount to client).
- **S6 Cancel.** Before acceptance: the client calls `cancel_deal(true)`, or anyone does after `accept_deadline`. After acceptance: both parties each call `cancel_deal(true)`; either may withdraw with `cancel_deal(false)` until the other agrees. Then `settle_milestone` per remaining undecided milestone refunds the client.
- **S7 Proof release.** The client merges the PR on GitHub. Anyone asks the prover for a proof bound to the deal. `submit_proof` runs the on-chain checks and the signature verification, marking the milestone Approved. `settle_milestone` pays the worker. The client takes no payment action: merging was the acceptance.
- **S8 Close.** When all milestones are settled, anyone calls `close_deal`. Rent goes to the client.

---

## 3. On-chain specification (`programs/milestone_escrow`)

### 3.1 Constants (`constants.rs`)

| Name | Value | Meaning |
|---|---|---|
| `DEAL_SEED` | `b"deal"` | Deal PDA seed |
| `VAULT_SEED` | `b"vault"` | Vault PDA seed |
| `MAX_MILESTONES` | 5 | Per deal |
| `MAX_REPO_LEN` | 80 | Bytes of `"owner/name"` |
| `MAX_URI_LEN` | 128 | Deliverable link (event only) |
| `MAX_CONTEXT_LEN` | 512 | Bytes of the signed proof context |
| `PROOF_OWNER_LEN` | 42 | `"0x"` + 40 lowercase hex characters |
| `MIN_WINDOW_SECS` | 10 | Lower bound for all timers and `due_secs` (demo-friendly; documented limitation). Live demo deals use 30 to 45 seconds, because devnet clock drift can exceed 10 seconds. |
| `MAX_WINDOW_SECS` | 31_536_000 | 365 days; upper bound for all timers and `due_secs` |
| `VOTE_NONE / VOTE_WORKER / VOTE_CLIENT` | 0 / 1 / 2 | Stored in `votes[i]` |
| `CANCEL_FLAG_CLIENT / _WORKER` | 0b01 / 0b10 | Bits in `cancel_flags` |
| `PROOF_PROVIDER` | `"http"` | **[SPIKE]** confirm |
| `PROOF_PARAMS_BEFORE_URL`, `PROOF_PARAMS_AFTER_URL` | generated from the spike fixture | Exact canonical parameter bytes around the URL **[SPIKE]**. Generated by `scripts/gen-proof-constants.ts` into `proof/generated.rs`; never hand-typed, because the JSON escaping is error-prone. |
| `PROOF_CONTEXT_PREFIX` | `"kept:v1:"` | Binding string prefix |

The Reclaim attestor address `0x244897572368eadf65bfbc5aec98d8e5443a9072` is not a program constant. It is the frontend's default value for `CreateDealArgs.proof_attestor`.

### 3.2 Accounts and types (`state.rs`)

```rust
#[account] #[derive(InitSpace)]
pub struct Deal {
    pub client: Pubkey,            // offset 8
    pub worker: Pubkey,            // offset 40
    pub judges: [Pubkey; 3],       // offsets 72, 104, 136 (0=client's pick, 1=worker's pick, 2=mutual)
    pub mint: Pubkey,              // offset 168
    pub deal_id: u64,              // 200
    pub status: DealStatus,        // 208 (1 byte)
    pub bump: u8,                  // 209
    pub vault_bump: u8,            // 210
    pub cancel_flags: u8,          // 211
    pub settled_count: u8,         // 212
    pub created_at: i64,           // 213
    pub accept_deadline: i64,      // 221
    pub accepted_at: i64,          // 229 (0 until accepted)
    pub review_window_secs: u32,   // 237
    pub vote_window_secs: u32,     // 241
    pub dispute_deposit: u64,      // 245
    pub proof_attestor: [u8; 20],  // 253 Ethereum-style address of the attestor both sides accept (zero = proofs disabled)
    pub reserved: [u8; 12],        // 273 zeroed
    #[max_len(80)] pub proof_repo: String,       // 285, "owner/name" or empty
    #[max_len(5)]  pub milestones: Vec<Milestone>,
}
// Allocated size is always 8 + Deal::INIT_SPACE = 843 bytes (frontend dataSize filter).

#[derive(AnchorSerialize, AnchorDeserialize, Clone, InitSpace)]
pub struct Milestone {             // 94 bytes
    pub amount: u64,
    pub status: MilestoneStatus,   // 1
    pub outcome: Outcome,          // 1
    pub proof_kind: ProofKind,     // 1
    pub votes: [u8; 3],            // index-aligned with deal.judges
    pub proof_ref: u32,            // PR number (0 = none)
    pub due_secs: u32,             // submit deadline relative to acceptance
    pub submit_deadline: i64,      // set at accept
    pub submitted_at: i64,
    pub review_deadline: i64,
    pub vote_deadline: i64,
    pub deposit_locked: u64,
    pub deliverable_hash: [u8; 32],
}

// All enums: implicit discriminants in declaration order (Borsh 1.x rejects explicit `= n`
// without extra attributes), and this exact derive list:
// #[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace)]
pub enum DealStatus      { Open, Active, Cancelled }
pub enum MilestoneStatus { Pending, Submitted, Disputed, Approved, Settled }
pub enum Outcome         { Unset, WorkerPaid, ClientRefunded, Split, Cancelled }
pub enum ProofKind       { Off, PrMerged, CheckRun /* stretch; rejected in v1 */ }
pub enum Side            { Worker, Client }   // cast_vote argument
```

`Unset` and `Off` are used instead of `None` so the variants never shadow `Option::None`.

Rules for the header: no `Option`, `Vec` or `String` before `proof_repo`. This keeps the offsets above stable for `memcmp`. A Rust unit test serializes a Deal with known keys and asserts every offset in the comments above, and asserts `8 + Deal::INIT_SPACE == 843`.

**Vault:** token account at PDA `[b"vault", deal.key()]`, with `token::mint = mint`, `token::authority = deal`.

### 3.3 Instruction arguments (frozen contract)

```rust
pub struct MilestoneInput { pub amount: u64, pub due_secs: u32, pub proof_kind: ProofKind, pub proof_ref: u32 }

pub struct CreateDealArgs {
    pub deal_id: u64, pub worker: Pubkey, pub judges: [Pubkey; 3],
    pub accept_window_secs: u32, pub review_window_secs: u32, pub vote_window_secs: u32,
    pub dispute_deposit: u64, pub proof_attestor: [u8; 20], pub proof_repo: String,
    pub milestones: Vec<MilestoneInput>,
}

pub struct ProofArgs {
    pub context: String,        // exactly as signed (canonical JSON), at most 512 bytes
    pub identifier: [u8; 32],
    pub owner: String,          // "0x" + 40 lowercase hex, exactly as signed
    pub timestamp_s: u32,
    pub epoch: u32,
    pub signature: [u8; 65],    // r || s || v
}

create_deal(args: CreateDealArgs)
accept_deal()
submit_work(index: u8, deliverable_hash: [u8; 32], uri: String)
approve_milestone(index: u8)
open_dispute(index: u8)
cast_vote(index: u8, side: Side)
set_proof_target(index: u8, proof_kind: ProofKind, proof_ref: u32)
submit_proof(index: u8, proof: ProofArgs)
cancel_deal(agree: bool)
settle_milestone(index: u8)
close_deal()
```

That is 11 instructions and 12 events (3.8). The frontend generates `deal_id` from `Date.now()`, so a closed deal's address is never re-created by accident.

**Deadline convention (global):** a party's action is allowed while `now < deadline`. A crank is allowed when `now >= deadline`. Exactly one is true at any instant, so there is no gap and no overlap. `now = Clock::get()?.unix_timestamp`. Every deadline is computed as `now.checked_add(i64::from(window_secs))`.

### 3.4 State machine

Deal level:
```
            create_deal                 accept_deal (worker, now < accept_deadline)
 (none) ----------------> Open ---------------------------------------> Active
                           |                                              |
   cancel_deal(true): client any time;                                    | cancel_deal(true) by client AND worker
   anyone once now >= accept_deadline                                     | (either may withdraw with cancel_deal(false)
                           v                                              v  until the other agrees)
                        Cancelled <---------------------------------------+
 Any status, once settled_count == milestones.len(): close_deal -> accounts closed
```

Milestone level (while the deal is Active unless noted):
```
 Pending --submit_work (worker, now<submit_deadline)--> Submitted --open_dispute (client, now<review_deadline)--> Disputed
    |                                                    |   |                                                   |    |
    |                                 approve_milestone  |   | submit_proof        approve_milestone (concede)   |    |
    |  submit_proof                       (client)       v   v                     or submit_proof (no majority) |    |
    +-------------------------------------------------> Approved <----------------------------------------------+    |
    |                                                    |                                                            |
    | settle (now>=submit_deadline) -> client            | settle -> worker gets amount + any locked deposit          |
    |                                                    |                                                            |
    |        Submitted: settle (now>=review_deadline) -> worker                 [SILENCE PAYS]                        |
    |        Disputed:  settle (2 votes Worker) -> worker gets amount+deposit   <-------------------------------------+
    |                   settle (2 votes Client) -> client gets amount+deposit
    |                   settle (now>=vote_deadline, no majority) -> 50/50, deposit back to client
    |        Deal Cancelled and milestone not Approved and not decided by 2 votes: settle -> client (amount+deposit)
    v
 Settled (terminal; outcome recorded)
```

**Deposit rule in one sentence:** the deposit follows the milestone money (to whoever wins it), except on a no-majority split, where it returns to the client.

### 3.5 Transition table

| Instruction | Signer | Preconditions | Effects | Token movement | Event | Main errors |
|---|---|---|---|---|---|---|
| `create_deal` | client | Validation list below | Init Deal (Open) and vault; `accept_deadline = now + accept_window` | client token account to vault: sum of amounts | `DealCreated` | `InvalidMilestoneCount`, `ZeroAmount`, `WindowOutOfBounds`, `DuplicateParty`, `InvalidRepo`, `InvalidProofTarget`, `DuplicateProofTarget`, `MathOverflow` |
| `accept_deal` | worker | Open; `now < accept_deadline` | Active; `accepted_at = now`; each `submit_deadline = now + due_secs` | none | `DealAccepted` | `NotWorker`, `DealNotOpen`, `AcceptWindowClosed` |
| `submit_work` | worker | Active; index valid; milestone Pending; `now < submit_deadline`; `uri.len() <= 128` | Submitted; store hash; `submitted_at = now`; `review_deadline = now + review_window`; clear the worker's cancel bit (delivering work withdraws a pending cancel request, so stale consent cannot be used against delivered work) | none | `WorkSubmitted` (includes uri) | `NotWorker`, `DealNotActive`, `InvalidMilestoneIndex`, `InvalidMilestoneStatus`, `SubmitWindowClosed`, `UriTooLong` |
| `approve_milestone` | client | Active; milestone Submitted or Disputed (from Disputed this is a concession: the worker is paid and the locked deposit goes to the worker too; allowed even after a majority, because it can only favour the worker) | Approved | none | `MilestoneApproved` | `NotClient`, `DealNotActive`, `InvalidMilestoneIndex`, `InvalidMilestoneStatus` |
| `open_dispute` | client | Active; Submitted; `now < review_deadline` | Disputed; `vote_deadline = now + vote_window`; `deposit_locked = dispute_deposit` | client token account to vault: deposit (skipped when the deposit is 0) | `DisputeOpened` | `NotClient`, `DealNotActive`, `InvalidMilestoneIndex`, `InvalidMilestoneStatus`, `ReviewWindowClosed` |
| `cast_vote` | one of `judges` | Active; Disputed; `now < vote_deadline`; that arbiter has not voted; no majority yet | `votes[j] = VOTE_WORKER` or `VOTE_CLIENT` (map explicitly; never cast `side as u8`, because `Side::Worker` is 0, which equals `VOTE_NONE`) | none | `VoteCast` (includes tallies and `decided`) | `NotJudge`, `DealNotActive`, `InvalidMilestoneIndex`, `InvalidMilestoneStatus`, `AlreadyVoted`, `AlreadyDecided`, `VoteWindowClosed` |
| `set_proof_target` | client | Open or Active; milestone Pending or Submitted; current `proof_kind == Off`; repo non-empty; `proof_attestor` non-zero; kind == PrMerged; ref > 0; ref not used by another milestone of this deal | Set kind and ref (one-time, immutable after) | none | `ProofTargetSet` | `NotClient`, `DealNotActive` (deal is neither Open nor Active), `InvalidMilestoneIndex`, `InvalidMilestoneStatus`, `ProofTargetAlreadySet`, `InvalidProofTarget`, `DuplicateProofTarget` |
| `submit_proof` | anyone | Active; milestone in {Pending, Submitted, Disputed}; no 2-vote majority exists; `proof_kind == PrMerged`; all proof checks pass (3.9) | Approved (`deposit_locked` unchanged, so it goes to the worker at settle) | none | `ProofVerified` | `DealNotActive`, `InvalidMilestoneIndex`, `InvalidMilestoneStatus`, `AlreadyDecided`, `NoProofTarget`, `ProofMalformed`, `ProofIdentifierMismatch`, `ProofContextMismatch`, `ProofSignatureInvalid`, `ProofAttestorMismatch` |
| `cancel_deal(agree)` | see effects | Open or Active | **Open:** `agree` must be true. Signer is client: Cancelled. Signer is anyone and `now >= accept_deadline`: Cancelled. Any other signer before the deadline: `NotParty`. **Active:** signer must be client or worker (`NotParty` otherwise); set (agree = true) or clear (agree = false) that party's bit; when both bits are set the deal becomes Cancelled. | none | `CancelRequested { by, agree }` / `DealCancelled` | `NotParty`, `DealNotCancellable`, `InvalidCancelArgument` |
| `settle_milestone` | anyone | `decide_outcome` returns a payout (3.6) | Settled; outcome set; `deposit_locked = 0`; `settled_count += 1` (state written before CPIs) | vault to worker and/or client per table | `MilestoneSettled` | `AlreadySettled`, `NothingToSettle`, `MissingRecipientAccount`, `InvalidMilestoneIndex` |
| `close_deal` | anyone | `settled_count == milestones.len()` | Sweep any vault remainder to the client; close vault (rent to client); close Deal (rent to client) | remainder to client; rent to client | `DealClosed` | `DealNotFullySettled`, `MissingRecipientAccount` |

**`create_deal` validation (all checked, in this order):**
1. `1 <= milestones.len() <= MAX_MILESTONES`, else `InvalidMilestoneCount`.
2. Each `amount > 0`, else `ZeroAmount`. The total is a `checked_add` fold, else `MathOverflow`.
3. `accept_window_secs`, `review_window_secs`, `vote_window_secs` and every `due_secs` are within `MIN_WINDOW_SECS..=MAX_WINDOW_SECS`, else `WindowOutOfBounds`.
4. Identity: `client != worker`; arbiters pairwise distinct; no arbiter equals client or worker; else `DuplicateParty`.
5. Repo: empty, or exactly one `/`, both halves non-empty, every byte in `[A-Za-z0-9._-]`, at most 80 bytes; else `InvalidRepo`.
6. Proof fields: a milestone with `proof_kind != Off` requires a non-empty repo, a non-zero `proof_attestor`, `proof_kind == PrMerged` and `proof_ref > 0`; `proof_kind == Off` requires `proof_ref == 0`; else `InvalidProofTarget`.
7. Non-zero `proof_ref` values are pairwise distinct within the deal, else `DuplicateProofTarget`.
8. `dispute_deposit` may be zero (disclosed in `LIMITATIONS.md`: objections are then free).

### 3.6 The payout rule (the heart; `settle_milestone.rs`)

A pure function, unit-testable with `cargo test`, first match wins:

```rust
pub struct Payout { pub to_worker: u64, pub to_client: u64, pub outcome: Outcome }

pub fn decide_outcome(deal_status: DealStatus, m: &Milestone, now: i64) -> Result<Payout>
```

| # | Condition | to_worker | to_client | Outcome |
|---|---|---|---|---|
| 1 | status == Settled | error `AlreadySettled` | | |
| 2 | status == Approved | amount + deposit_locked | 0 | WorkerPaid |
| 3a | Disputed, 2 or more votes Worker | amount + deposit_locked | 0 | WorkerPaid |
| 3b | Disputed, 2 or more votes Client | 0 | amount + deposit_locked | ClientRefunded |
| 4 | deal Cancelled | 0 | amount + deposit_locked | Cancelled |
| 5 | Disputed, `now >= vote_deadline` | amount - amount/2 | amount/2 + deposit_locked | Split |
| 6 | Submitted, `now >= review_deadline` | amount | 0 | WorkerPaid |
| 7 | Pending, deal Active, `now >= submit_deadline` | 0 | amount | ClientRefunded |
| otherwise | | error `NothingToSettle` | | |

Why this order: recorded verdicts (an approval, a verified proof, a 2-vote majority) always beat a later cancellation. A mutual cancel only refunds milestones that nobody has decided yet.

All arithmetic uses `checked_add` / `checked_sub`. `to_worker + to_client == amount + deposit_locked` always; assert it with `require_eq!`.

### 3.7 Accounts structs (constraints)

Rules that apply to every struct:
- `deal` is always `Box<Account<'info, Deal>>` with `seeds = [DEAL_SEED, deal.client.as_ref(), &deal.deal_id.to_le_bytes()], bump = deal.bump` (except in `CreateDeal`, where it is initialised).
- Every token and mint account is boxed: `Box<Account<'info, TokenAccount>>`, `Box<Account<'info, Mint>>`. This avoids stack-frame overflows in the generated `try_accounts`.
- `token_program: Program<'info, Token>` (classic SPL Token, from `anchor_spl::token`). Never `init_if_needed`. Never `token_interface`.
- Every `UncheckedAccount` gets a `/// CHECK:` comment saying exactly which constraint protects it.
- Authorization is expressed as constraints, not handler code: `has_one = client @ EscrowError::NotClient` and `has_one = worker @ EscrowError::NotWorker`. Test group G (section 8) is the acceptance test for this list.

Structs:
- **CreateDeal**
  - `client: Signer` (mut, payer).
  - `deal`: `init, payer = client, space = 8 + Deal::INIT_SPACE, seeds = [DEAL_SEED, client.key().as_ref(), &args.deal_id.to_le_bytes()], bump`.
  - `mint: Box<Account<Mint>>`.
  - `vault`: `init, payer = client, seeds = [VAULT_SEED, deal.key().as_ref()], bump, token::mint = mint, token::authority = deal`.
  - `client_token`: `mut, token::mint = mint, token::authority = client`.
  - `token_program`, `system_program`.
- **AcceptDeal:** `worker: Signer`; `deal`: `mut, has_one = worker @ NotWorker`.
- **SubmitWork:** `worker: Signer`; `deal`: `mut, has_one = worker @ NotWorker`.
- **ApproveMilestone:** `client: Signer`; `deal`: `mut, has_one = client @ NotClient`.
- **OpenDispute:**
  - `client: Signer`; `deal`: `mut, has_one = client @ NotClient`.
  - `mint`: `address = deal.mint`.
  - `vault`: `mut, seeds = [VAULT_SEED, deal.key().as_ref()], bump = deal.vault_bump`.
  - `client_token`: `mut, token::mint = mint, token::authority = client`.
  - `token_program`.
- **CastVote:** `judge: Signer`; `deal` (mut). The handler finds `j` with `deal.judges[j] == judge.key()`, else `NotJudge`.
- **SetProofTarget:** `client: Signer`; `deal`: `mut, has_one = client @ NotClient`.
- **SubmitProof:** `submitter: Signer`; `deal` (mut). No other accounts. This is what keeps the interface identical across verification paths.
- **CancelDeal:** `signer: Signer`; `deal` (mut). The handler applies the rules in 3.5.
- **SettleMilestone:**
  - `cranker: Signer`; `deal` (mut).
  - `mint`: `address = deal.mint`.
  - `vault`: `mut, seeds = [VAULT_SEED, deal.key().as_ref()], bump = deal.vault_bump`.
  - `worker_token: Option<Box<Account<TokenAccount>>>` (`mut, token::mint = mint, token::authority = deal.worker`).
  - `client_token: Option<Box<Account<TokenAccount>>>` (`mut, token::mint = mint, token::authority = deal.client`).
  - `token_program`.
  - The handler requires each account only if its payout is greater than 0 (`MissingRecipientAccount`). Constraints on an optional account run whenever it is present.
  - CPI signer seeds: `[DEAL_SEED, deal.client.as_ref(), &deal.deal_id.to_le_bytes(), &[deal.bump]]`, via `CpiContext::new_with_signer(token_program.key(), …)` (Anchor 1.x takes the program's `Pubkey` here, not an `AccountInfo`).
- **CloseDeal:**
  - `cranker: Signer`.
  - `deal`: `mut, close = client`.
  - `client: UncheckedAccount`: `mut, address = deal.client` (receives rent only).
  - `mint`: `address = deal.mint`.
  - `vault`: `mut, seeds = [VAULT_SEED, deal.key().as_ref()], bump = deal.vault_bump`.
  - `client_token: Option<Box<Account<TokenAccount>>>` (`mut, token::mint = mint, token::authority = deal.client`); required only if the vault balance is greater than 0.
  - `token_program`.
  - The handler transfers any remainder, then closes the vault token account with the Deal PDA as signer (destination `client`).

### 3.8 Events and errors

**Events (`events.rs`), all carry `deal: Pubkey`; 12 in total:**
- `DealCreated { client, worker, mint, total, milestone_count }`
- `DealAccepted { accepted_at }`
- `WorkSubmitted { index, deliverable_hash, uri, review_deadline }`
- `MilestoneApproved { index }`
- `DisputeOpened { index, deposit, vote_deadline }`
- `VoteCast { index, judge, side, worker_votes, client_votes, decided }`
- `ProofTargetSet { index, proof_kind, proof_ref }`
- `ProofVerified { index, identifier, submitter }`
- `CancelRequested { by, agree }`
- `DealCancelled {}`
- `MilestoneSettled { index, outcome, to_worker, to_client, cranker }`
- `DealClosed {}`

**Errors (one `#[error_code] enum EscrowError`, each with a plain-English `#[msg]`):**
`InvalidMilestoneCount`, `ZeroAmount`, `WindowOutOfBounds`, `DuplicateParty`, `InvalidRepo`, `InvalidProofTarget`, `DuplicateProofTarget`, `MathOverflow`, `NotClient`, `NotWorker`, `NotJudge`, `NotParty`, `DealNotOpen`, `DealNotActive`, `DealNotCancellable`, `InvalidCancelArgument`, `AcceptWindowClosed`, `InvalidMilestoneIndex`, `InvalidMilestoneStatus`, `SubmitWindowClosed`, `ReviewWindowClosed`, `VoteWindowClosed`, `AlreadyVoted`, `AlreadyDecided`, `UriTooLong`, `ProofTargetAlreadySet`, `NoProofTarget`, `ProofMalformed`, `ProofIdentifierMismatch`, `ProofContextMismatch`, `ProofSignatureInvalid`, `ProofAttestorMismatch`, `AlreadySettled`, `NothingToSettle`, `MissingRecipientAccount`, `DealNotFullySettled`.

The frontend maps errors by name, not number, so the order is not part of the contract.

### 3.9 Proof-binding scheme (`proof/` module)

**What is stored:** `deal.proof_repo` (for example `"nikgeo01/kept-demo"`), `deal.proof_attestor` (20 bytes), plus, per milestone, `proof_kind = PrMerged` and `proof_ref = <PR number>`.

**What "merged" means, and who must own the repo.** The proof says "GitHub reports this pull request as merged". That equals client acceptance only if the client, not the worker, controls merges on `proof_repo`. The program cannot check repository ownership. So:
- The accept screen shows, above the Accept button: "Check that this repository belongs to the client. Merging the pull request is their acceptance, and it releases your payment."
- The client's create screen shows: "Only use a repository where you decide what gets merged."
- Limits to state in `LIMITATIONS.md`:
  - public repositories only (the prover reads them with its own token);
  - a renamed account frees the old name;
  - the client can copy the code without merging, in which case the review timer and the panel apply;
  - binding a PR that is already merged pays immediately, so the UI checks that the PR is open before `create_deal` and `set_proof_target`.

**How the target is agreed:**
- The worker opens a draft PR before the deal is created. The client enters its number. The worker checks it when accepting.
- For later milestones, the client calls `set_proof_target` once the PR exists. It is one-time and immutable, and it can only help the worker.

**What the prover asks the attestor to witness (must be byte-deterministic; exact values pinned from the spike fixture):**
- URL: `https://api.github.com/repos/{proof_repo}/issues/{proof_ref}`, method GET.
- Response match: `{ type: "contains", value: "\"merged_at\": \"2" }`, with the spacing pinned from the fixture **[SPIKE]**. If the spike shows GitHub returning compact JSON here, use the regex `"merged_at":\s*"\d{4}-` instead.
- No `responseRedactions`, no named capture groups, no public headers.
- Context: `contextAddress` is the worker's address (informational; use the zero address if the SDK rejects a Solana address **[SPIKE]**). `contextMessage` is `kept:v1:<64 lowercase hex chars of the Deal PDA>:<milestone index decimal>`.
- The GitHub token goes only in private headers.

**Why the Issues endpoint and `merged_at` (a forgery this closes).** Private request headers are hidden from the attestor and are not part of the signed parameters. With the Pulls endpoint (`/pulls/{n}`), a worker running their own prover could add a private `Accept: application/vnd.github.patch` header. GitHub then returns the raw patch, whose commit message and file contents the worker controls, so a line containing `"merged": true` would satisfy a naive match on an unmerged PR, with an identical identifier. The Issues endpoint always returns JSON regardless of `Accept`. For a pull request it includes `"pull_request": { …, "merged_at": null }` until the merge, and a timestamp string afterwards. Text the worker controls (title, body) is JSON-escaped, so it cannot contain the unescaped needle `"merged_at": "2`. Do not use `/pulls/{n}/merge` (204/404): empty-body handling in zkFetch is unknown.

**On-chain checks in `handle_submit_proof`, in this order:**
1. Deal Active; milestone index valid; status in {Pending, Submitted, Disputed}; no 2-vote majority (`AlreadyDecided`); `proof_kind == PrMerged` (`NoProofTarget`).
2. Shape: `proof.context.len() <= 512`; `proof.owner.len() == 42`, starts with `0x`, and has no uppercase ASCII; else `ProofMalformed`.
3. Build `expected_url` from the stored repo and PR number. Build `expected_parameters = PROOF_PARAMS_BEFORE_URL + expected_url + PROOF_PARAMS_AFTER_URL`. The parameters are not passed in by the caller.
4. `keccak256(PROOF_PROVIDER + "\n" + expected_parameters + "\n" + proof.context) == proof.identifier`, else `ProofIdentifierMismatch`. This single check pins provider, URL, method and the full response-match list.
5. `proof.context` contains the exact substring `"contextMessage":"kept:v1:<deal_hex>:<index>"`, including the surrounding quotes, else `ProofContextMismatch`. Hex is used so no base58 encoding runs on-chain.
6. Signature:
   - `message = "0x" + lowercase_hex(identifier) + "\n" + owner + "\n" + decimal(timestamp_s) + "\n" + decimal(epoch)`.
   - `digest = keccak256("\x19Ethereum Signed Message:\n" + decimal(len(message)) + message)`.
   - `recovery_id = signature[64] - 27` (must be 0 or 1) **[SPIKE: confirm the v convention on the fixture]**.
   - `pubkey = secp256k1_recover(digest, recovery_id, signature[0..64])`, else `ProofSignatureInvalid`.
   - `keccak256(pubkey)[12..32] == deal.proof_attestor`, else `ProofAttestorMismatch`.
7. Set status Approved; emit `ProofVerified`.

**Why the checks are sufficient.** The attestor signs `(identifier, owner, timestamp, epoch)`. Step 4 ties the identifier to our exact URL and match rule. Step 5 ties it to this deal and milestone, so a proof cannot be replayed on another deal or another milestone. JSON escaping means the quoted needle in step 5 cannot be smuggled inside another string value. Step 6 ties it to the attestor both sides accepted. There is no freshness check on purpose: "merged" never becomes false again, and the client picked the PR.

**Crates:** `solana-keccak-hasher = "3"` and `solana-secp256k1-recover = "3"` (both syscall-backed). `anchor_lang::solana_program` in Anchor 1.1.2 re-exports neither. **[SPIKE at first build]** If either fails to resolve against the Anchor 1.1.2 dependency tree, fall back to `sha3 = "0.10"` for keccak (pure Rust, more compute) and ask the booth about the secp crate version.

**Alternative if `parameters` turns out not to be byte-deterministic [SPIKE]:**
- Add `parameters: String` to `ProofArgs` (decide this before the interface freeze; it is a contract change afterwards).
- Require the passed string to equal `BEFORE + expected_url + AFTER`, where only the single volatile span identified by the spike may vary, and that span must match `[A-Za-z0-9-]*`.
- Do not use loose substring checks: a caller-supplied string can hide decoy keys inside nested values while the real top-level `url` points elsewhere.

**No-go path (the attestor service cannot produce any proof):** the same instruction and the same checks. The deal is created with `proof_attestor` set to the address of a secp256k1 key we hold; `scripts/trusted-checker.ts` calls the GitHub API and signs the same claim format. The UI and docs call it "trusted checker (temporary)". Never call it a proof.

**Stretch path:** additionally CPI into Reclaim's deployed verifier `8rYXFrtST4ePpMWcEqhazFyRG2DtCUqgtFmKT7FdjRyp` (EpochConfig `FUmVofehkRN6RG4CT8eeszswuqtDcZbCgVKMCQFLvgfY`, epoch PDA seeds `["reclaim", epoch_config, "epoch", u32le(epoch)]`, accounts `[epoch, epoch_config]`, discriminator `[217,211,191,110,144,13,186,98]`, args `SignedClaim { claim_data: { identifier, owner, timestamp, epoch_index }, signatures }`) through `remaining_accounts`, with both addresses checked. Never use program `rEcL…` or the crates.io `reclaim-solana` 0.1.0 crate.

**Sizes and compute:**
- `submit_proof` transaction: roughly 700 bytes with a 300-byte context and 2 accounts, well under the 1232-byte limit.
- Prepend `ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 })`.
- `settle_milestone` is sent as a separate transaction by default. Both are signed in one wallet prompt with `signAllTransactions` and sent sequentially. (Both fit in one transaction at about 910 bytes; only bundle them if measured.)
- `create_deal` with 5 milestones and an 80-byte repo is about 350 bytes of data and 7 accounts: no size risk.

### 3.10 Invariants (become `docs/INVARIANTS.md`; each maps to a test in section 8)

- **I1** The vault only ever pays token accounts owned by `deal.client` or `deal.worker`. No instruction takes any other recipient.
- **I2** Arbiters, crankers, the proof submitter and the program author receive nothing from any instruction.
- **I3** Each milestone is settled exactly once. `to_worker + to_client == amount + deposit_locked`.
- **I4** At all times, vault balance >= sum of unsettled milestone amounts + sum of locked deposits.
- **I5** Every non-terminal state has an exit that requires no cooperation from an absent party (see 3.12).
- **I6** After `create_deal`, no term can be changed, with two exceptions: `set_proof_target` (one-time, client-only, only adds a release path for the worker) and mutual cancel (both parties agreeing at the same time; either can withdraw until the other agrees).
- **I7** A proof is accepted only for the exact repo, PR and response rule stored in the Deal, only if its signed context names this deal and milestone, and only if signed by the attestor stored in the Deal.
- **I8** The program has no admin instruction, no fee, no pause, and no global mutable account.
- **I9** Only classic SPL Token mints are accepted.
- **I10** A recipient's missing or hostile token account can never block the other party's payout.
- **I11** A recorded verdict (approval, verified proof, or a 2-vote majority) cannot be undone by a later cancellation.

### 3.11 Permission matrix

| Operation | Client | Worker | Arbiter | Anyone | Author before `--final` | Author after `--final` |
|---|---|---|---|---|---|---|
| Create and fund deal | yes | | | | | |
| Accept | | yes | | | | |
| Submit work | | yes | | | | |
| Approve (or concede a dispute) | yes | | | | | |
| Object (with deposit) | yes | | | | | |
| Vote | | | yes (own slot, once) | | | |
| Bind PR to milestone | yes (once) | | | | | |
| Submit proof | yes | yes | yes | yes | | |
| Cancel before acceptance | yes | | | after accept deadline | | |
| Cancel after acceptance | needs both | needs both | | | | |
| Withdraw own cancel request | yes | yes | | | | |
| Trigger payout (settle) | yes | yes | yes | yes | | |
| Close and return rent | yes | yes | yes | yes | | |
| Receive escrowed funds | per rule | per rule | never | never | never (by program rules) | never |
| Replace program code | | | | | **yes (backdoor)** | **no** |
| Change IDL metadata | | | | | yes (cosmetic) | yes (cosmetic, no effect on funds) |

Outside our program:
- The attestor named in a deal can sign a false claim for that deal's proof milestones (and only those).
- GitHub is the fact source for proof milestones.
- A token issuer with freeze authority can freeze accounts (not applicable to tUSDC, which is created with no freeze authority).

### 3.12 "A party disappears" table

| State | Who vanished | Where the funds are | Who recovers, how, when |
|---|---|---|---|
| Deal Open | Worker | Vault | Client calls `cancel_deal(true)` any time, then `settle_milestone` each: full refund. |
| Deal Open | Client | Vault | After `accept_deadline`, anyone calls `cancel_deal(true)` + `settle`: refund lands in the client's token account. Or the worker accepts and proceeds. |
| Milestone Pending | Worker | Vault | After `submit_deadline`, anyone settles: client refunded. |
| Milestone Pending | Client | Vault | Worker submits; then see next row. |
| Submitted | Client | Vault | After `review_deadline`, anyone settles: worker paid in full (silence pays). |
| Submitted | Worker | Vault | Client approves or objects normally. If the client also does nothing, anyone settles to the worker's token account (anyone may create that account). |
| Disputed | One, two or all arbiters | Vault (amount + deposit) | After `vote_deadline` with no majority, anyone settles: 50/50, deposit back to the client. Two remaining arbiters can still decide. |
| Disputed | Client or worker | Vault | Arbiters decide, or the timeout split applies. Before a majority, a valid proof also resolves it for the worker. |
| Approved or decided by 2 votes, not yet paid | Anyone | Vault | Anyone settles; funds go to the winner. A later cancel cannot change this. |
| Cancel requested by one side | Other side | Vault | A one-sided request stays pending until withdrawn; it takes effect only at the moment the other side agrees. All normal rules continue meanwhile. |
| All settled | Everyone | Nothing in vault | Anyone calls `close_deal`; rent returns to the client. |
| Any | Frontend, prover, bot, authors | Unchanged | Any party calls the program directly (scripts in `scripts/`). |
| Any | Recipient's token account closed or reassigned | Vault | Anyone creates a new token account owned by that recipient and settles. |
| Proof milestone | Attestor or GitHub down | Vault | The proof path is unavailable; all non-proof paths still work. |

Not recoverable by design: a party who loses their own wallet key still receives funds into their own account. We cannot recover their key.

---

## 4. Frontend specification (`app/`)

### 4.1 Routes

| Route | Purpose |
|---|---|
| `/` | Landing: one-sentence pitch, "who this is for", Connect wallet, "Get test dollars", link to "How it works and limits". |
| `/deals` | My deals, tabs: "I am paying", "I am working", "I am an arbiter". |
| `/new` | Create-deal wizard (3 steps: people, milestones and timers, review and lock funds). |
| `/deal/:address` | Deal detail: terms, milestone cards, role-aware actions, countdowns, receipts. |
| `/how` | Rules in plain language, the payout table, honest limits, program address and upgrade-authority status with explorer link. |
| `/demo` | Only when `VITE_DEMO_MODE=true`: role switcher explanation, actor balances, links to pre-seeded deals. |

### 4.2 Components

- `ActorProvider`, `useActor()`: active signer (wallet or demo key).
- `RoleSwitcher`: header dropdown in demo mode, coloured badge per role.
- `useProgram()`: Anchor `Program` from the IDL and active signer.
- `useChainTime()`.
- `useDeal(address)`, `useMyDeals()`.
- `DealCard`, `MilestoneCard`, `ActionBar`, `Countdown`, `VoteTally`.
- `TxToast`: pending, confirmed, failed, with explorer link.
- `ReceiptLink`, `FaucetButton`, `ProofPanel`, `ErrorBanner`.

Pure logic:
- `client/rules.ts`: a TypeScript mirror of `decide_outcome`, no imports, shared with the crank script. Imported in the app as `@client/rules`.
- `client/pdas.ts` (shared, `@client/pdas`), `app/src/lib/tx.ts` (build, send, confirm).
- `app/src/lib/errors.ts`, `app/src/lib/format.ts`.

### 4.3 Per-role views on a milestone card

| Milestone state | Client sees | Worker sees | Arbiter sees | Anyone sees |
|---|---|---|---|---|
| Deal Open | "Waiting for the freelancer to accept" + Cancel | Terms summary + "Accept this deal" (lists arbiters, timers, deposit, PR targets; if a repository is set: "Check that this repository belongs to the client. Merging the pull request is their acceptance, and it releases your payment.") | Read-only | After the accept deadline: "Cancel and refund the client" |
| Pending | "Waiting for delivery, due in …" + (if repo set and no PR bound) "Link a pull request" | "Deliver work" (paste link; app hashes it) | | After deadline: "Return payment to client" |
| Submitted, window open | "Approve and pay" / "Raise an objection (locks N tUSDC; you lose it if the panel sides with the freelancer)" + countdown | "If the client says nothing, you are paid in mm:ss" | | |
| Submitted, window over | Same as anyone | "Collect payment" | "Release payment" | **"The review time is over. Anyone can release this payment." [Release payment]** |
| Disputed | Vote tally, countdown, "Concede and pay the freelancer (you lose the deposit)" | Vote tally, countdown | "Side with freelancer" / "Side with client" (own slot only) | After a majority: "Send payout". After the deadline with no majority: "Split 50/50" |
| Proof-bound, PR not merged | "Merging PR #N is your acceptance. It releases this payment." | Same + link to PR | | |
| Proof-bound | | "Prove with GitHub and get paid" | | Same button (anyone) |
| Approved | "Payment approved" + "Send payout" | "Collect payment" | | "Send payout" |
| Settled | Outcome sentence + receipt | Outcome sentence + receipt | | |
| Deal Active, own cancel request pending | Persistent banner: "You have asked to cancel this deal. It is cancelled only if the freelancer agrees." [Withdraw request] | Same banner, mirrored wording | | |
| Deal Active, other side asked to cancel | Banner: "The freelancer asked to cancel. Undecided milestones would be refunded to you." [Agree] | Banner: "The client asked to cancel. Undecided milestones would be refunded to the client." [Agree] | | |

Before `create_deal` and `set_proof_target`, the app calls the public GitHub API and refuses to bind a pull request that is not open (an already-merged PR would pay out immediately).

### 4.4 The "intermediary disappears" moment, and the encore (highest UX priority)

The silent-client release is **the** single moment the demo, the video and slide 5 are built around. The proof release is the encore, and it is the first thing cut if time runs out.

1. **Silent-client release (the moment).**
   - A large live countdown runs on chain time.
   - At zero (plus a 3-second safety buffer) the card changes colour and shows the "Release payment" button to every viewer, including the Passer-by role.
   - After confirmation: a banner reads "Paid by rule. No one approved this. Transaction signed by a stranger: <short address>". The receipt link opens the explorer, showing the token transfer from the vault to the worker.
2. **Proof release (the encore).**
   - `ProofPanel` shows three steps with live status:
     1. "Asking GitHub (witnessed by an independent attestor)"
     2. "Verifying the proof on Solana"
     3. "Paying the freelancer"
   - Each step gets its own receipt link.
   - Fixed footnote: "The proof helper is just a convenience. The Solana program checks the proof itself and rejects one that does not match this deal."
   - In demo mode the panel also has "Use saved proof" (a file input that loads a `ProofArgs` JSON), so the flow works in the UI when the prover or the attestor is unreachable.
   - The request timeout is set from the latency measured in the spike (WP-01), with a visible "still working" state.

### 4.5 Data and transactions

**Fetching lists:**
- One call: `connection.getProgramAccounts(programId, { filters: [{ dataSize: 843 }] })`, then filter by role in JavaScript. This is one request instead of five, which matters on a free RPC tier. Refetch lists every 15 seconds.
- The fixed offsets (8 client, 40 worker, 72 / 104 / 136 arbiters) allow switching to `memcmp` filters later if the number of deals grows.
- Decode each account with `program.coder.accounts.decode("deal", data)` inside try/catch. Skip failures.

**Live updates:**
- `connection.onAccountChange(dealAddress)` invalidates the react-query cache.
- Plus `refetchInterval: 5000` as fallback.

**Chain time:**
- Every 10 seconds, read the Clock sysvar account (`SYSVAR_CLOCK_PUBKEY`) and decode the `i64` at byte offset 32. This is exactly the value the program sees. (`getBlockTime(getSlot())` fails intermittently for fresh slots; do not use it.)
- Store `offset = chainTime - Date.now()/1000`.
- Countdowns use `Date.now()/1000 + offset`.
- Crank buttons enable at `deadline + 3`.

**Transaction pipeline (`tx.ts`):**
1. Build instructions with `.instruction()`.
2. Prepend idempotent ATA creation for any recipient with non-zero payout whose ATA is missing.
3. Fetch a recent blockhash.
4. Sign with the active actor.
5. `sendRawTransaction`.
6. `confirmTransaction` at `confirmed`.
7. Toast with `https://explorer.solana.com/tx/<sig>?cluster=devnet`.

**Bundling:**
- `[approve, settle]`.
- `[cast_vote, settle]` only when `rules.ts` says this vote creates a majority.
- "Withdraw all": N settle instructions in one transaction.
- Open-deal cancel: `[cancel_deal(true), settle × N, close_deal]` in one transaction.

**Settle accounts:** pass `workerToken` / `clientToken` as the party's ATA when that side's payout is greater than 0, else `null`.

**Enums** decode as objects (`{ submitted: {} }`). Normalise them in one place (`format.ts`).

### 4.6 Error mapping (`errors.ts`)

- Anchor error name mapped to plain copy. Examples:
  - `ReviewWindowClosed`: "The review time is over. You can no longer object."
  - `NothingToSettle`: "Nothing to pay out yet."
- Wallet rejection: "You cancelled the request."
- Insufficient SOL: "This wallet needs a little test SOL for network fees."
- Insufficient tokens: "Not enough test dollars. Use Get test dollars."
- Blockhash expired or timeout: "The network was slow. Check the receipt link before retrying."
- Unknown: show the raw message in a collapsible "Details".

### 4.7 Faucet, demo mode, environment

**`FaucetButton`:** one transaction, fee paid by the user and co-signed by the embedded faucet keypair: idempotent ATA creation + `mintTo` of 1,000 tUSDC.

**`app/.env.example`:**
- `VITE_RPC_URL`
- `VITE_CLUSTER=devnet`
- `VITE_PROGRAM_ID`
- `VITE_TUSDC_MINT`
- `VITE_FAUCET_SECRET` (throwaway)
- `VITE_PROVER_URL` (default `http://localhost:8787`)
- `VITE_DEFAULT_ATTESTOR` (default `0x244897572368eadf65bfbc5aec98d8e5443a9072`)
- `VITE_DEMO_MODE`
- `VITE_DEMO_ACTORS` (JSON of labelled secret keys, written by `scripts/demo-setup.ts`: the pitch set into `app/.env.local`, the hosted set into `.demo/hosted.env` for pasting into the hosting provider)

A permanent header chip shows "Devnet: test money only".

---

## 5. Repository layout, standards, process

### 5.1 Tree

```
.
├── Dockerfile  .devcontainer/             # copied together from the organizers' repo (Codespaces fallback and CI image)
├── .github/workflows/ci.yml
├── .githooks/commit-msg                   # rejects AI attribution in commit messages
├── .gitignore  .gitattributes  .prettierrc  .editorconfig  rustfmt.toml  rust-toolchain.toml
├── CONTRIBUTING.md                        # working rules for everyone, human or agent (5.2 to 5.5 condensed)
├── README.md
├── Anchor.toml  Cargo.toml  package.json  tsconfig.json
├── programs/milestone_escrow/
│   ├── Cargo.toml
│   └── src/
│       ├── lib.rs                         # declare_id!, #[program] with 11 thin entrypoints
│       ├── constants.rs  error.rs  events.rs  state.rs
│       ├── instructions.rs                # pub mod + re-exports
│       ├── instructions/
│       │   ├── create_deal.rs  accept_deal.rs  submit_work.rs  approve_milestone.rs
│       │   ├── open_dispute.rs  cast_vote.rs  set_proof_target.rs  submit_proof.rs
│       │   ├── cancel_deal.rs  settle_milestone.rs  close_deal.rs
│       └── proof/
│           ├── mod.rs                     # expected_url, expected_parameters, binding needle, claim identifier
│           ├── verify.rs                  # signed message, eth-style digest, secp256k1 recover, address compare
│           └── generated.rs               # PROOF_PARAMS_* constants, written by scripts/gen-proof-constants.ts
├── tests/
│   ├── helpers.ts                         # actors, mint, createDeal fixture, timeTravel, assertions
│   ├── 01-core.test.ts  02-timers.test.ts  03-dispute.test.ts
│   ├── 04-cancel-close.test.ts  05-authz.test.ts  06-proof.test.ts
├── client/                                # shared by tests, scripts, prover and (via alias) the app
│   ├── pdas.ts  rules.ts  program.ts  ix.ts  proof.ts
├── idl/milestone_escrow.json  idl/milestone_escrow.ts     # committed, generated by Dev A only
├── fixtures/proof-pr-merged.json          # real proof from the spike (no secrets)
├── scripts/
│   ├── reclaim-spike.ts  create-test-mint.ts  demo-setup.ts  seed-deals.ts
│   ├── crank.ts  prove.ts  trusted-checker.ts            # Dev B
│   ├── idl-sync.ts  gen-proof-constants.ts  e2e-devnet.ts  devnet-smoke.ts   # Dev A
├── prover/server.ts                       # stateless HTTP wrapper around client/proof.ts
├── app/                                   # separate npm project (Vite)
│   ├── .env.example  package.json  vite.config.ts  index.html
│   └── src/{main.tsx, App.tsx, idl/, lib/, hooks/, components/, pages/}
├── docs/
│   ├── DESIGN_RATIONALE.md  INVARIANTS.md  LIMITATIONS.md  PERMISSIONS.md
│   ├── DEMO_SCRIPT.md  JUDGE_QA.md  INTERFACE.md  DEPLOY.md  PROOF_SPIKE.md
│   └── submission/{description.md, slides-outline.md, video-shotlist.md, screenshots/}
└── .env.example                           # RPC_URL, RECLAIM_APP_ID, RECLAIM_APP_SECRET, GITHUB_PAT, ...
```

### 5.2 Coding standards

**Rust:**
- One instruction per file: `#[derive(Accounts)] struct` plus `pub fn handle_<name>(ctx, …) -> Result<()>`. `lib.rs` only delegates.
- Checked math only (`checked_add().ok_or(EscrowError::MathOverflow)?`). `overflow-checks = true` in the workspace release profile.
- `require!`, `require_keys_eq!`, `require_eq!` with a specific `EscrowError`. Never `unwrap()` or `expect()` in program code.
- Checks, then effects, then interactions. Mutate state before CPIs. Reload nothing after.
- One event per state change.
- Every `UncheckedAccount` has a `/// CHECK:` comment.
- Comments: a doc comment on every handler stating who may call it and what it guarantees, in plain language (judges will read these). Inline comments only where the reason is non-obvious.
- `cargo fmt --all` and `cargo clippy --all-targets -- -D warnings` clean.

**TypeScript:**
- `strict` mode, no `any` except at decode boundaries.
- ESLint + Prettier (2 spaces, semicolons, double quotes).
- `BN` from `bn.js`.
- Amounts are `bigint` or `BN` in logic, formatted only in `format.ts`.
- No secrets in code; all config via environment.
- Functions that build transactions never send them. Sending lives in `tx.ts`.

### 5.3 Git rules (for humans and all AI agents)

- **Commits must not contain any AI or Claude attribution: no `Co-Authored-By` lines, no "Generated with" footers, in commit messages, PR descriptions or the HackTribe submission text.** This is the first rule in `CONTRIBUTING.md`, and it is enforced, because agent tools add these lines by default:
  - `.githooks/commit-msg` rejects any message matching (case-insensitive) `co-authored-by|generated with|claude|anthropic|🤖`. Each dev runs `git config core.hooksPath .githooks` once after cloning (part of WP-00 and WP-02).
  - CI (checkout with `fetch-depth: 0`) fails if `git log --format=%B HEAD` matches the same pattern.
  - The tracked rules file is `CONTRIBUTING.md`. Each dev keeps a local, untracked `CLAUDE.md` containing one line ("Follow CONTRIBUTING.md"), listed with `.claude/` and `.agents/` in `.git/info/exclude`, so no agent-specific file appears in the public repo.
  - This plan is committed as `docs/PLAN.md` (Nikola's decision), so both devs and their agents read the same text. The frozen specification lives in `docs/INTERFACE.md` (a copy of section 3) from P1 on. Note that the plan text mentions AI agents; if you prefer that not to be visible to the jury, delete `docs/PLAN.md` in the final commit before submission.
- Conventional commits: `feat(program): …`, `fix(app): …`, `test(program): …`, `docs: …`, `chore(ci): …`. Scopes: `program`, `app`, `prover`, `scripts`, `client`, `docs`, `ci`.
- One short-lived branch per dev per phase (5.3a), merged to `main` at every phase exit and checkpoint (5.3a). Never force-push `main`. Nobody commits directly to `main` after commit 0, except merges.
- Agents never run `git push`, `anchor deploy`, or `solana program set-upgrade-authority` unless the human explicitly asks in that session.

**Directory ownership (the conflict-avoidance contract):**

| Owner | Directories |
|---|---|
| Dev A (Nikola) | `programs/`, `tests/`, `idl/`, `app/src/idl/` (generated), `client/pdas.ts`, `client/rules.ts`, `client/program.ts`, `client/ix.ts`, `scripts/idl-sync.ts`, `scripts/gen-proof-constants.ts`, `scripts/e2e-devnet.ts`, `scripts/devnet-smoke.ts`, `Anchor.toml`, `Cargo.toml`, `Dockerfile`, `.devcontainer/`, `.githooks/`, `.github/`, `docs/INVARIANTS.md`, `docs/PERMISSIONS.md`, `docs/INTERFACE.md`, `docs/DEPLOY.md` |
| Dev B | `app/` (except `app/src/idl/`), `prover/`, all other files in `scripts/`, `client/proof.ts`, `fixtures/`, `docs/PROOF_SPIKE.md`, `docs/DEMO_SCRIPT.md`, `docs/DESIGN_RATIONALE.md`, `docs/submission/` (in P7 Dev A edits `description.md` and `slides-outline.md` there) |
| Shared, edit only by announcing in chat first | `README.md`, root `package.json`, `.env.example`, `docs/LIMITATIONS.md`, `docs/JUDGE_QA.md`, `CONTRIBUTING.md` |

### 5.3a Starting in parallel without interfering (branches)

**Commit 0, on `main`, before anyone branches (done once, by Dev A):**
- `docs/PLAN.md` (this plan), `CONTRIBUTING.md` (the rules in 5.2, 5.3, 5.5 and the section 7 preamble), `.githooks/commit-msg`, `.gitignore` (5.5).
- No code. Push it. Dev B pulls it. Both run `git config core.hooksPath .githooks`.

**Why the two paths cannot collide:**
- Each dev owns disjoint directories (table in 5.3). Dev A never edits `app/` (except the generated `app/src/idl/`); Dev B never edits `programs/`, `tests/` or `idl/`.
- The only thing Dev B consumes from Dev A is the IDL, which arrives on `main` at fixed moments (18:00 tag, CP1, CP2).
- The few shared files (`README.md`, root `package.json`, `.env.example`) are edited only after a one-line message to the other dev.
- `app/` is its own npm project, so Dev B can scaffold it before Dev A's root workspace exists.

**Branches (one per dev per phase):**

| Phase | Dev A branch | Dev B branch | Merge to `main` |
|---|---|---|---|
| P0 | `a/p0-bootstrap` | `b/p0-app-scaffold` | A by 15:30; B at 16:00 |
| P1 | `a/p1-interface` | `b/p1-actors-faucet` | Both at 18:00; A tags `interface-v1` |
| P2a | `a/p2-core` | `b/p2-core-ui` | Both at CP1 (20:45) |
| P2b | `a/p2-cancel-close` | `b/p2-release-moment` | Both at 22:45 |
| P3 | `a/p3-disputes` | `b/p3-dispute-ui` | Both at CP2 (by 01:15) |
| P4 (conditional) | `a/p4-proof` | `b/p4-prover` | Only if working by 01:30 |
| P6–P7 | `a/p6-release` | `b/p7-submission` | Final merge, tag `v1.0.0` |

**The routine at each merge point (each dev, own branch):**
```
git fetch origin
git rebase origin/main          # your directories are disjoint, so this is normally clean
git push -u origin <branch>
git checkout main && git pull --ff-only
git merge --no-ff <branch> -m "feat(<scope>): <phase summary>"
git push origin main
git checkout -b <next branch>
```
- Merge order at a shared checkpoint: Dev A first (the IDL lands), then Dev B rebases and merges.
- Between merge points, Dev B may pull `main` into their branch at any time to pick up a new IDL; Dev A never needs anything from Dev B's branch.
- If a rebase conflicts, it is in a shared file. Resolve it together; do not let an agent resolve it alone.
- Agents work only on the current branch of the dev who started them and never switch branches, merge or push.

### 5.4 CI (`.github/workflows/ci.yml`)

- Job `program`: `docker build --target toolchain -t kept-ci .` from the repo's `Dockerfile` (the bare `quay.io/ottersec/anchor:v1.1.2` image has no Surfpool), then inside that image: `cargo fmt --all -- --check`, `cargo clippy --all-targets -- -D warnings`, `anchor build`, `cargo test`, `anchor test`.
  - Keep the template's `unexpected_cfgs` lint configuration in `Cargo.toml`, or clippy fails on Anchor macro warnings.
  - If Surfpool is flaky in CI, mark only the `anchor test` step `continue-on-error: true` and note it in the README.
- Job `attribution`: the `git log` check from 5.3.
- CI is a convenience, not an MVP gate. The challenge does not grade test coverage, so if CI costs more than 30 minutes in P0, reduce it to fmt + build + the attribution check and move on.
- Job `app`: `npm ci`, `npx tsc --noEmit`, `npx eslint .`, `npm run build` in `app/`.
- Keep job names stable. The `program` check-run on a commit is the natural target for the Stretch "CI passed" condition and for a slide showing objective conditions.

### 5.5 Secrets and keys

- Never committed: `RECLAIM_APP_SECRET`, `GITHUB_PAT` (fine-grained, read-only, public repos), Helius key in root `.env`, `~/.config/solana/id.json`, `target/deploy/*-keypair.json`, `.demo/`.
- `.gitignore` includes: `target/`, `node_modules/`, `.anchor/`, `test-ledger/`, `.env`, `.env.local`, `.demo/`, `*-keypair.json`, `keys/`, `dist/`.
- **Demo keypairs policy:** generated locally by `scripts/demo-setup.ts` into `.demo/actors.json` (gitignored). There are two sets (ADR-10): the pitch set is injected only into `app/.env.local` on the pitch laptop; the hosted set goes into the hosting provider's environment for the public demo build and is public by nature once bundled, which the UI states.
- **Critical keys:** the deployer wallet (it is the upgrade authority until `--final`) and the program keypair. Dev A copies both to Dev B over a private channel (AirDrop or a password manager) right after the first deploy. Never through git or chat services that log.

---

## 6. Phases and timeline (Sat Oct 3, about 14:15, to Sun Oct 4, 11:00)

**Deadline correction (confirmed by Nikola):** work started at 11:00 on October 3rd and the submission closes at **11:00 on October 4th**, not 23:00. That leaves about 21 hours from now, so the schedule is compressed and the tiers move:
- The core escrow, silence-pays, the arbiter panel and the submission package fit and are the plan of record.
- The proof layer (zkTLS release) becomes **conditional**: it is built only if MVP-1 is on devnet by 23:30 on Saturday. Otherwise it is presented as designed-and-specified roadmap (section 3.9 stays in the docs, and the interface keeps the fields so nothing has to change later).
- The e2e devnet script, exhaustive authorization tests and CI beyond fmt + build are Stretch.

| Phase | Clock | Dev A | Dev B | Exit condition |
|---|---|---|---|---|
| Start | Sat ~14:00 | Commit 0 on `main` (plan, rules, hook, `.gitignore`), then both branch (5.3a) | | Both have pulled commit 0 |
| P0 | 14:15–16:00 | Toolchain, bootstrap from the organizers' template, hello-world deploy | Frontend scaffold first (needs only Node); toolchain install in the background; own hello-world; optional 45-minute proof spike outside the repo | A's bootstrap merged to `main` by 15:30 |
| P1 | 16:00–18:00 | Vertical slice on localnet, then full skeleton, IDL, devnet deploy | ActorProvider, test mint, faucet, minimal demo-setup, docs skeleton | Tag `interface-v1` at 18:00 |
| P2a | 18:00–20:45 | Core instructions + timer tests | Wizard, deal page, core actions | **CP1 on devnet at 20:45** (S1, S2, S5); contract-change window 1 |
| P2b | 20:45–22:45 | Cancel, close, tests | Silent-release moment, first hosted deploy | Backup recording of S1 + S2 at 22:30 (**MVP-0 reached**) |
| P3 | 22:45–01:30 | Disputes + tests; contract-change window 2 at 22:45 | Dispute UI, arbiter tab, crank script | **CP2 by 01:15** (**MVP-1**); feature freeze at 01:30 |
| P4 (conditional) | inside P3, only if CP2 is reached by 23:30 | On-chain proof verification + tests | Prover, ProofPanel, demo repo | Hard cut at 01:30 |
| Sleep | Sun 01:30–06:00 | | | Mandatory. No agent runs unattended. |
| P6 | Sun 06:00–07:15 | Final deploy, gates, `--final` decision; invariants, permissions and limitations docs | Demo setup and seeding, two dry runs, full backup recording | Tag `v1.0.0` |
| P7 | 07:15–10:00 | Description, README, slides | Video, screenshots | Draft submitted by 08:00; final by 10:00 |
| Buffer | 10:00–11:00 | Submission fixes only | Pitch rehearsal | No code changes after 09:00 |
| P8 | After submission | Pitch and Q&A rehearsal | | |

**Critical path:** Dev A's toolchain → vertical slice → IDL → CP1. Dev B is blocked on Dev A only at 18:00 (the IDL) and 20:45 (CP1). Everything else runs in parallel.

**If you fall behind:** the order of cuts is proof layer → `close_deal` polish and "Withdraw all" → hosted deploy (demo from the laptop) → mutual cancel after acceptance. Never cut: create, accept, deliver, approve, silence-pays release, the arbiter vote, the README and the submission.

**Contract-change windows.** The interface is frozen at `interface-v1`. It may change only at two scheduled moments: at CP1 (20:45) and at the start of P3 (22:45). A change needs a message to the other dev, a version bump in `docs/INTERFACE.md`, and an IDL re-sync by Dev A. Handler bodies may change at any time.

### P0 Environment, hello-world (14:15–16:00)

- **First five minutes, both:**
  - Ask at the Superteam booth for devnet SOL and whether HackTribe allows editing a submission (Q2).
  - Request devnet SOL at faucet.solana.com (GitHub login raises the limit).
  - Confirm the repo is public.
- **Dev A:** WP-00 (toolchain + repo bootstrap + CI), merged to `main` by 15:30, then WP-02 (wallet, SOL, hello-world deploy).
- **Dev B:** WP-11 steps 1 to 3 in `app/` (needs only Node), with the toolchain install running in the background; then WP-02 on their own machine. Optional: WP-01 (proof spike), 45 minutes at most, in a scratch directory outside the repo.
- **SOL plan:** pool SOL into Dev A's deployer wallet. A deploy transiently needs about twice the program's rent (roughly 4 to 5.7 SOL for a 300 to 400 KB program) because of the temporary buffer. Make a second faucet request before sleeping.
- **Deliverables:**
  - `anchor build` + `anchor test` green on the template on Dev A's machine (or Codespaces). Dev B needs the toolchain only for their hello-world; if it costs more than 30 minutes, Dev B skips it and stays on the frontend.
  - The template deployed to devnet by Dev A, with the explorer link pasted in chat.
- **Proof decision:** the proof layer is attempted only if the spike succeeded (WP-01 acceptance) **and** CP2 is reached by 23:30. If the spike was skipped or failed, the proof layer is roadmap.
- **Verification:** `rustc --version; solana --version; anchor --version; surfpool --version; solana balance -u devnet; solana program show <id> -u devnet`.
- **Risk and cut-line:** the 30-minute native-install timebox (ADR-01). If Dev A has no green build by 15:30, go to the booth.

### P1 Vertical slice, then interface freeze (16:00–18:00)

- **Dev A, WP-10:**
  1. Vertical slice first, on localnet, with real handler bodies: `create_deal → accept_deal → submit_work → approve_milestone → settle_milestone` (with `client_token = null`). This exercises account init, the PDA signer, an optional account and enum arguments before anything is frozen.
  2. Then the rest of `state.rs`, `error.rs`, `events.rs`, `constants.rs`, and the remaining instructions with final Accounts structs and argument types, bodies returning `Ok(())`.
  3. Build, run `scripts/idl-sync.ts`, commit the IDL, write `docs/INTERFACE.md`.
  4. Upgrade the devnet program in place.
- **Dev B, WP-11 (rest) and WP-12:** `ActorProvider`, environment config, `create-test-mint.ts`, `FaucetButton`, minimal `demo-setup.ts`, README and docs skeleton from section 0.
- **Definition of done:** tag `interface-v1` on `main`. Dev B's app loads the committed IDL and completes one real `create_deal` on devnet.
- **Decisions that must be made before the tag** (each changes the IDL or `decide_outcome`): Q7 (deposit on a no-majority split) and whether `parameters` must be passed in `ProofArgs` (only known if the spike ran; otherwise keep the specified shape).

### P2a Core (18:00–20:45)

- **Dev A:** WP-20 (finish create, accept, submit, approve, settle; tests for rows 1, 2, 6, 7; test groups A, B, F and V, minus the cases that need later handlers). **CP1 devnet deploy at 20:45.**
- **Dev B:** WP-22 (lists, wizard, deal page, core actions, toasts, countdown), working against the deployed skeleton and then CP1.
- **Definition of done:** tests `01` and `02` green. On devnet through the UI: create, accept, submit, approve + settle.

### P2b Cancel, close, the moment (20:45–22:45)

- **Dev A:** WP-21 (`cancel_deal`, `close_deal`, tests for row 4, test groups D and E minus the Disputed cases). Redeploy.
- **Dev B:** the silent-release moment per 4.4 (using the Passer-by demo actor from the minimal `demo-setup.ts` of WP-11), first hosted deploy, then a screen recording of S1 + S2 on devnet at 22:30.
- **Definition of done (MVP-0):** S1, S2 and S5 work on devnet through the UI with explorer receipts; the recording exists on disk. From this point there is always something submittable.
- **Cut-line:** if WP-21 is not done at 22:45, Dev A moves to disputes anyway; cancel after acceptance and `close_deal` return only if time remains.

### P3 Disputes (22:45–01:30)

- **Dev A:** WP-30 (`open_dispute`, `cast_vote`, tests for rows 3a, 3b, 5, test group C, the core of G, and the deferred Disputed cases of B and D). **CP2 by 01:15.**
- **Dev B:** WP-31 (dispute UI, arbiter tab, role switcher complete with Passer-by, bundled vote + settle, `scripts/crank.ts`).
- **Definition of done (MVP-1):** S1 to S5 clickable through the UI on devnet (S6 and S8 if WP-21 shipped).
- **01:30 feature freeze.** Push everything, then sleep. Nothing new is started on Sunday morning.

### P4 Proof layer (conditional; inside P3, hard cut 01:30)

- **Entry condition:** the spike succeeded and CP2 is on devnet by 23:30.
- **Dev A:** WP-40 (`proof/` module, `submit_proof`, `set_proof_target`, Rust unit tests against the fixture, TS tests signed with a test key).
- **Dev B:** WP-41 (`client/proof.ts`, `scripts/prove.ts`, `prover/server.ts`, `ProofPanel`). Prepare the demo GitHub repo with two open draft PRs.
- **Definition of done:** on devnet, merging a PR and clicking "Prove with GitHub" pays the worker with no payment action by the client. A proof for a different deal, milestone or PR is rejected on-chain.
- **If not entered or not finished:** `submit_proof` and `set_proof_target` stay as stubs that return an error (`NoProofTarget`), the UI hides proof fields, and slide 7 presents the design as the next step. Say so plainly in `LIMITATIONS.md`.

### P6 Final deploy, `--final`, docs (Sun 06:00–07:15)

1. Only fixes for demo-blocking bugs. No new features.
2. Dev A: final `anchor build`, upgrade in place on devnet (procedure in WP-60), IDL re-sync if changed, tag `v1.0.0`.
3. Dev A: `anchor test` green on the tagged commit. Dev B: run `docs/DEMO_SCRIPT.md` twice against the deployed program.
4. **`--final` gates (all must be true):**
   - Local tests green on the exact commit that was deployed.
   - Two full manual dry runs green on devnet.
   - Seeding verified against the deployed binary; full backup recording done.
   - No open contract change request.
   - The deployer wallet holds a rollback reserve of at least twice the program's rent.
   - Both devs say "go".
5. If the gates pass (target 07:00): run `solana program set-upgrade-authority <PROGRAM_ID> --final -u devnet`, then `solana program show <PROGRAM_ID> -u devnet`. Screenshot the output for the slides. Note: a finalized program's rent can never be reclaimed.
6. If any gate fails: do not finalize. The pitch answer becomes "It is still upgradeable, so today you must trust us; this is the one command that removes that, and we did not run it because we found X". This is an acceptable, honest outcome.
7. **Rollback plan if a critical bug is found after finalizing:** generate a new program keypair, run `anchor keys sync`, build, deploy a new ID from the reserve, and update `VITE_PROGRAM_ID`, the IDL and the README. The finalized ID stays in the README as "v1 (immutable)" with the bug described.
8. Dev B: run `demo-setup.ts` and `seed-deals.ts` against the final program. Record the backup screen recording of the full demo (it doubles as raw footage for the video).
9. Dev A, while Dev B records: write `docs/INVARIANTS.md` (3.10, 3.12), `PERMISSIONS.md` (3.11) and `LIMITATIONS.md` from this plan's text.

### Live demo script (the content of `docs/DEMO_SCRIPT.md`; about 4 minutes)

| Step | What the audience sees | Backup if it fails |
|---|---|---|
| 1 | Phantom connects (the client). Create and fund a 2-milestone deal with a 30-second review window. Open the explorer receipt: tokens moved into the vault. | Demo Client actor; pre-seeded D1 |
| 2 | Switch to the Worker. Accept. Deliver milestone 1. | Pre-seeded D2 |
| 3 | **The moment.** The client does nothing. The countdown reaches zero. Switch to the Passer-by, click "Release payment". Explorer: vault → worker, signed by a stranger. Say: "Nobody approved this. The rule paid her." | Pre-seeded D3 (window already expired) |
| 4 | Pre-seeded D4 (objection open, one vote). Switch to the second arbiter, vote; the deal settles in the same transaction. Say: "Arbiters can decide, but the program can only ever pay the client or the worker." | Pre-seeded D5 (split) |
| 5 | Encore, only if the proof layer shipped: pre-seeded D7. Merge the PR on GitHub, click "Prove with GitHub", payment released. | D6 with the saved proof; else skip |
| 6 | Terminal: `solana program show <id>`: no upgrade authority (or the honest statement from P6 step 6). | Screenshot |

If any step breaks live, say plainly what broke and why, switch to the pre-seeded deal, and only then to the recording. The jury rewards this.

### P7 Submission package (Sun 07:15–10:00)

Split: Dev B on video and screenshots, Dev A on description, README and slides, then swap for review. Submit a draft on HackTribe by 08:00 (title, description, repo link) if the platform allows edits (Q2); finalize by 10:00. Phase 1 is judged from the submission alone and needs at least 50 percent of the points, so this phase is not compressible.

**HackTribe fields (from the rules):**
- Project title: "Kept: escrow without the platform".
- Team name (decide in P0; Q8) and the list of team members (1 to 6).
- Project description (from `docs/submission/description.md`, includes the design rationale).
- PDF of at most 10 slides.
- Links: public repo, public video, hosted demo, program on the explorer.
- Screenshots.
- Language: English.
- No AI attribution anywhere in the text.

**Slides (10):**
1. Title, one-liner, target user named.
2. The problem: who goes first; what the platform charges and controls (verified numbers only).
3. The redesign: the three jobs of the intermediary and their replacements (the table from section 0).
4. How it works: state diagram in plain words.
5. The moment the intermediary disappears: screenshot of the stranger-signed release + explorer.
6. Disputes: party-appointed arbiters, deposit, 50/50 fallback; arbiters can never be paid.
7. Proof release: the client's merge is the payment; zkTLS attestation, on-chain verification; what is and is not trusted.
8. Permissions and "what if someone disappears" (condensed tables); upgrade authority status.
9. Honest limits + why blockchain and not a database.
10. Next week, implementation potential, links, team.

**Video shot list (at most 3:00; export under 2:55):**

| Time | Shot |
|---|---|
| 0:00 to 0:20 | Kasia's problem, one sentence; who the intermediary is |
| 0:20 to 0:50 | Client connects Phantom, creates and funds a deal; explorer receipt |
| 0:50 to 1:10 | Worker accepts and delivers |
| 1:10 to 1:40 | Client stays silent; countdown (cut); Passer-by clicks Release; explorer shows vault to worker |
| 1:40 to 2:10 | Objection with deposit; two arbiters vote; settled |
| 2:10 to 2:40 | Client merges the PR on GitHub; "Prove with GitHub"; payment released by proof |
| 2:40 to 2:55 | `solana program show`; limits in one sentence; repo link |

**Video hosting.** The challenge asks for a publicly accessible link, and the Polish text says the film should be in an accessible, open repository. Do both: upload to YouTube as Unlisted (test in a private window), link it at the top of the README, and attach the file to a GitHub release on the repo.

**README outline:**
- What it is, who it is for.
- Design rationale (short) and link to the full version.
- Live links: demo, program on the explorer, video.
- "What is where" table: path mapped to purpose, with the five jury questions each linked to a file and function.
- The rules table (3.6).
- How to run tests.
- How to run the app.
- How to deploy.
- Limits.
- Next steps.

**Definition of done:** submitted on HackTribe by 10:00, one hour before the 11:00 deadline. Repo public (check in a private browser window). All links open logged-out.

### P8 Pitch Q&A (drafted answers, kept in `docs/JUDGE_QA.md`)

- **Where does the intermediary disappear?** `programs/milestone_escrow/src/instructions/settle_milestone.rs`, function `decide_outcome`. It is the only code that can move money out of the vault. It takes no opinion from anyone: just the stored state and the clock. Row 6 is "silence pays"; nobody has to approve. Custody is the vault PDA created in `create_deal.rs`; no private key exists for it.
- **What if a party disappears?** Show the table from 3.12 (`docs/INVARIANTS.md`). Every state has a deadline, after which anyone can trigger the predefined outcome. Funds always sit in the vault and can only go to the client or the worker.
- **Who can do what; can the author change anything?** `docs/PERMISSIONS.md`. There is no admin instruction in `lib.rs`. Before `--final`, the upgrade authority could replace the code. Show `solana program show`. State the attestor's, GitHub's and the token issuer's powers honestly.
- **Why blockchain, not a database?**
  - A database has an operator who can edit a row, freeze an account or disappear with the money. Whoever runs it is the intermediary again, and needs to be trusted, licensed and paid.
  - Here custody belongs to a program whose rules both sides can read before locking money and, once finalized, nobody can change.
  - Settlement is cross-border in seconds for a fraction of a cent.
  - Both parties verify the same state without trusting each other's server.
- **What next with one more week?**
  - Arbiter compensation and an arbiter marketplace.
  - Production-length timer minimums.
  - A fairer no-majority rule and deadline-extension instructions.
  - CI check-run condition bound to client-controlled workflows.
  - Multiple attestors with a threshold, and following attestor rotation.
  - Verifiable build.
  - A mainnet pilot with a real stablecoin.
  - Notifications; a Polish-language UI.

---

## 7. Work-package catalogue for AI agents

Every brief starts with the same preamble (it is the content of `CONTRIBUTING.md`):
- Read `docs/INTERFACE.md` (the frozen copy of section 3) before coding. If the plan and `docs/INTERFACE.md` disagree, `docs/INTERFACE.md` wins and you report the difference.
- Honour directory ownership (5.3). Touch nothing outside your package's file list.
- No AI attribution in commits, PR text or docs.
- Do not change the frozen interface. If you believe it must change, stop and report.
- Do not run `git push`, `anchor deploy`, `solana program …` or anything that spends SOL unless the human asks in that session.
- Run the listed verification commands and report their real output, including failures.
- Anchor 1.x differs from most online examples. Read `.agents/skills/solana-dev/` (copied from the organizers' template) for the 0.32 → 1.x migration notes and the Surfpool cheatcodes before writing program or test code.

| ID | Owner | Phase | Parallel with | Depends on |
|---|---|---|---|---|
| WP-00 Repo bootstrap | A | P0 | WP-01 | none |
| WP-01 Proof spike (optional, 45 min, outside the repo) | B | P0 | WP-00 | none |
| WP-02 Wallet + hello-world deploy | A and B | P0 | | WP-00 |
| WP-10 Vertical slice, skeleton, IDL freeze | A | P1 | WP-11, WP-12 | WP-00; from WP-01 only the `ProofArgs` shape |
| WP-11 Frontend scaffold | B | P1 | WP-10 | WP-00 |
| WP-12 Docs skeleton | B | P1 | WP-10 | none |
| WP-20 Core instructions | A | P2a | WP-22 | WP-10 |
| WP-21 Cancel, close | A | P2b | WP-22 | WP-20 |
| WP-22 Core frontend | B | P2a, P2b | WP-20/21 | WP-10, WP-11 |
| WP-30 Dispute panel | A | P3 | WP-31 | WP-21 |
| WP-31 Dispute and crank frontend + script | B | P3 | WP-30 | WP-22 |
| WP-40 On-chain proof (conditional) | A | P4 | WP-41 | WP-30, WP-01 fixture |
| WP-41 Prover + proof UI (conditional) | B | P4 | WP-40 | WP-01, WP-31 |
| WP-50 Docs hardening (e2e script is Stretch) | A | P6 | WP-51 | CP2 |
| WP-51 Demo environment + polish + hosting | B | P3 slack, P6 | WP-50 | CP2 |
| WP-60 Final deploy and `--final` | A | P6 | WP-61 | WP-50 |
| WP-61 Seeding, dry runs, recording | B | P6 | WP-60 | WP-51 |
| WP-70 Submission package | A and B | P7 | | WP-60/61 |
| WP-80 Stretch | either | if time | | all |

### WP-00 Repo bootstrap (A)
- **Objective:** a buildable Anchor 1.1.2 workspace at the repo root with hooks, lint, CI and working rules.
- **Context:** ADR-01/02/03/12, section 5.
- **Steps:**
  1. Install the toolchain (ADR-01) and pin versions. Start the 30-minute timebox.
  2. Clone the organizers' repo into a scratch directory: `git clone --depth 1 --branch plan https://github.com/matzayonc/solana-live-course-2026`.
  3. Bootstrap from their working template, not from `anchor init`: copy `diamond-hands/` (`Anchor.toml`, workspace `Cargo.toml` with `overflow-checks = true` and the lint config, `rust-toolchain.toml`, `package.json`, `package-lock.json` (required by `npm ci`), `Cargo.lock`, `tsconfig.json`, `.prettierignore`, `programs/`, `tests/`) to the repo root. Do not copy any `.claude/` directory. Rename `tests/diamond-hands.ts`. Check that the copied `Dockerfile` and `devcontainer.json` contain no hard-coded `diamond-hands/` or `scripts/` paths; fix any that remain. Rename the program crate and directory to `milestone_escrow`, update `Anchor.toml`, run `anchor keys sync`.
  4. Copy their `Dockerfile` and `.devcontainer/` together; set `postCreateCommand` to `npm ci && npm --prefix app ci` (use `npm ci` only until `app/` exists).
  5. Copy `diamond-hands/.agents/skills/solana-dev/` to `.agents/skills/solana-dev/` and keep it untracked: add `.agents/`, `.claude/` and `CLAUDE.md` to `.git/info/exclude`. Dev B does the same copy locally.
  6. `.gitignore`, `CONTRIBUTING.md` and `.githooks/commit-msg` already exist from commit 0 (5.3a); extend `.gitignore` if the template needs it. Add `rustfmt.toml`, `.prettierrc`, `.editorconfig`, `.env.example`.
  7. Run `git config core.hooksPath .githooks` if not done yet. Test the hook: a commit message containing "Co-Authored-By" must be rejected.
  8. Add `.github/workflows/ci.yml` (5.4).
- **Acceptance:** `anchor build && anchor test` pass on the template program. The hook rejects an attributed message. No keypair or `.env` is tracked (`git ls-files | grep -Ei 'keypair|\.env$'` prints nothing). CI is green after the human pushes.
- **Do not:** add program logic; choose a different Anchor version; track `CLAUDE.md` or `.claude/`.

### WP-01 Proof spike (B)
- **Objective:** prove the attestation pipeline end to end, confirm the forgery fix, and capture exact constants.
- **Files:** `scripts/reclaim-spike.ts`, `fixtures/proof-pr-merged.json`, `docs/PROOF_SPIKE.md`.
- **Packages:** `@reclaimprotocol/zk-fetch` 1.1.0 (pin exactly; lockfile pins `@reclaimprotocol/attestor-core`), `ethers` for keccak and signature recovery in the script.
- **Steps:**
  1. Create an app at dev.reclaimprotocol.org. Enable zkFetch in the Integration tab. Put `RECLAIM_APP_ID` / `RECLAIM_APP_SECRET` in `.env`.
  2. Create a fine-grained read-only GitHub token (public repositories).
  3. Create the public demo repo with: PR #1 merged; PR #2 open, whose commit message and one file line contain the text `"merged": true` and `"merged_at": "2026`.
  4. Run `zkFetch` on `https://api.github.com/repos/<o>/<r>/issues/1` with:
     - the token in private headers;
     - the response match `{ type: "contains", value: "\"merged_at\": \"2" }`;
     - context `{ contextAddress, contextMessage: "kept:v1:<64 hex>:0" }`;
     - no `useTee`.
  5. Print and record:
     - `claimData.provider`;
     - the exact `claimData.parameters` string;
     - the exact `claimData.context` string and its byte length;
     - identifier, owner, timestampS, epoch;
     - `witnesses[0].id`;
     - the signature length and the value of its last byte;
     - whether `claimData.owner` is lowercase (the attestor signs the lowercased owner);
     - which keys the attestor adds to the signed `context` (for example `extractedParameters`, `providerHash`) and whether it stays within 512 bytes;
     - the wall-clock time the call took.
  6. In the script, recompute `keccak256(provider + "\n" + parameters + "\n" + context)` and assert it equals the identifier.
  7. In the script, rebuild the signed message (3.9 step 6), recover the signer address and assert it equals `witnesses[0].id` and `0x244897572368eadf65bfbc5aec98d8e5443a9072`.
  8. Run it twice and diff `parameters` to test determinism. Identify any volatile span.
  9. **Attack test.** Against open PR #2:
     - old design: `/pulls/2` with a private header `Accept: application/vnd.github.patch` and the match `"merged": true`. Expected: a proof IS produced (this is the forgery).
     - new design: `/issues/2` with the `merged_at` match, once with each private `Accept` value: `application/vnd.github.patch`, `application/vnd.github.diff`, `application/vnd.github.raw+json`, `application/vnd.github.html+json`, `application/vnd.github.full+json`. Expected: NO proof is produced in any case.
     Record both results. If the new design also produces a proof, stop and report: the proof feature must not ship as real acceptance.
  10. Save the fixture. Check it contains no Authorization header or token.
- **Acceptance:** `docs/PROOF_SPIKE.md` states go or no-go and records: the exact `parameters` bytes before and after the URL; the spacing of the `merged_at` needle; whether `contextAddress` accepts a Solana address; the `v` convention of the signature; determinism; latency; and the attack-test results.
- **Do not:** use `useTee`; use the `rEcL…` program or the `reclaim-solana` 0.1.0 crate; commit secrets.

### WP-02 Wallet and hello-world (A and B)
- **Steps:**
  1. `solana-keygen new` (skip if a keypair exists), `solana config set -u devnet`, `git config core.hooksPath .githooks`.
  2. Get SOL from the faucet; `solana balance`.
  3. `anchor build`, then deploy the template program:
     - Dev A: `solana program deploy target/deploy/milestone_escrow.so --program-id target/deploy/milestone_escrow-keypair.json --max-len 450000 -u devnet`. This is the permanent program ID for the whole event. Never close it: a closed program ID can never be deployed to again. (If `--max-len` is rejected by this CLI version, deploy without it and use `solana program extend` later.)
     - Dev B: run `anchor keys sync` locally so the declared ID matches their own keypair, deploy with `anchor deploy --provider.cluster devnet`, then `git checkout -- .` (do not commit the ID change).
  4. Open `https://explorer.solana.com/address/<program id>?cluster=devnet`.
  5. Call the template's instruction once on devnet with a small script (`scripts/devnet-smoke.ts`: load the IDL, build a provider from `~/.config/solana/id.json` and `RPC_URL`, send, print the explorer link). Do not use `anchor test` against devnet; it redeploys and tries to airdrop.
  6. Install Phantom, switch to devnet (Settings → Developer Settings → Testnet Mode → Solana Devnet), import or fund a wallet.
  7. If a deploy fails midway: `solana program show --buffers` then `solana program close --buffers` to recover the SOL.
  8. Dev B (only Dev B) closes their throwaway program afterwards (`solana program close <id>`).
- **Acceptance:** two explorer links. Deployer and program keypairs backed up privately (5.5).

### WP-10 Vertical slice, skeleton and IDL freeze (A)
- **Objective:** the frozen contract of section 3, compiled, with the risky mechanics already proven on localnet.
- **Files:** everything under `programs/milestone_escrow/src/`, `idl/`, `app/src/idl/`, `scripts/idl-sync.ts`, `docs/INTERFACE.md`, `client/pdas.ts`, `client/rules.ts`, `client/program.ts` (builds a typed `Program` from the committed IDL and a provider), `tests/helpers.ts`, `tests/00-slice.test.ts`.
- **Steps:**
  1. Implement state, enums, constants, errors, events and argument structs exactly as in 3.1 to 3.3 and 3.8.
  2. Implement all Accounts structs exactly as in 3.7.
  3. Implement real bodies for `create_deal`, `accept_deal`, `submit_work`, `approve_milestone` and `settle_milestone`. `decide_outcome` is implemented in full now (all rows of 3.6; it is a pure function) with Rust unit tests for every row, together with its mirror `client/rules.ts`, because Dev B's release button, vote bundling and crank script depend on it. All other handlers return `Ok(())`.
  4. `tests/00-slice.test.ts`: create → accept → submit → approve → settle with `clientToken: null`; assert the worker's balance and the vault balance.
  5. If optional accounts or enum arguments do not work within 20 minutes, apply the ADR-06 fallback now and record it in `docs/INTERFACE.md`.
  6. Add the Rust unit test for header offsets and `8 + Deal::INIT_SPACE == 843`.
  6a. Prove the crypto crates now, not in P4: add `solana-keccak-hasher = "3"` and `solana-secp256k1-recover = "3"` to the program's `Cargo.toml` and a `proof/verify.rs` with a compiling `recover_attestor` and one `cargo test` (sign with a known key, recover the address). If either crate fails to resolve, apply the 3.9 fallback now.
  7. `anchor build`; `scripts/idl-sync.ts` copies `target/idl/milestone_escrow.json` and `target/types/milestone_escrow.ts` into `idl/` and `app/src/idl/`.
  8. Write `docs/INTERFACE.md` (section 3 verbatim, version 1).
  9. Human step: upgrade in place with `anchor deploy --provider.cluster devnet` (the program ID already exists from WP-02). If it reports insufficient space, run `solana program extend <id> <bytes> -u devnet` and retry. Record the result in `docs/DEPLOY.md`.
  10. Human step: tag `interface-v1`.
- **Acceptance:** `anchor build` clean; `00-slice` green; the IDL lists 11 instructions, 12 events and all errors; the offsets test passes.
- **Do not:** add any admin or config instruction; use `init_if_needed`; use `token_interface`; write explicit enum discriminants.

### WP-11 Frontend scaffold (B)
- **Files:** `app/**`, `scripts/create-test-mint.ts`.
- **Steps:**
  1. `npx create-solana-dapp@4.8.5 app -t web3js-react-vite-tailwind-counter`, then delete `app/anchor/` and the counter feature.
  2. Add `HashRouter` routes with placeholder pages (4.1).
  3. Add the `@client` alias in `vite.config.ts` and `tsconfig.json` (ADR-12).
  4. Build `ActorProvider` (wallet + demo keys), `useProgram` (ADR-10 wiring), `tx.ts` with explorer toasts, `useChainTime` (Clock sysvar), `.env.example`, and the devnet chip.
  4a. Write a minimal `scripts/demo-setup.ts`: generate six keypairs (Client, Worker, Arbiter 1 to 3, Passer-by), fund them with SOL from the deployer and with tUSDC, and write `.demo/actors.json` and `app/.env.local`. WP-51 extends it with the second (hosted) set.
  5. Write the mint script: 6 decimals, no freeze authority, mint authority = a generated faucet key; it prints the environment lines to paste.
  6. Add `FaucetButton`.
- **Acceptance:** `npm run build` and `npx tsc --noEmit` pass. Connecting Phantom on devnet works. Clicking "Get test dollars" mints 1,000 tUSDC with a working explorer link. Switching to a demo actor changes the active public key.
- **Do not:** add `@solana/kit`; put the RPC key or the demo keys in tracked files.

### WP-12 Docs skeleton (B)
- Create `README.md`, `docs/DESIGN_RATIONALE.md` and the other `docs/*` files with headings and the section 0 text. Leave explicit TODO markers for links.

### WP-20 Core instructions (A)
- **Files:** `create_deal.rs`, `accept_deal.rs`, `submit_work.rs`, `approve_milestone.rs`, `settle_milestone.rs` (rows 1, 2, 6, 7 of 3.6), `tests/helpers.ts`, `tests/01-core.test.ts`, `tests/02-timers.test.ts`, `client/ix.ts`.
- **Helpers:** `setupMint`, `makeActors`, `fundTokens`, `createDeal(overrides)`, `chainNow()`, `timeTravelTo(unixSeconds)`, `balances()`, `assertVaultInvariant(deal)`, `expectError(promise, "Name")` (compares `(e as anchor.AnchorError).error.errorCode.code`).
- **Tests:** section 8, groups A (without the close step), B (without the objection case), F and V.
- **Acceptance:** `01-core` and `02-timers` green; `cargo test` green; clippy clean.
- **Do not:** transfer tokens out anywhere except `settle_milestone` and `close_deal`.

### WP-21 Cancel, close (A)
- **Files:** `cancel_deal.rs`, `close_deal.rs`, `tests/04-cancel-close.test.ts`.
- **Acceptance:** group E, group D except the Disputed cases, and the close step of group A are green, including the withdraw-request test.

### WP-22 Core frontend (B)
- **Files:** pages `/deals`, `/new`, `/deal/:address`; components from 4.2; `errors.ts`; `format.ts`.
- **Steps:**
  1. Wizard with validation mirroring the on-chain bounds (3.5 validation list).
  2. Deal fetching (4.5).
  3. Milestone cards per 4.3 for the Open, Pending, Submitted, Approved and Settled states.
  4. Bundled approve + settle.
  5. The silent-release moment per 4.4.
  6. "Withdraw all"; cancel banners.
  7. First hosted static deploy (Vercel or Netlify) with a throwaway actor set.
- **Acceptance:** S1, S2 and S5 (and S6 once WP-21 is deployed) clickable on devnet with an explorer link on every transaction. Countdowns agree with chain time within about 3 seconds.
- **Do not:** compute any outcome in the frontend that is then trusted. The frontend only decides which button to show.

### WP-30 Dispute panel (A)
- **Files:** `open_dispute.rs`, `cast_vote.rs`, `approve_milestone.rs` (the concession path), `tests/03-dispute.test.ts`, `tests/05-authz.test.ts`.
- **Acceptance:** group C green, and the core of group G (one wrong-signer test per instruction, the recipient-account cases). The exhaustive remainder of G is Stretch. Also the cases deferred from earlier packages: the group B objection-after-deadline case, and the group D Disputed refund and "verdict beats cancel" cases (in `04-cancel-close`).

### WP-31 Dispute and crank frontend + script (B)
- **Files:** arbiter tab, `VoteTally`, objection modal with deposit warning, concede button, Passer-by on the dispute screens, `scripts/crank.ts` (scans all deals, uses `client/rules.ts`, settles anything settleable, logs explorer links; a `--watch` loop is Stretch).
- **Acceptance:** S3 and S4 clickable. One run of the script settles an expired milestone.

### WP-40 On-chain proof (A)
- **Files:** `proof/mod.rs`, `proof/verify.rs`, `proof/generated.rs`, `scripts/gen-proof-constants.ts`, `submit_proof.rs`, `set_proof_target.rs`, `tests/06-proof.test.ts`, Rust unit tests reading `fixtures/proof-pr-merged.json`.
- **Steps:**
  1. `scripts/gen-proof-constants.ts` reads the fixture, splits `parameters` around the URL, and writes `proof/generated.rs` with correctly escaped Rust string constants.
  2. Pure functions `expected_url`, `expected_parameters`, `binding_needle`, `claim_identifier`, `signed_message`, `recover_attestor`, each with unit tests: the fixture's identifier is reproduced; the fixture's signature recovers `0x2448…9072`; `expected_url` contains `/issues/`.
  3. The handler per 3.9.
  4. TS tests (`06-proof`) create deals whose `proof_attestor` is a test secp256k1 key's address and sign claims locally with `ethers`, so every positive and negative case runs on localnet.
- **Acceptance:** group H green. After the human deploys, a devnet transaction shows `ProofVerified` followed by a settle paying the worker.
- **Do not:** accept caller-supplied parameters with substring checks; add accounts to `SubmitProof`; hand-type the parameter constants.

### WP-41 Prover and proof UI (B)
- **Files:** `client/proof.ts` (reads the Deal, builds the URL and context, calls zkFetch, lowercases `owner`, maps to `ProofArgs`), `scripts/prove.ts` (CLI: prove + submit + settle; `--save` / `--load` a proof JSON), `scripts/trusted-checker.ts` (no-go path only), `prover/server.ts`, `ProofPanel`.
- **Prover service (exact):**
  - `POST /prove { deal, index }` returns `ProofArgs` JSON. Stateless. It reads the Deal from chain to build the URL, so it can only ever request the URL stored in a deal.
  - Runs on the pitch laptop at `http://localhost:8787` (Node ≥ 18, macOS or Linux). One hosted instance is optional; if hosted, restrict CORS to the app origin and add per-IP rate limiting.
  - Holds `RECLAIM_APP_SECRET` and the GitHub token; returns neither.
- **Acceptance:**
  - The end-to-end button works on devnet.
  - "Use saved proof" works in the UI with the prover stopped.
  - README sentence present: "The prover enforces nothing; delete it and the program still rejects bad proofs."
- **Do not:** add any allow or deny logic to the prover beyond input shape; return secrets; float the zk-fetch version.

### WP-50 E2E and docs (A)
- Stretch: `scripts/e2e-devnet.ts` runs S1 to S6 and S8 on devnet with short timers and prints explorer links plus a pass/fail table.
- Write `INVARIANTS.md` (3.10, 3.12), `PERMISSIONS.md` (3.11), `LIMITATIONS.md` (section 0 limits plus the attack-test result), `DEPLOY.md`.

### WP-51 Demo environment and polish (B)
- `demo-setup.ts`: extend the WP-11 version so it creates and funds both actor sets (ADR-10) with SOL transfers from the deployer and tUSDC; writes `.demo/actors.json`, `app/.env.local` (pitch set) and `.demo/hosted.env` (hosted set).
- `seed-deals.ts`: creates the deals of section 8.3 and prints their URLs. It takes `--set pitch|hosted`.
- Copy pass on the UI ("arbiter", not "judge"; plain language for Kasia).
- `/how` page.
- Re-deploy the hosted site with the hosted actor set's environment variables.

### WP-60 Final deploy and `--final` (A; every command is run by the human)
1. `anchor build`; note the size of `target/deploy/milestone_escrow.so`.
2. `solana program show <id> -u devnet`; if the binary grew beyond the allocated length, `solana program extend <id> <additional bytes> -u devnet`.
3. `anchor deploy --provider.cluster devnet` (upgrade in place). On failure: `solana program show --buffers`, `solana program close --buffers`, retry.
4. `scripts/idl-sync.ts` if the IDL changed; tag `v1.0.0`.
5. Run the gates and the decision procedure in P6.

### WP-61 Seeding, dry runs, recording (B)
- As described in P6 step 8 and section 8.3. Re-seed the pitch set 30 minutes before the pitch.

### WP-70 Submission package (A and B)
- As described in P7.

### WP-80 Stretch
- **Reclaim CPI path:** the additional verification through `8rYX…` (3.9), via `remaining_accounts`.
- **CheckRun:** only with the condition bound to a commit on the default branch after merge. Document the workflow-edit caveat.
- **Activity log:** from `getSignaturesForAddress` plus the Anchor event parser.
- **`anchor build --verifiable`:** must happen before `--final`, so only if done before the 01:30 freeze.
- **Exhaustive authorization tests** (the rest of group G) and the crank `--watch` loop.

---

## 8. Test plan

### 8.1 Automated scenarios (each ends with `assertVaultInvariant`)

- **A Happy path:** create (vault = sum; client debited), accept, submit, approve, settle (worker += amount); second milestone independent; close returns rent.
- **B Timers:**
  - Settle before review deadline fails with `NothingToSettle`.
  - Settle at or after the deadline, by a stranger, pays the worker.
  - Objection at or after the deadline fails with `ReviewWindowClosed`.
  - Submit at or after the submit deadline fails with `SubmitWindowClosed`.
  - Refund crank before the deadline fails; at the deadline it refunds the client.
  - Accept after the accept deadline fails.
- **C Disputes:**
  - Worker wins: 2 votes; worker gets amount + deposit.
  - Client wins: client gets amount + deposit.
  - 1-1 split at the deadline: 50/50, with an odd amount (for example 101 units) giving 51 to the worker and 50 to the client, and the deposit back to the client.
  - Zero votes at the deadline gives a split.
  - A third vote after a majority fails with `AlreadyDecided`.
  - A double vote fails with `AlreadyVoted`.
  - A vote after the deadline fails.
  - Objection without enough tokens fails.
  - Zero-deposit deal works.
  - Client concedes from Disputed (`approve_milestone`): worker gets amount + deposit.
  - Two Worker votes recorded but nobody settles; later settle still pays the worker.
- **D Cancel:**
  - Client cancels an Open deal and gets a full refund.
  - A stranger cancels after the accept deadline.
  - A stranger cancelling before it fails.
  - One-sided cancel in Active leaves the deal Active.
  - Withdraw: worker agrees, then withdraws with `cancel_deal(false)`; client agrees; the deal stays Active.
  - Two-sided cancel refunds Pending, Submitted and undecided Disputed milestones (the deposit returns).
  - Approved milestones still pay the worker after a cancel.
  - Stale consent: worker agrees to cancel, then calls `submit_work`; the worker's cancel bit is cleared, so a later client agreement leaves the deal Active.
  - Verdict beats cancel: two Worker votes, then a mutual cancel, then settle pays the worker amount + deposit.
  - `cancel_deal(false)` on an Open deal fails with `InvalidCancelArgument`.
- **E Close:** fails before all are settled; succeeds after; sweeps donated tokens to the client.
- **F Double settlement:** a second settle fails with `AlreadySettled`. Approve after settle fails. Submit twice fails.
- **G Authorization (core set in WP-30: one wrong-signer test per instruction and the recipient-account cases; the rest is Stretch):**
  - Wrong signer for accept, submit, approve, open_dispute, set_proof_target.
  - Non-arbiter vote (`NotJudge`).
  - Non-party cancel.
  - Wrong mint account.
  - A recipient token account owned by someone else, or of another mint, is rejected.
  - A missing optional account when its payout is greater than 0 fails with `MissingRecipientAccount`.
  - A settle paying only the client succeeds with `workerToken = null`.
  - A non-ATA token account owned by the worker is accepted.
- **V Create-deal validation (WP-20):** duplicate arbiter, arbiter equal to a party, client == worker, zero amount, 0 or 6 milestones, each window and `due_secs` out of bounds, bad repo string, proof kind without repo, proof kind with a zero attestor, duplicate PR numbers.
- **H Proof:**
  - Rust unit: the fixture identifier is reproduced; the fixture signature recovers the Reclaim attestor address; a different PR number gives a different identifier; the binding needle is exact; `expected_url` contains `/issues/`.
  - TS on localnet, with claims signed by a test key set as the deal's attestor:
    - positive: proof accepted; settle pays the worker; a proof during an undecided dispute gives the worker amount + deposit;
    - a proof for another deal's context fails with `ProofContextMismatch`;
    - a wrong milestone index in the context fails with `ProofContextMismatch`;
    - a tampered context fails with `ProofIdentifierMismatch`;
    - a claim signed by a different key fails with `ProofAttestorMismatch`;
    - a corrupted signature fails with `ProofSignatureInvalid` or `ProofAttestorMismatch`;
    - an uppercase or wrong-length `owner`, or a context over 512 bytes, fails with `ProofMalformed`;
    - a milestone with no target fails with `NoProofTarget`;
    - a proof after a 2-vote majority fails with `AlreadyDecided`;
    - `set_proof_target` twice fails; a PR number already used in the deal fails with `DuplicateProofTarget`;
    - the same proof on a second deal with the same PR is rejected.
  - Devnet positive (after deploy): a real attestor proof from `scripts/prove.ts` is accepted and the settle pays the worker.

### 8.2 Devnet end-to-end checklist
- [ ] Stretch: `scripts/e2e-devnet.ts` all green; links saved.
- [ ] Each of S1 to S8 done once through the hosted UI.
- [ ] Phantom as client; a second real wallet as worker for S1.
- [ ] The crank script settles one deal.
- [ ] Saved-proof path works with the prover stopped.
- [ ] `solana program show` output captured.

### 8.3 Demo dry-run checklist
- [ ] Pitch-set actors funded (at least 0.2 SOL and at least 2,000 tUSDC each). Hosted-set actors at about 0.05 SOL. Deployer reserve intact.
- [ ] Pitch-set deals re-seeded 30 minutes before the pitch.
- [ ] Pre-seeded deals bookmarked:
  - D1 Open.
  - D2 Submitted with a long window (approve).
  - D3 Submitted with an expired window (crank backup).
  - D4 Disputed with one vote.
  - D5 Disputed past the deadline (split).
  - D6 proof-bound with the PR already merged and a saved proof.
  - D7 proof-bound with an open PR (live merge).
  - D8 fully settled.
- [ ] Full demo script (section 6) run twice under 4 minutes.
- [ ] Prover running on `localhost:8787`; saved proof file for D6 on disk.
- [ ] Explorer tabs open.
- [ ] Phone hotspot as backup network.
- [ ] Backup recording on local disk.
- [ ] Laptop on power; notifications off.

---

## 9. Risk register

| Risk | P | I | Mitigation | Trigger | Fallback |
|---|---|---|---|---|---|
| Toolchain on Apple Silicon fails or is slow | M | H | Native install + parallel Codespace | No green build in 30 min | Codespaces permanently; booth |
| Devnet faucet dry | H | H | Request at the start of P0 and before sleep; GitHub login; mentors; pool SOL; close hello-world programs and stray buffers; one program ID | Deployer under 6 SOL at 17:30 | Ask the booth; other faucets; keep the program small |
| Attestor outage or zkFetch not enabled | M | M | Spike in P0; saved proof for the demo; proof layer optional; interface identical on every path | Spike skipped or failed, or CP2 later than 23:30 | Proof layer becomes specified roadmap; hard cut at 01:30 |
| Proof forgery through response-shape tricks | L | H | Issues endpoint + `merged_at` needle; attack test in the spike; result recorded in `LIMITATIONS.md` | Attack test produces a proof on the new design | Do not ship proof release as real acceptance; present it as roadmap |
| Keccak or secp256k1 crate does not resolve on Anchor 1.1.2 | M | M | Try at first build in P1, not in P4 | Build error | `sha3` crate for keccak; booth for secp; else cut proof layer |
| Parameters not byte-deterministic | M | M | Spike diff test | Two runs differ | Strict pass-through variant in 3.9, decided before the freeze |
| Transaction too large | L | M | Verdict/payout split; reconstructed parameters | Serialize over 1232 | Separate transactions; address lookup table not needed |
| Time overrun | H | H | Explicit cut-lines per phase; MVP-0 at 22:45 Saturday; MVP-1 and feature freeze at 01:30; Sunday morning is only release and submission | Any phase 60 min late | Drop Stretch, then Target |
| Interface frozen with a mistake | M | M | Vertical slice before the freeze; two scheduled change windows | A handler cannot be written against the IDL | Use the next change window; Dev A re-syncs |
| Hosted demo keys abused before the pitch | H | M | Two actor sets; pitch set never deployed; re-seed 30 min before | Hosted deals consumed | Pitch from the laptop build |
| Deploy fails midway or the program outgrows its allocation | M | M | `--max-len` or `program extend`; `close --buffers`; reserve | Deploy error | Recover the buffer SOL; retry; booth |
| Live demo failure | M | H | Role switcher; pre-seeded deals; Helius RPC; backup video; hotspot | Any step fails live | Say what broke; switch to the pre-seeded deal; then the recording |
| Phantom devnet quirks (warnings, wrong network, simulation failure) | M | M | Rehearse; a second wallet app installed; the demo Client actor | Phantom fails twice | Use the demo actor and say so |
| RPC rate limits | M | M | Helius key; 5 s polling, no faster; a single subscription per page | 429 errors | Second key; public RPC |
| Losing the deployer or program keypair | L | H | Private backup to the second dev right after the first deploy | | New program ID; update env |
| Finalizing a buggy program | L | H | Gates in P6; e2e on the exact deployed build; reserve | Bug after `--final` | New ID from the reserve; disclose |
| Optional accounts in Anchor misbehave | M | L | Exercised in the P1 vertical slice; 20-minute timebox | Slice fails | Both recipient accounts required, decided before the freeze |
| Surfpool time travel flaky | L | M | Helper isolated in `tests/helpers.ts` | Tests hang | `surfnet_setAccount` on the Clock sysvar; or timer tests on devnet with 10 s windows (sleeping does not advance Surfpool) |
| AI attribution slips into a commit | M | M | `commit-msg` hook; CI check; untracked agent files | Hook or CI fails | Amend before pushing; never force-push `main` after others pulled |
| Merge conflicts or interface drift | M | M | Directory ownership; frozen IDL; change requests | IDL diff without notice | Dev A re-syncs; B rebases |
| Rules start-time clause | L | H | Ask the organizers today | | Follow their answer |
| Secrets leaked in the public repo | L | H | `.gitignore` first commit; fixture check; `git grep` before making the repo public | | Rotate the PAT and app secret |

---

## 10. Requirement traceability

### 10.1 Challenge document

| Requirement (source) | Where satisfied |
|---|---|
| Remove the need for trust from a financial transaction (§2) | Section 0 rationale; program rules in 3.5 and 3.6 |
| Identify who must be trusted, who profits, the cost, what happens when trust fails (§2) | Section 0; slide 2 |
| Terms written into a program, executing automatically, identically for everyone (§2) | `decide_outcome`; no per-user branches; I8 |
| No possibility of unilateral change (§2) | I6; `--final` procedure (P6) |
| No one needed to enforce the rule (§2) | Permissionless `settle_milestone`; crank script; Passer-by |
| Working application, launchable and clickable (§3) | P1 to P3; hosted frontend |
| At least one full use case from input to completed transaction (§3) | S1 (plus S2 to S8) |
| Demonstrate the moment the intermediary is no longer needed (§3) | 4.4 (the silent-client release); demo script step 3 in section 6; slide 5 |
| Works live, not only recorded (§3, §6) | 8.3; role switcher; pre-seeded deals |
| Simple and working over polished (§3) | MVP line; Tailwind defaults |
| Name the target user explicitly; interface language follows (§3) | Section 0; 4.3 copy; README; slide 1 |
| Short design rationale: relationship, intermediary, what changes (§3) | Section 0; `docs/DESIGN_RATIONALE.md`; description |
| Title + detailed description with rationale (§4) | P7 |
| PDF of at most 10 slides (§4) | P7 slide outline |
| Public video of at most 3 minutes, in a publicly accessible location (§4) | P7 shot list and "Video hosting" (YouTube link + README + GitHub release) |
| Code repository (§4), public during evaluation (§9) | P7 definition of done |
| Optional screenshots, demo links, graphics (§4) | `docs/submission/screenshots`; hosted demo |
| Runs on Solana; devnet sufficient (§5) | ADR-11 |
| Logic replacing the intermediary lives on-chain; a backend must not enforce terms (§5) | ADR-06, ADR-08; prover is non-enforcing; trust boundaries in section 2 |
| Free choice of stack; use ecosystem building blocks (§5) | Anchor; SPL Token; wallet-adapter; Reclaim zkFetch attestation; the organizers' dev container and template |
| Demo: user arrives, connects wallet, performs an operation, sees the result (§6) | Demo script steps 1 to 3 (section 6), with Phantom |
| "What we do not evaluate": attack resistance, audits, design polish, test coverage (§6) | Tiering: exhaustive authorization tests and CI are below MVP features; UI uses template defaults |
| If something breaks, say plainly what and why (§6) | Demo script closing rule; P6 step 6 |
| Confirmed transaction shown in an explorer (§6) | `TxToast` + `ReceiptLink` on every transaction |
| Funded wallets, accounts in the right state, two wallets (§6) | WP-51, 8.3 |
| Backup recording (§6) | P6 step 8 |
| Q: where in the code the intermediary disappears (§6) | P8; README "what is where" |
| Q: a party disappears midway; where are funds; who recovers (§6) | 3.12; `docs/INVARIANTS.md` |
| Q: permissions; can the author change anything (§6) | 3.11; P6 `--final` |
| Q: why blockchain and not a database (§6) | P8; slide 9 |
| Q: what next with another week (§6) | P8; slide 10 |
| Say plainly what broke; awareness of limits valued (§6) | `docs/LIMITATIONS.md`; slide 9; `/how` page |
| Program does what the demo shows; clear README of what is where (§6) | README outline; tests named by scenario |

### 10.2 Rules document

| Rule | Where satisfied |
|---|---|
| Team of 1 to 6 | 2 people |
| Start-time and deadline clause (pt. 5) | Q1 (asked in the first five minutes of P0, answer recorded in the README); final submission by 10:00 Sunday (deadline 11:00, confirmed by Nikola) |
| Title, team name, member list, description, PDF of at most 10 slides | P7 fields |
| Submit on HackTribe in English or Polish | English |
| No alterations after the deadline (pt. 13) | Tag `v1.0.0`; no code changes after 09:00 Sunday |
| Minimum 50 percent of points in phase 1 (pt. 12) | Phase 1 is judged from the submission alone, hence P7 gets its own block (07:15–10:00) and a draft goes in by 08:00 |
| Relatives of the jury or sponsor staff are excluded (pt. 6) | Both team members confirm this does not apply (Q8) |
| Jury members announced on Discord by October 4th (pt. 15) | Check Discord during P7 to tailor the pitch |
| Phase 2 live pitch for finalists | P8 |

### 10.3 Judging criteria

| Criterion | Elements that score |
|---|---|
| Relevance 30% | All three intermediary jobs replaced on-chain; single payout function; non-enforcing off-chain parts; `--final`; explicit answers to all five questions |
| Completeness 25% | Scenarios S1 to S8 working on devnet; live role switcher; explorer receipts; tests; hosted demo |
| Idea 20% | A real cross-border freelancer problem with a named user; silence-pays + deposit incentives |
| Implementation potential 15% | Accepts any classic SPL stablecoin; no backend needed; clear next steps; Superteam grant path |
| Originality 10% | Party-appointed 3-arbiter panel with a 50/50 deadline fallback; forfeitable objection deposit; zkTLS-proven PR merge with a party-chosen attestor; arbiters structurally unable to be paid. Contrast with single-arbiter prior art only after verifying it (Stillpaid, Escrowl). |

---

## 11. Glossary (plain language)

- **Program:** code deployed on Solana. It has no memory of its own; it reads and writes accounts.
- **Account:** a record on Solana (data + a balance), owned by exactly one program that is allowed to change it.
- **PDA (program-derived address):** an account address computed from fixed "seeds" that has no private key. Only the program can act for it. Our Deal and vault are PDAs, which is why no person can move the money.
- **Mint:** the definition of a token (for example "tUSDC, 6 decimals").
- **Token account / ATA:** a balance of one token for one owner. The ATA is the default, conventionally derived token account for a wallet.
- **Vault:** the token account, owned by the Deal PDA, that holds the escrowed money.
- **Instruction / transaction:** an instruction is one call to a program. A transaction is one or more instructions signed and executed all-or-nothing.
- **Signer:** a wallet that signed the transaction. This is how the program knows who is calling.
- **IDL:** a JSON description of the program's instructions, accounts, events and errors. The frontend uses it to talk to the program.
- **CPI (cross-program invocation):** our program calling another program (for us: SPL Token, to move tokens).
- **Arbiter:** one of the three people named in a deal who vote if the client objects. The code calls them `judges`.
- **secp256k1 / keccak:** the signature scheme and hash function the attestor uses (the same ones Ethereum uses). Solana offers both as built-in operations, so our program can check the attestor's signature itself.
- **Crank:** an instruction anyone may call to push the state forward when a rule says it is time. The caller pays a tiny fee and gains nothing.
- **Rent:** a refundable SOL deposit required to keep an account alive, returned when the account is closed.
- **Lamport:** the smallest unit of SOL (one billionth).
- **Devnet / localnet:** devnet is Solana's public test network with worthless test money. Localnet is a private network on your machine for tests (Surfpool).
- **Faucet:** a service that gives free test SOL or test tokens.
- **Explorer:** a website that shows any transaction or account on the chain.
- **Upgrade authority:** the wallet allowed to replace a program's code. Removing it with `--final` makes the program immutable.
- **Anchor:** the Rust framework that removes most boilerplate when writing Solana programs.
- **Compute units:** the "work budget" of a transaction.
- **memcmp filter:** a way to ask the network for all accounts that have specific bytes at a specific position (for example "all deals where I am the worker").
- **zkTLS:** a technique to prove what a website (here the GitHub API) returned over HTTPS, without the verifier contacting the website.
- **Attestor / witness:** the independent server that watches the HTTPS session and signs a statement about the response.
- **Reclaim Protocol / zkFetch:** the zkTLS system we use, and its library for producing proofs.
- **Claim identifier:** a hash of what was requested and matched. The attestor signs it; our program recomputes it.
- **Replay:** reusing a valid proof somewhere it was not meant for. We prevent it by binding the proof to a deal and milestone.
- **Griefing:** blocking or harming the other party without profit to yourself.

---

## 12. Open questions and assumptions

### Open questions
- **Q1 Rules start and end time (resolved).** Nikola confirmed: 11:00 AM on October 3rd to 11:00 AM on October 4th.
- **Q2 Submission editing.** Does HackTribe allow editing a submission before the deadline? If yes, submit a draft by 08:00 on Sunday and update.
- **Q3 Pitch logistics.** When is the finalist pitch, and how long? The demo script assumes about 4 minutes of demo plus Q&A.
- **Q4 CPI versus inline verification (resolved in revision 2).** Inline verification against a per-deal attestor address is primary: smaller trust base, testable on localnet, no dependency on an unpublished third-party program. The CPI into Reclaim's deployed verifier is Stretch. Cost: attestor rotation is not followed automatically.
- **Q5 Product name** "Kept" is a placeholder.
- **Q6 Intermediary fee figures** for the slides must be verified from current public pricing pages.
- **Q7 Deposit on a no-majority split (decide before the interface freeze).** As agreed earlier, a no-majority deadline gives a 50/50 split and returns the deposit to the client. The reviewer's concern: with party-appointed arbiters a 1–1 vote is likely, so a client can object to every milestone for a risk-free 50 percent discount, and a worker can submit poor work for a risk-free 50 percent. The alternative is a one-line change in `decide_outcome` row 5: on no majority the deposit goes to the worker (an unresolved objection costs the objector). The plan keeps the agreed rule and discloses the weakness in `LIMITATIONS.md` unless you choose the alternative.
- **Q8 Team name**, and confirmation that neither team member is related to the jury or sponsor staff (rules pt. 6).

### Assumptions
- **A1** Dev A owns the program and deploys; Dev B owns the frontend, prover and scripts. Swap if skills suggest otherwise, but keep the directory ownership rule.
- **A2** The demo uses a public GitHub repo created for the purpose, with draft PRs opened in advance.
- **A3** The exact canonical `parameters` and `context` strings, the `merged_at` spacing, the signature `v` convention, the acceptable `contextAddress` format, zkFetch on Node 24 / macOS arm64 and its latency are confirmed by the spike. All are marked **[SPIKE]**. The constants are program internals, so they do not block the interface freeze; only "must `parameters` be passed in" does.
- **A4** The program binary is 400 KB or less. If larger, the SOL budget rises accordingly.
- **A5** Arbiters are unpaid in v1. This is listed as a limitation and a next step.
- **A6** Short timer minimums (10 s) are a deliberate demo choice and are disclosed.
- **A7** Mutual cancel refunds every milestone that has no recorded verdict (not Approved, no 2-vote majority), including undecided disputes with their deposit. Both parties must agree at the same time, and either can withdraw before the other agrees.
- **A8** A valid proof resolves an open dispute for the worker only while the panel has not reached a majority. After a majority, the panel's verdict stands.
- **A9** A client who concedes a dispute, or whose PR merge is proven during a dispute, forfeits the deposit to the worker: the deposit follows the milestone money.
- **A10** Not verified by the review and therefore to be confirmed at first use: that `has_one … @ EscrowError` and `token::authority = deal.worker` compile on `Option<Box<Account<…>>>` in Anchor 1.1.2 (covered by the P1 slice); whether `--max-len` is honoured by this CLI and whether `anchor deploy` auto-extends on upgrade; the crate versions in 3.9 against the copied `Cargo.lock`; the exact `solana program show` wording after `--final`; whether `solana program deploy` auto-extends on CLI 3.1.10; the final program size (assumed at most 400 KB); whether HackTribe allows editing a submission.

---

### Critical Files for Implementation
- /Users/nikgeo/Documents/programing-git-repos/HackYeah-26-superteam/programs/milestone_escrow/src/state.rs
- /Users/nikgeo/Documents/programing-git-repos/HackYeah-26-superteam/programs/milestone_escrow/src/instructions/settle_milestone.rs
- /Users/nikgeo/Documents/programing-git-repos/HackYeah-26-superteam/programs/milestone_escrow/src/instructions/submit_proof.rs
- /Users/nikgeo/Documents/programing-git-repos/HackYeah-26-superteam/docs/INTERFACE.md
- /Users/nikgeo/Documents/programing-git-repos/HackYeah-26-superteam/app/src/lib/tx.ts
- /Users/nikgeo/Documents/programing-git-repos/HackYeah-26-superteam/scripts/reclaim-spike.ts

## Verification (how to confirm the build works end to end)

1. **Local:** `anchor build && cargo test && anchor test` (all test files in section 8.1 green; `assertVaultInvariant` after every step).
2. **Frontend:** in `app/`, `npx tsc --noEmit && npm run build`.
3. **Devnet:** the section 8.2 checklist by hand through the UI (the `scripts/e2e-devnet.ts` table if that Stretch item was built; `scripts/prove.ts` for S7 if the proof layer shipped).
4. **Through the UI:** the section 8.2 checklist on the hosted frontend, then the section 8.3 demo dry run twice.
5. **Immutability:** `solana program show <PROGRAM_ID> -u devnet` after the P6 decision.
6. **Repo hygiene:** `git log --format=%B | grep -Ei 'co-authored-by|generated with|claude|anthropic'` prints nothing; the repo opens logged-out; no secrets in `git ls-files`.
