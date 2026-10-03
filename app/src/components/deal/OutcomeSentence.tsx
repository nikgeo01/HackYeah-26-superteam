// One plain sentence for a settled milestone. The outcome itself was decided by the program.
import type { MilestoneInfo } from "../../lib/deals";
import { formatAmount } from "../../lib/format";

export function outcomeSentence(m: MilestoneInfo): string {
  const amount = formatAmount(m.amount);
  // A voting deadline is only set when the client objected. The program pays
  // the locked deposit to the winner and then clears it, so it is no longer in
  // the account; say it in words instead of understating the payout.
  const deposit = m.voteDeadline > 0 ? " plus the objection deposit" : "";
  switch (m.outcome) {
    case "workerPaid":
      return `The freelancer was paid ${amount}${deposit}.`;
    case "clientRefunded":
      return `The client was refunded ${amount}${deposit}.`;
    case "split": {
      const clientHalf = m.amount / 2n;
      return `Split 50/50: the freelancer received ${formatAmount(m.amount - clientHalf)} and the client ${formatAmount(clientHalf)}, plus any objection deposit back.`;
    }
    case "cancelled":
      return `The deal was cancelled, so ${amount}${deposit} went back to the client.`;
    default:
      return "Paid out.";
  }
}

export function OutcomeSentence({ milestone }: { milestone: MilestoneInfo }) {
  const tone =
    milestone.outcome === "workerPaid"
      ? "text-emerald-800"
      : milestone.outcome === "split"
        ? "text-amber-800"
        : "text-sky-800";
  return (
    <p className={`text-base font-semibold ${tone}`}>
      {outcomeSentence(milestone)}
    </p>
  );
}
