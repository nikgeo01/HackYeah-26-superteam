# HackTribe submission: description (draft)

- **Project title:** Kept: escrow without the platform
- **Team name:** Sector A
- **Team members:** Nikola Georgiev, Boyan Gerasimov
- **Links:** repository https://github.com/nikgeo01/HackYeah-26-superteam, hosted demo https://nikgeo01.github.io/HackYeah-26-superteam/, video TODO(link: video),
  program on the explorer: https://explorer.solana.com/address/A8JXDe5Fy9fvBGMZoQhzEbTF8KVpiwtvnQYJHkzM4Qer?cluster=devnet

---

## Description

Kept is milestone escrow for freelance developers and their clients. The payment rules live
in a Solana program, not a platform: silence pays the freelancer, an objection costs a
deposit, a party-appointed panel of three arbiters settles disputes, and a merged pull
request can release payment by cryptographic proof.

**Who it is for.** Kasia is a freelance developer in Kraków working for a startup abroad that
she has never met. Neither side can safely go first: if the client pays up front, she could
vanish; if she delivers first, the client could take the code and not pay. Across a border,
neither can realistically sue.

**The intermediary we removed.** Today a freelance marketplace sits in the middle. It does
three jobs: it holds the money, it decides when the money is released, and it arbitrates
disputes with its own staff. It charges both sides (TODO(verify: fee figures)), can freeze accounts or
reverse payouts, and is a single point of failure.

**What replaces it.**

- *Custody:* a token vault owned by the program. No person holds a key to it.
- *Release:* a fixed rule. The client approves, or the review window ends and anyone can
  trigger the payment. Silence pays.
- *Disputes:* an objection locks a deposit. Three arbiters are fixed when the deal is made
  (one chosen by each side, one mutual). Two matching votes decide; with no majority by the
  deadline the milestone is split 50/50. Arbiters can never receive the money: the program
  can only pay the client or the worker.
- *Proof of acceptance (optional):* a zkTLS attestation that GitHub reports the agreed pull
  request as merged, verified by the program itself. The client's merge is the payment.
- *Changing the rules:* there is no admin instruction, no fee and no pause.
  TODO(status: upgrade authority removed with `--final`, or the honest statement).

Every decision only records a verdict; a single permissionless instruction,
`settle_milestone` with its pure function `decide_outcome`, is the only code that pays
milestone money out of the vault. That function is where the intermediary disappears. Every
state has a deadline, after which anyone can trigger the predefined outcome, so no one can
strand the funds by disappearing. The app and helper scripts enforce nothing: if they
vanish, anyone can call the program directly with the same result.

**What we still trust, honestly.** The arbiters for subjective disputes (never for custody);
the attestor named in the deal and GitHub, for proof milestones only; the token issuer; and
the upgrade authority until the program is finalized. "PR merged" does not mean "the work is
good". A 1–1 vote with an absent arbiter makes an objection cheap. Timers are short for the
demo. All limits are listed in `docs/LIMITATIONS.md`.

**Why a blockchain.** A database operator can edit a row or freeze an account, and becomes
the intermediary again. Here both sides read the rules before locking money and verify the
same state, cross-border, in seconds.

Built with Anchor, SPL Token, React and Reclaim Protocol's zkFetch, on Solana devnet.
