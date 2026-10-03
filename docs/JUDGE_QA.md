# Jury Q&A

> Draft by Dev B — Dev A to review.

Short answers to the questions the challenge says the jury will ask, each with the file to
open on screen.

## Where in the code does the intermediary disappear?

- [`programs/milestone_escrow/src/instructions/settle_milestone.rs`](../programs/milestone_escrow/src/instructions/settle_milestone.rs),
  function `decide_outcome`.
- It is the only code that pays milestone money out of the vault. It takes no opinion from
  anyone: only the stored deal state and the clock. `close_deal.rs` only returns leftovers
  and rent to the client once everything is settled.
- Row 6 of the rule is "silence pays": nobody has to approve. `settle_milestone` is
  permissionless, so a stranger (or `scripts/crank.ts`) can trigger it and gains nothing.
- Custody is the vault PDA created in
  [`create_deal.rs`](../programs/milestone_escrow/src/instructions/create_deal.rs); no
  private key exists for it.
- Each row of the rule has its own `cargo test` in the same file.

## What if a party disappears midway? Where are the funds, and who recovers them?

- Show the table in [`docs/INVARIANTS.md`](INVARIANTS.md#what-happens-if-someone-disappears).
- Every state has a deadline, after which anyone can trigger the predefined outcome:
  - worker never delivers → client refunded after the delivery deadline;
  - client stays silent → worker paid after the review deadline;
  - arbiters absent → 50/50 split after the voting deadline, deposit back to the client;
  - deal never accepted → anyone may cancel after the accept deadline, client refunded.
- Funds always sit in the vault and can only go to the client or the worker.
- If our app, prover and scripts all vanish, any party can call the program directly.
- Not recoverable by design: a party who loses their own wallet key. Funds still go to their
  account; we cannot recover the key.

## Who can do what? Can the authors change anything?

- [`docs/PERMISSIONS.md`](PERMISSIONS.md).
- There is no admin instruction, no fee account, no pause in
  [`lib.rs`](../programs/milestone_escrow/src/lib.rs).
- Before `--final`, the upgrade authority could replace the code. Show
  `solana program show A8JXDe5Fy9fvBGMZoQhzEbTF8KVpiwtvnQYJHkzM4Qer -u devnet`.
  TODO(status: finalized or not; if not, the reason).
- Outside our program, stated plainly:
  - the attestor named in a deal can sign a false claim for that deal's proof milestones,
    and only those;
  - GitHub is the fact source for proof milestones;
  - a token issuer with freeze authority can freeze accounts (our test token has none).

## Why a blockchain and not a database?

- A database has an operator who can edit a row, freeze an account or disappear with the
  money. Whoever runs it is the intermediary again, and has to be trusted, licensed and paid.
- Here custody belongs to a program whose rules both sides can read before locking money
  and that, once finalized, nobody can change.
- Settlement is cross-border in seconds for a fraction of a cent.
- Both parties verify the same state without trusting each other's server.

## What would you do with one more week?

- Arbiter compensation and a way to find arbiters.
- Production-length timer minimums.
- A fairer no-majority rule and instructions to extend deadlines by mutual agreement.
- Release on a CI check-run, bound to workflows the client controls.
- Several attestors with a threshold, and following attestor key rotation.
- A verifiable build.
- A mainnet pilot with a real stablecoin.
- Notifications; a Polish-language interface.

## Likely follow-ups

- **Can the arbiters steal the money?** No. The program can only pay the stored client or
  the stored worker. Arbiters can only choose between them.
- **Isn't a 1–1 vote a free 50 percent discount for the client?** It is cheap when the panel
  cannot decide: the deposit returns on a split. We disclose it in
  [`docs/LIMITATIONS.md`](LIMITATIONS.md); the fix is a one-line change to the split row.
- **Does "PR merged" mean the work is good?** No. It means the client accepted it on the
  repository they control. Quality disputes go to the arbiters.
- **What does the prover do?** It fetches the proof. It enforces nothing; delete it and the
  program still rejects bad proofs.
- **Why are the timers so short?** For the demo. The minimum is 10 seconds; production would
  use days.
