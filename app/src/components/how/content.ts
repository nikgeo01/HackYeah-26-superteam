// Plain-language copy for /how, condensed from INTERFACE 3.6, 3.11, 3.12 and PLAN 0.
// "Arbiter", never "judge". No jargon on the primary text.

export const RULES: string[] = [
  "The client locks the whole payment when creating the deal. It sits in a vault that only the program's rules can open. No person holds a key to it, not even us.",
  "The freelancer accepts the deal within the agreed time. If they do not, anyone can cancel it and the client gets everything back.",
  "Each milestone has a due time. The freelancer delivers by sharing a link. If nothing is delivered in time, that milestone's money can go back to the client.",
  "After a delivery the client has a fixed time to review. They can approve, or raise an objection. If they say nothing, the freelancer is paid. Silence pays.",
  "Raising an objection costs the client a deposit, agreed in advance. Three arbiters, fixed when the deal was made, then vote. Two matching votes decide.",
  "If the arbiters do not reach two matching votes in time, the payment is split 50/50 and the client's deposit goes back to the client.",
  "Optionally, a milestone can be tied to a GitHub pull request. When the client merges it, anyone can prove that on Solana and the freelancer is paid.",
  "Releasing a payment that the rules allow does not need permission. Anyone can press the button, even a stranger, and the money still only goes to the client or the freelancer.",
];

export interface PayoutRow {
  when: string;
  freelancer: string;
  client: string;
}

/** INTERFACE 3.6, first match wins. */
export const PAYOUT_ROWS: PayoutRow[] = [
  {
    when: "The client approved the milestone, or a proof from GitHub showed the pull request was merged",
    freelancer: "The amount, plus the deposit if one was locked",
    client: "Nothing",
  },
  {
    when: "During an objection, two arbiters sided with the freelancer",
    freelancer: "The amount plus the client's deposit",
    client: "Nothing",
  },
  {
    when: "During an objection, two arbiters sided with the client",
    freelancer: "Nothing",
    client: "The amount plus their deposit back",
  },
  {
    when: "The deal was cancelled (and the milestone was not already decided)",
    freelancer: "Nothing",
    client: "The amount (plus any deposit) back",
  },
  {
    when: "During an objection, the voting time ran out without two matching votes",
    freelancer: "Half the amount",
    client: "Half the amount plus their deposit back",
  },
  {
    when: "Work was delivered and the client's review time ran out without an answer",
    freelancer: "The full amount",
    client: "Nothing",
  },
  {
    when: "Nothing was delivered before the due time",
    freelancer: "Nothing",
    client: "The amount back",
  },
];

export const PAYOUT_NOTE =
  "The rows are checked from top to bottom; the first that applies wins. That is why a decision already made (an approval, a proof, or two matching votes) always beats a later cancellation.";

export interface DisappearRow {
  who: string;
  what: string;
}

/** INTERFACE 3.12, condensed. */
export const DISAPPEAR_ROWS: DisappearRow[] = [
  {
    who: "The freelancer never accepts",
    what: "The client can cancel at any time and gets everything back. After the accept time, anyone can do it for them.",
  },
  {
    who: "The freelancer stops delivering",
    what: "After a milestone's due time, anyone can send that money back to the client.",
  },
  {
    who: "The client goes silent after a delivery",
    what: "After the review time, anyone can release the payment to the freelancer. Silence pays.",
  },
  {
    who: "One or more arbiters do not vote",
    what: "Two arbiters can still decide. If they do not, after the voting time anyone can split the payment 50/50.",
  },
  {
    who: "One side asks to cancel, the other is gone",
    what: "Nothing changes until the other side agrees. All normal rules and timers keep running.",
  },
  {
    who: "This website, the proof helper or its authors disappear",
    what: "The money is unaffected. Anyone can call the program directly with the public scripts in the repository.",
  },
  {
    who: "GitHub or the attestor is down",
    what: "Only the GitHub release stops working. Approval, timers and arbiters still work.",
  },
];

export const DISAPPEAR_NOTE =
  "The one thing we cannot fix: if you lose your own wallet key, your payments still arrive at your address, but nobody can recover the key for you.";

export interface PermissionRow {
  action: string;
  who: string;
}

/** INTERFACE 3.11, condensed. */
export const PERMISSION_ROWS: PermissionRow[] = [
  { action: "Create and fund a deal", who: "The client" },
  { action: "Accept, deliver work", who: "The freelancer" },
  {
    action: "Approve, raise an objection, or give in during one",
    who: "The client",
  },
  { action: "Vote on an objection", who: "Each arbiter, once, for their own seat" },
  {
    action: "Link a pull request to a milestone later",
    who: "The client, once per milestone",
  },
  { action: "Submit a proof that a pull request was merged", who: "Anyone" },
  {
    action: "Cancel before the freelancer accepts",
    who: "The client; anyone after the accept time",
  },
  {
    action: "Cancel after the freelancer accepts",
    who: "Only if both the client and the freelancer agree",
  },
  {
    action: "Release a payment the rules allow, close a finished deal",
    who: "Anyone",
  },
  {
    action: "Receive money from the vault",
    who: "Only the client or the freelancer. Never an arbiter, a stranger or us.",
  },
  {
    action: "Replace the program's code",
    who: "The upgrade key holder until the program is finalized; nobody afterwards (see the status below)",
  },
];

/** PLAN 0, "Honest limits". */
export const LIMITS: string[] = [
  'A proof only checks what it encodes. "Pull request merged" does not mean "the work is good".',
  "Disagreements about quality still need people. The arbiters are trusted not to collude, but they can never take the money, and the worst case with absent arbiters is a 50/50 split.",
  "The GitHub proof is a signature from one attestor that both sides chose when the deal was made (by default the one run by Reclaim). It is a third party neither side controls, not full trustlessness.",
  "Merging means acceptance only if the client controls merges on the agreed repository. The freelancer must check that before accepting. Public repositories only. A client could still copy the code without merging; then the review timer and the arbiters apply.",
  "With a 1–1 vote and an absent third arbiter the result is a 50/50 split with the deposit returned, so an objection is cheap when the arbiters cannot decide. A deposit of 0 makes objections free.",
  "Until the program is finalized, whoever holds its upgrade key could change the rules. The live status is shown below.",
  "The issuer of a real stablecoin can freeze accounts. That is outside our control. (The test dollars here have no freeze authority.)",
  "Timers can be as short as 10 seconds so the rules can be tried quickly. Real deals should use days.",
];
