# Live demo script

About 4 minutes. Everything runs on Solana devnet with test money. One laptop plays every
role: Phantom is the client in step 1; the role switcher in the app header (demo mode) is
used for the worker, the arbiters and the passer-by.

Program: `A8JXDe5Fy9fvBGMZoQhzEbTF8KVpiwtvnQYJHkzM4Qer` (devnet).

**Rule if something breaks:** say plainly what broke and why, switch to the pre-seeded deal
listed for that step, and only then to the backup recording.

## Before you start

- Pitch build running from the laptop with `app/.env.local` holding the pitch actor set.
- Pitch-set deals re-seeded 30 minutes before the pitch (`scripts/seed-deals.ts --set pitch`).
- Tabs open: the app on `/deals`, bookmarks for D1–D8, Solana Explorer (devnet), a terminal,
  and (only if the proof layer shipped) the demo GitHub repository with the open PR for D7.
- Phantom unlocked, on devnet, holding test SOL and tUSDC.

## Pre-seeded deals

| Deal | State | Used as |
|---|---|---|
| D1 | Open | Backup for step 1 |
| D2 | Submitted, long review window | Backup for step 2 (approve) |
| D3 | Submitted, review window already expired | Backup for step 3 (release by a stranger) |
| D4 | Disputed, one vote cast | Main deal for step 4 |
| D5 | Disputed, voting deadline passed | Backup for step 4 (50/50 split) |
| D6 | Proof-bound, PR already merged, saved proof on disk | Backup for step 5 |
| D7 | Proof-bound, PR open | Main deal for step 5 (live merge) |
| D8 | Fully settled | Shows a finished deal and its receipts if asked |

TODO(links: D1–D8 URLs from `seed-deals.ts` output, filled in after seeding)

## Steps

### Step 1. The client locks the money (about 45 s)

- **Actor:** Client, through Phantom (real wallet).
- **Do:** "Connect wallet" → "New deal". Worker = demo Worker; arbiters = Arbiter 1 to 3.
  Two milestones, review window 30 seconds, objection deposit set. Click "Lock payment" and
  approve in Phantom.
- **Show:** the receipt link opens the explorer: tokens moved from the client into the
  vault.
- **Say:** "Kasia's client locks the money for two milestones. It now sits in a vault that
  belongs to the program. Nobody has a key to it, not us either."
- **Backup:** switch to the demo Client actor and repeat; or open D1.

### Step 2. The freelancer accepts and delivers (about 30 s)

- **Actor:** Worker (role switcher).
- **Do:** open the deal → "Accept this deal" → on milestone 1, "Deliver work" (paste a link)
  → confirm.
- **Show:** the countdown starts: "If the client says nothing, you are paid in 0:30."
- **Say:** "Kasia delivers. Now the client has 30 seconds to approve or object. In real use
  that would be days."
- **Backup:** D2.

### Step 3. The moment: nobody approves (about 60 s)

- **Actor:** stay on Worker while the countdown runs, then Passer-by (role switcher).
- **Do:** let the countdown reach zero. The card changes colour and shows "Release payment"
  to everyone. Switch to Passer-by, click "Release payment".
- **Show:** the banner "Paid by rule. No one approved this. Transaction signed by a
  stranger." Open the receipt: tokens moved vault → worker, signed by the passer-by.
- **Say:** "The client stayed silent. Nobody approved this. The rule paid her, and the
  person who triggered it is a stranger who gets nothing for it. This is where the platform
  disappears."
- **Backup:** D3 (window already expired), same button.

### Step 4. A dispute (about 45 s)

- **Actor:** Arbiter 2 (role switcher).
- **Do:** open D4 (objection open, one vote already cast). Click "Side with freelancer" (or
  the side matching the existing vote, so it becomes a majority). The vote and the payout go
  in one transaction.
- **Show:** the tally reaches two; the milestone settles; the receipt shows the vault paying
  the winner, amount plus deposit.
- **Say:** "The client objected, and objecting cost a deposit. The arbiters were chosen by
  both sides when the deal was made. They can decide, but the program can only ever pay the
  client or the worker. Arbiters cannot be paid."
- **Backup:** D5: voting time is over without a majority. Click "Split 50/50" (any actor) and
  show half to each side and the deposit back to the client.

### Step 5. Encore: payment by proof (about 45 s, only if the proof layer shipped)

- **Actor:** Client on GitHub, then any actor in the app.
- **Do:** in the demo repository, merge the PR bound to D7. In the app, open D7 and click
  "Prove with GitHub".
- **Show:** the three steps ("Asking GitHub", "Verifying the proof on Solana", "Paying the
  freelancer"), each with a receipt.
- **Say:** "The client merged the pull request. That merge is the payment. The proof is
  checked by the program itself; the helper that fetched it enforces nothing."
- **Backup:** D6 with "Use saved proof" (load the saved proof file). If the proof layer did
  not ship, skip this step and mention it as the designed next step.

### Step 6. Nobody can change the rules (about 20 s)

- **Do:** in the terminal run
  `solana program show A8JXDe5Fy9fvBGMZoQhzEbTF8KVpiwtvnQYJHkzM4Qer -u devnet`.
- **Show:** no upgrade authority.
- **Say:** "The program is final. Not even we can change these rules now."
- **If not finalized:** "It is still upgradeable, so today you must trust us. This is the
  one command that removes that, and we did not run it because TODO(reason)."
- **Backup:** screenshot of the output. TODO(screenshot path).

## Dry-run checklist

Run the full script twice, under 4 minutes each, against the deployed program.

- [ ] Pitch-set actors funded: at least 0.2 SOL and at least 2,000 tUSDC each.
- [ ] Hosted-set actors at about 0.05 SOL each.
- [ ] Deployer reserve intact.
- [ ] Pitch-set deals re-seeded 30 minutes before the pitch.
- [ ] Pre-seeded deals bookmarked:
  - [ ] D1 Open.
  - [ ] D2 Submitted with a long window (approve).
  - [ ] D3 Submitted with an expired window (release backup).
  - [ ] D4 Disputed with one vote.
  - [ ] D5 Disputed past the deadline (split).
  - [ ] D6 Proof-bound with the PR already merged and a saved proof.
  - [ ] D7 Proof-bound with an open PR (live merge).
  - [ ] D8 Fully settled.
- [ ] Full demo script run twice under 4 minutes.
- [ ] Prover running on `localhost:8787`; saved proof file for D6 on disk.
- [ ] Explorer tabs open.
- [ ] Phone hotspot ready as backup network.
- [ ] Backup recording on local disk.
- [ ] Laptop on power; notifications off.
