# Design rationale

**Kept** is milestone escrow for freelance developers and their clients. The payment rules
live in a Solana program, not a platform: silence pays the freelancer, an objection costs a
deposit, a party-appointed panel of three arbiters settles disputes, and a merged pull request
can release payment by cryptographic proof. No platform holds the money and, once the program
is finalized, nobody can change the rules.

## Who it is for

Freelance software developers who invoice clients abroad, and the small companies that hire
them. Our reference user is Kasia, a freelance developer in Kraków, working for a startup
client in another country that she has never met.

Because the user is a developer, GitHub is a first-class concept: a milestone can be tied to
a pull request, and merging that pull request can release the payment.

They are technical, but they are not crypto people, and that choice shapes the interface:

- The app speaks in deals, milestones, deadlines and dollars. Amounts are in a dollar test
  token; there are no lamports, PDAs or raw addresses on the main screens.
- Addresses and on-chain details sit under "Details" for anyone who wants them, and every
  transaction links to its public receipt on Solana Explorer.
- In demo mode nobody needs a wallet: each role is a ready-made devnet account, and every
  click is still a real transaction.

## Which financial relationship we redesigned

A client pays a freelancer for work delivered in milestones. Neither side can go first
safely:

- If the client pays first, the freelancer can vanish.
- If the freelancer delivers first, the client can take the code and not pay.
- Across a border, neither can realistically sue.

## Who the intermediary was

A freelance marketplace performs three jobs:

1. It holds the money (custody).
2. It decides when the money is released (approval timers).
3. It arbitrates disputes with its own staff.

For this it charges both sides. TODO(verify: marketplace fee figures from current public
pricing pages before quoting any number). It also decides who may use it, can freeze
accounts or reverse payouts, and is a single point of failure.

## What changes when it is removed

| Job of the intermediary | Replaced by | Where in code |
|---|---|---|
| Custody | A program-owned token vault. No person holds a key to it. | [`create_deal.rs`](../programs/milestone_escrow/src/instructions/create_deal.rs) (vault creation), [`settle_milestone.rs`](../programs/milestone_escrow/src/instructions/settle_milestone.rs) (the only exit for milestone money) |
| Release decision | A deterministic rule. The client approves, or the client's review window lapses and anyone can trigger payment. | [`settle_milestone.rs`](../programs/milestone_escrow/src/instructions/settle_milestone.rs), `decide_outcome` |
| Dispute resolution | A panel fixed when the deal is created: the client picks one arbiter, the worker picks one, and one is mutual. Two matching votes settle. No majority by the deadline gives a 50/50 split. | [`cast_vote.rs`](../programs/milestone_escrow/src/instructions/cast_vote.rs), [`settle_milestone.rs`](../programs/milestone_escrow/src/instructions/settle_milestone.rs) |
| "Did the client take the work?" (optional) | A zkTLS proof that GitHub reports the agreed pull request as merged, verified on-chain. The client's merge is the payment: they cannot take the work on GitHub and withhold the money. | [`submit_proof.rs`](../programs/milestone_escrow/src/instructions/submit_proof.rs), [`proof/`](../programs/milestone_escrow/src/proof/) |
| The platform's power to change the rules | Removed: no admin instruction, no fee account, no pause. The upgrade authority is removed with `--final`. | [`lib.rs`](../programs/milestone_escrow/src/lib.rs) (no admin instruction exists) |

Further properties:

- Arbiters and the program authors can never receive escrowed funds. The only two
  recipients the program can pay are the stored client and the stored worker.
- An objection is not free. The client locks a deposit that goes to the freelancer if the
  panel sides with the freelancer.
- Every state has a deadline-driven exit, so funds cannot be stranded by someone
  disappearing. See [`INVARIANTS.md`](INVARIANTS.md).

### Verdict, then payout

Every decision (approve, vote, proof, cancel) only records a verdict. One permissionless
instruction, `settle_milestone`, turns the recorded state and the clock into a payout. This
gives one function to read for "where does the intermediary disappear", and it means a vote
or an approval can never fail because of someone's token account. The app bundles decision
and payout into one transaction where it can, so the user still sees "approve, paid".

### What is enforced and what is not

- **Enforcing:** the `milestone_escrow` program, the SPL Token program, Solana consensus.
- **Not enforcing:** the web app, the prover service, the crank script, RPC providers. If
  all of them vanish, any party can still call the program from a script and get the same
  outcomes.
- **Trusted third parties, named:** the three arbiters (verdict only, never custody); the
  attestor chosen in the deal (proof milestones only); GitHub (the fact source); the token
  issuer; the upgrade authority until `--final`.

Who may do what: [`PERMISSIONS.md`](PERMISSIONS.md).

## Why a blockchain and not a database

- A database has an operator who can edit a row, freeze an account or disappear with the
  money. Whoever runs it is the intermediary again, and has to be trusted, licensed and paid.
- Here custody belongs to a program whose rules both sides can read before locking money
  and that, once finalized, nobody can change.
- Settlement is cross-border in seconds for a fraction of a cent.
- Both parties verify the same state without trusting each other's server.

## Honest limits

- A proof or a test only checks what it encodes. "PR merged" does not mean "the work is
  good".
- Subjective disputes still need humans. The arbiters are trusted not to collude, but they
  can never take the money, and the worst case with absent arbiters is a 50/50 split.
- The proof is a signature from one attestor that both parties chose when the deal was made
  (by default the one operated by Reclaim Protocol): a third party neither side controls,
  not full trustlessness.
- "Merged" means acceptance only if the client controls merges on the agreed repository. The
  worker must check that before accepting. Public repositories only. A client can still copy
  the code without merging; then the review timer and the panel apply.
- With a 1–1 vote and an absent third arbiter the result is a 50/50 split with the deposit
  returned, so an objection is cheap when the panel cannot decide. A deposit of zero makes
  objections free.
- Until `--final`, the upgrade authority can replace the program. TODO(status: `solana
  program show` output after the `--final` decision).
- The token issuer (a real stablecoin's freeze authority) is outside our control.
- Timer minimums are short (10 seconds) for demo purposes.
- TODO(verify: prior-art names and how they differ, before they appear on a slide).

Full list: [`LIMITATIONS.md`](LIMITATIONS.md).
