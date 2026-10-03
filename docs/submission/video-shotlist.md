# Video shot list

At most 3:00; export under 2:55. English. Recorded on devnet from the pitch build; the P6
backup recording doubles as raw footage.

| Time | Shot | Voice-over (draft) |
|---|---|---|
| 0:00–0:20 | Kasia's problem in one sentence; who the intermediary is | "Kasia is a freelance developer in Kraków. Her client is abroad. Neither can go first, so today a platform holds the money, decides release and settles disputes, and charges both." |
| 0:20–0:50 | Client connects Phantom, creates and funds a deal; explorer receipt | "The client locks payment for two milestones in a vault that belongs to the program. Nobody has its key." |
| 0:50–1:10 | Worker accepts and delivers | "Kasia accepts and delivers the first milestone. The review clock starts." |
| 1:10–1:40 | Client stays silent; countdown (cut); passer-by clicks "Release payment"; explorer shows vault → worker | "The client says nothing. When the time is up, anyone can release the payment. Here a stranger does it and gains nothing. The rule paid her." |
| 1:40–2:10 | Objection with deposit; two arbiters vote; settled | "An objection costs a deposit. Arbiters chosen by both sides vote. They decide the outcome, but the program can only pay the client or the worker." |
| 2:10–2:40 | Client merges the PR on GitHub; "Prove with GitHub"; payment released by proof | "Merging the pull request is the payment. The program checks the proof itself." |
| 2:40–2:55 | `solana program show`; limits in one sentence; repo link | "No one can change these rules now. Arbiters, the attestor and GitHub are still trusted for narrow things; our limits are in the repo." |

If the proof layer did not ship, replace 2:10–2:40 with a longer dispute shot and one
sentence about the designed proof release.

TODO(recording: file name and location of the raw footage)

## Hosting steps

1. Export the video (MP4, under 2:55, 1080p).
2. Upload to YouTube as **Unlisted**. Title: "Kept: escrow without the platform".
3. Open the link in a private browser window and check it plays logged-out.
4. Create a GitHub release on the repository (e.g. `v1.0.0`) and attach the MP4 file.
5. Check the release asset downloads logged-out.
6. Put the YouTube link at the top of `README.md` (Live links) and in the HackTribe links
   field. TODO(link: YouTube URL), TODO(link: GitHub release asset).

## Screenshots to capture (`docs/submission/screenshots/`)

- Landing page with "Devnet: test money only".
- Create-deal review step.
- Countdown on a submitted milestone.
- "Paid by rule. No one approved this." banner.
- Explorer transaction: vault → worker, signed by the passer-by.
- Dispute card with vote tally.
- Proof panel with three steps (if shipped).
- `solana program show` output.
