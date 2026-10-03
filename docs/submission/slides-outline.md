# Slides outline (10 slides, PDF)

English, plain language. The panel members are "arbiters" on every slide. Only verified
numbers and names.

## 1. Kept: escrow without the platform

- One-liner: milestone escrow for freelance developers; the rules live in a Solana program,
  not a platform.
- Built for Kasia, a freelance developer in Kraków with a client abroad she has never met.
- Team: TODO(team-name, members).

*Speaker notes:* "Kept lets a freelancer and a client work together without a platform in
the middle. Our user is Kasia." Keep it under 20 seconds.

## 2. The problem: who goes first?

- Client pays first: the freelancer can vanish. Freelancer delivers first: the client can
  take the code and not pay. Cross-border, nobody sues.
- Today a marketplace sits in the middle: it holds the money, decides release, arbitrates.
- It charges both sides TODO(verify: fee figures and source), decides who may use it, can
  freeze accounts or reverse payouts.

*Speaker notes:* name who is trusted, who profits, what it costs, and what happens when
that trust fails (frozen account, reversed payout). Only quote verified figures.

## 3. The redesign: three jobs, three replacements

| Job | Replaced by |
|---|---|
| Custody | Program-owned vault, no private key |
| Release decision | Fixed rule: approve, or silence pays after the review window |
| Dispute resolution | Three arbiters fixed at deal creation; two matching votes; 50/50 fallback |
| (Optional) "Did the client take the work?" | zkTLS proof that the agreed PR is merged |
| Power to change rules | No admin instruction, no fee, no pause; `--final` |

*Speaker notes:* "Every job the platform did is now a rule in one program, readable before
anyone locks money."

## 4. How it works

- Lock payment → accept → deliver → approve, or object, or stay silent.
- Every decision only records a verdict. One function, `decide_outcome`, turns it into a
  payout; anyone may trigger it.
- Every state has a deadline-driven exit.
- Simple state diagram in plain words. TODO(graphic: state diagram)

*Speaker notes:* emphasise "verdict, then payout": one function to read.

## 5. The moment the intermediary disappears

- Screenshot: "Paid by rule. No one approved this. Transaction signed by a stranger."
- Explorer screenshot: vault → worker, signed by the passer-by.
- Code pointer: `settle_milestone.rs`, `decide_outcome`, row 6 "silence pays".

*Speaker notes:* "The client did nothing. A stranger pressed the button and gained nothing.
The rule paid her." TODO(screenshot: release banner and explorer).

## 6. Disputes

- An objection locks a deposit; it goes to the freelancer if the arbiters side with her.
- Arbiters: one chosen by each side, one mutual, fixed when the deal is made.
- Two matching votes decide; no majority by the deadline gives 50/50, deposit back.
- Arbiters can never be paid: the program only pays the stored client or worker.

*Speaker notes:* be upfront that a 1–1 vote with an absent arbiter makes an objection cheap.

## 7. Proof release: the merge is the payment

- The client fixes the pull request when the deal is made; the freelancer checks it.
- zkTLS attestation that GitHub reports it merged; the program verifies the signature, the
  exact URL and the deal binding itself.
- Trusted: one attestor both sides chose, and GitHub. Not trusted: our prover.
- Status: TODO(shipped on devnet / designed next step).

*Speaker notes:* "The prover enforces nothing; delete it and the program still rejects bad
proofs."

## 8. Permissions and "what if someone disappears"

- Condensed permission matrix (from `docs/PERMISSIONS.md`).
- Condensed disappearance table (from `docs/INVARIANTS.md`): every state has an exit anyone
  can trigger.
- Upgrade authority status: TODO(`solana program show` screenshot).

*Speaker notes:* answer the jury questions before they ask them.

## 9. Honest limits, and why a blockchain

- Limits: "merged" is not "good"; arbiters are trusted for verdicts; one attestor; public
  repos only; short demo timers; token issuer outside our control.
- Why not a database: an operator can edit rows or freeze accounts, so it becomes the
  intermediary again. Here the rules are readable and fixed, settlement is cross-border in
  seconds, and both sides verify the same state.

*Speaker notes:* keep it factual; link to `docs/LIMITATIONS.md`.

## 10. Next week, potential, links

- Next: arbiter compensation, production timers, fairer no-majority rule, CI check-run
  release, multiple attestors, verifiable build, mainnet pilot with a real stablecoin,
  notifications, Polish-language UI.
- Potential: works with any classic SPL stablecoin, no backend needed.
- Links: repo TODO(link), demo TODO(link), video TODO(link), program
  `A8JXDe5Fy9fvBGMZoQhzEbTF8KVpiwtvnQYJHkzM4Qer`.
- Team TODO(team-name, members).

*Speaker notes:* close with the one-liner.
