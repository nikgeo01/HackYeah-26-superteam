# Kept: escrow without the platform

**Kept** is milestone escrow for freelance developers and their clients. The payment rules
live in a Solana program, not a platform: silence pays the freelancer, an objection costs a
deposit, a party-appointed panel of three arbiters settles disputes, and a merged pull request
can release payment by cryptographic proof. No platform holds the money and, once the program
is finalized, nobody can change the rules.

Built for the Superteam Poland challenge "Finance Without Intermediaries" at HackYeah 2026.
Runs on Solana devnet with test money only.

## Who it is for

Kasia is a freelance developer in Kraków. Her client is a startup in another country that she
has never met. Neither side can safely go first: if the client pays up front, Kasia could
vanish; if Kasia delivers first, the client could take the code and not pay. Across a border,
neither can realistically sue. Today a freelance marketplace sits in the middle and charges
both of them for it. Kept replaces that marketplace with a program both of them can read
before they lock any money.

## Design rationale (short)

A freelance marketplace does three jobs: it holds the money, it decides when the money is
released, and it arbitrates disputes with its own staff. Kept replaces each job with code:

| Job of the intermediary | Replaced by |
|---|---|
| Custody | A program-owned token vault. No person holds a key to it. |
| Release decision | A deterministic rule: the client approves, or the review window lapses and anyone can trigger payment. |
| Dispute resolution | A panel of three arbiters fixed when the deal is made (one picked by each side, one mutual). Two matching votes settle. No majority by the deadline gives a 50/50 split. |
| "Did the client take the work?" (optional) | A zkTLS proof that GitHub reports the agreed pull request as merged, verified on-chain. |
| Power to change the rules | Removed: no admin instruction, no fee account, no pause. Upgrade authority removed with `--final`. |

Arbiters and the authors can never receive escrowed funds: the program can only pay the
stored client and the stored worker. Every state has a deadline-driven exit, so nobody can
strand the money by disappearing.

Full version, including what we still trust and why: [`docs/DESIGN_RATIONALE.md`](docs/DESIGN_RATIONALE.md).

## Live links

| What | Link |
|---|---|
| Hosted demo | TODO(link: hosted demo URL) |
| Program on Solana Explorer (devnet) | TODO(link: `https://explorer.solana.com/address/<PROGRAM_ID>?cluster=devnet`) |
| Program ID | TODO(program-id) |
| Demo video (max 3 minutes) | TODO(link: YouTube unlisted URL) |
| Video file (GitHub release) | TODO(link: GitHub release asset) |
| Slides (PDF) | TODO(link: slides PDF) |
| Upgrade authority status | TODO(`solana program show` output after the `--final` decision) |

## What is where

### The five questions, answered in code

| Question | Where to look |
|---|---|
| Where does the intermediary disappear? | [`programs/milestone_escrow/src/instructions/settle_milestone.rs`](programs/milestone_escrow/src/instructions/settle_milestone.rs), function `decide_outcome`. It is the only code that pays out of the vault, and it uses only the stored deal state and the clock. Custody is the vault PDA created in [`create_deal.rs`](programs/milestone_escrow/src/instructions/create_deal.rs). |
| What if a party disappears midway? Where are the funds, who recovers them? | [`docs/INVARIANTS.md`](docs/INVARIANTS.md) ("A party disappears" table). Every state has a deadline after which anyone can trigger the predefined outcome. |
| Who can do what? Can the authors change anything? | [`docs/PERMISSIONS.md`](docs/PERMISSIONS.md); [`programs/milestone_escrow/src/lib.rs`](programs/milestone_escrow/src/lib.rs) has no admin instruction. Upgrade authority status: see Live links. |
| Why a blockchain and not a database? | [`docs/DESIGN_RATIONALE.md`](docs/DESIGN_RATIONALE.md#why-a-blockchain-and-not-a-database) |
| What next, with one more week? | [Next steps](#next-steps) below |

### Paths

| Path | Purpose |
|---|---|
| `programs/milestone_escrow/src/lib.rs` | Program entry points. Eleven thin instructions; no admin, fee or pause instruction. |
| `programs/milestone_escrow/src/state.rs` | The `Deal` account and its milestones. |
| `programs/milestone_escrow/src/instructions/create_deal.rs` | Creates the deal and the vault, and moves the client's funds into the vault. |
| `programs/milestone_escrow/src/instructions/settle_milestone.rs` | `decide_outcome` (the payout rule) and the only regular payout from the vault. Callable by anyone. |
| `programs/milestone_escrow/src/instructions/cast_vote.rs` | Arbiter votes. Records a verdict; moves no money. |
| `programs/milestone_escrow/src/instructions/open_dispute.rs` | Client objection; locks the deposit. |
| `programs/milestone_escrow/src/instructions/cancel_deal.rs` | Cancel before acceptance, or mutual cancel after. |
| `programs/milestone_escrow/src/instructions/submit_proof.rs` | Verifies a GitHub "PR merged" proof on-chain (signature, deal binding, exact URL). |
| `programs/milestone_escrow/src/instructions/close_deal.rs` | Closes a fully settled deal and returns rent to the client. |
| `programs/milestone_escrow/src/proof/` | Proof checks: expected URL, claim identifier, signature recovery. |
| `tests/` | Scenario tests on a local validator with time travel. |
| `client/rules.ts` | A TypeScript mirror of `decide_outcome`, used only to decide which button to show. The program decides. |
| `client/pdas.ts` | Deal and vault address derivation. |
| `app/` | The web app (Vite, React). |
| `scripts/` | Command-line tools: test mint, demo actors, seeded deals, crank, prover CLI. |
| `prover/server.ts` | Optional helper that fetches a proof. Enforces nothing. |
| `idl/` | The program interface (generated). |
| `docs/` | Design rationale, invariants, permissions, limitations, interface, deploy notes, demo script. |

## The rules

When a milestone is settled, the program applies the first rule that matches. Settling is
open to anyone; whoever triggers it receives nothing.

| # | Situation | Freelancer gets | Client gets |
|---|---|---|---|
| 1 | Already settled | Nothing happens (error) | |
| 2 | Client approved, or a valid "PR merged" proof was accepted | Amount + any locked deposit | 0 |
| 3a | Disputed, two arbiters sided with the freelancer | Amount + deposit | 0 |
| 3b | Disputed, two arbiters sided with the client | 0 | Amount + deposit |
| 4 | Deal cancelled by both sides, and no verdict recorded | 0 | Amount + deposit |
| 5 | Disputed, voting time over without two matching votes | Half (the odd unit goes to the freelancer) | Half + deposit back |
| 6 | Work delivered, client stayed silent until the review time ended ("silence pays") | Amount | 0 |
| 7 | Nothing delivered by the due time | 0 | Amount |
| | Anything else | Nothing to pay out yet | |

In one sentence: the objection deposit follows the money to whoever wins it, except on a
50/50 split, where it returns to the client. A recorded verdict (approval, proof, or two
matching votes) always beats a later cancellation.

## Run it

Requirements: Anchor 1.1.2, Solana CLI 3.1.10, Rust, Node 24, Surfpool. A dev container
(`Dockerfile`, `.devcontainer/`) is provided as an alternative.

```
git config core.hooksPath .githooks
npm ci
```

### Tests

```
anchor build && cargo test && anchor test
```

`cargo test` covers the pure payout rule and the proof checks. `anchor test` runs the
scenario tests on a local validator, moving the clock forward instead of waiting.

### App

```
cd app && npm ci && npm run dev
```

Copy `app/.env.example` to `app/.env.local` and fill in the values (RPC URL, program ID,
test-token mint, faucet key, prover URL, demo mode). Use a Solana wallet such as Phantom set
to devnet, and click "Get test dollars" for test tokens.

**Demo mode.** Demo mode embeds throwaway devnet keys in the page so one person can play all
roles. These keys are public by design and hold only test tokens. A real deployment would ship
without demo mode.

### Scripts

Run from the repository root with the root `.env` filled in (see `.env.example`).

| Script | What it does |
|---|---|
| `scripts/create-test-mint.ts` | Creates the 6-decimal test token "tUSDC" (no freeze authority) and prints the environment lines for the app. |
| `scripts/demo-setup.ts` | Generates and funds the demo actors (client, worker, three arbiters, passer-by). |
| `scripts/seed-deals.ts` | Creates the pre-seeded demo deals and prints their URLs (`--set pitch` or `--set hosted`). |
| `scripts/crank.ts` | Scans all deals and settles every milestone whose rule says it is time. Shows that no operator is needed. |
| `scripts/prove.ts` | Fetches a "PR merged" proof, submits it and settles (`--save` / `--load` a proof file). |

TODO(commands: exact invocation for each script once they exist)

### Prover

```
TODO(command: start prover/server.ts)
```

`prover/server.ts` is a small stateless HTTP service (`POST /prove { deal, index }`). It reads
the deal from the chain, asks GitHub for the agreed pull request through a zkTLS attestor, and
returns the signed proof. The prover enforces nothing; delete it and the program still rejects
bad proofs. Anyone can produce the same proof with `scripts/prove.ts`.

## Deploy

See [`docs/DEPLOY.md`](docs/DEPLOY.md). TODO(deploy: summary of program ID, upgrade history
and the `--final` decision)

## Limits

Kept removes the platform, not every form of trust. The arbiters, the proof attestor, GitHub,
the token issuer and (until `--final`) the upgrade authority are still trusted for specific,
limited things. Timers are short for the demo. Full list:
[`docs/LIMITATIONS.md`](docs/LIMITATIONS.md).

## Next steps

- Arbiter compensation and a way to find arbiters.
- Production-length minimum timers.
- A fairer no-majority rule and instructions to extend deadlines by mutual agreement.
- Release on a CI check-run, bound to workflows the client controls.
- Several attestors with a threshold; following attestor key rotation.
- A verifiable build.
- A mainnet pilot with a real stablecoin.
- Notifications and a Polish-language interface.

## Team

TODO(team: team name and members)
