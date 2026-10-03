# Invariants

Guarantees the program keeps for every deal. Each is exercised by the tests in
`tests/` (and the payout rule by the Rust unit tests in `settle_milestone.rs`).

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

## What happens if someone disappears

Every state has an exit that needs no cooperation from an absent party. Funds
always sit in the deal's vault and can only ever go to the client or the worker.

| State | Who vanished | Where the funds are | Who recovers, how, when |
|
