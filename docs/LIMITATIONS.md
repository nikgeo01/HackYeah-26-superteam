# Limitations

What this project does not do, or does only partly. We would rather you hear it
from us.

## Trust that remains

- **Arbiters.** In a dispute, two of three people decide. They are trusted not to
  collude. They can never receive the escrowed money (the program can only pay the
  client or the freelancer), and if they stay silent the result is a 50/50 split.
- **The no-majority rule can be gamed.** With one arbiter picked by each side, a 1–1
  vote is likely. On a split the client gets the deposit back, so a client can object
  to every milestone for a 50 % discount at no risk, and a freelancer can deliver
  poor work and still get 50 %. A fairer rule (the deposit goes to the freelancer
  when an objection is not upheld) is a one-line change we would make next.
- **A deposit of zero makes objections free.** The client chooses the deposit when
  creating the deal; the freelancer sees it before accepting.
- **Proof release trusts one attestor and GitHub.** The program checks the attestor's
  signature itself, against an address both parties fixed in the deal (by default the
  Reclaim Protocol attestor). If that attestor signed something false, a proof
  milestone could pay out wrongly. GitHub is the source of the fact. Attestor key
  rotation is not followed automatically.
- **"Merged" is acceptance only if the client controls the repository.** The program
  cannot check who owns a repository. The freelancer must check it before accepting.
  Public repositories only. A client can still copy the code without merging; then
  the review timer and the arbiters apply.
- **Upgrade authority.** Until `solana program set-upgrade-authority --final` is run,
  the deployer wallet can replace the program. Run `solana program show <id>` to see
  whether that has happened.
- **Token issuer.** A real stablecoin's issuer can freeze accounts. Our test token
  has no freeze authority.

## Simplifications for the hackathon

- Timers can be as short as 10 seconds so the demo fits in a few minutes; a
  production version would use hours or days.
- At most 5 milestones per deal.
- Arbiters are unpaid.
- Proof parameters (the exact request bytes the attestor signs) were pinned from a
  single proof run; if the attestor service changes its format, new deals need an
  updated program.
- Only classic SPL Token mints are accepted (no Token-2022), on purpose: transfer
  fees, hooks and permanent delegates would break the escrow's accounting.
- Devnet only, with test tokens.

## Not evaluated, not done

- No security audit, no fuzzing, no formal verification.
- No verifiable build badge.
