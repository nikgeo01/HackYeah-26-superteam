// Step 3: what locking costs against the client's balance, and the pull-request checks.
// The terms themselves are read in "The agreement so far".
import type { PublicKey } from "@solana/web3.js";
import { useBalances } from "../../hooks/useBalances";
import { FaucetButton } from "../FaucetButton";
import { Amount, Ledger, Notice, splitAmount } from "../ui";
import { formatAmount } from "../../lib/format";
import type { PrCheck } from "./github";
import { Part } from "./fields";
import type { DealInputDraft } from "./model";

const money = (raw: bigint) => {
  const { value, symbol } = splitAmount(formatAmount(raw));
  return <Amount value={value} symbol={symbol} size="sm" />;
};

export function StepReview({
  input,
  total,
  client,
  prChecks,
}: {
  input: DealInputDraft;
  total: bigint;
  client: PublicKey;
  prChecks: Record<number, PrCheck>;
}) {
  const { data: balances, isLoading } = useBalances(client);
  const short = balances !== undefined && balances.tusdc < total;
  const linked = input.milestones
    .map((m, i) => ({ n: i + 1, pr: m.proofRef }))
    .filter((m) => m.pr > 0);

  return (
    <div className="space-y-8">
      <Part
        title="Lock the payment"
        intro="Read the agreement once more. When you lock, the whole amount moves into a vault that only the program's rules can open, and the terms can no longer change."
      >
        <Ledger
          className="border-y border-rule"
          rows={[
            { key: "total", label: "Locked now, for all milestones", value: money(total) },
            {
              key: "balance",
              label: "Your test dollars",
              value: isLoading || !balances ? <span className="text-ink-soft">checking</span> : money(balances.tusdc),
            },
            ...(balances && !short
              ? [{ key: "after", label: "Left after locking", value: money(balances.tusdc - total) }]
              : []),
          ]}
        />
        {short && balances && (
          <Notice tone="void" className="flex flex-wrap items-center justify-between gap-3">
            <span>
              You are {formatAmount(total - balances.tusdc)} short. Get test dollars, then lock the
              payment.
            </span>
            <FaucetButton />
          </Notice>
        )}
        <p className="max-w-[62ch] text-sm text-ink-soft">
          No person holds a key to the vault, including us. A little test SOL pays the network fee and
          a storage deposit, which comes back to you when the deal is closed.
        </p>
      </Part>

      {linked.length > 0 && (
        <Part
          title="Pull requests"
          intro={`Before locking, Kept asks GitHub that each linked pull request in ${input.proofRepo} is still open. A merged one would pay at once.`}
        >
          <ul className="ledger border-y border-rule text-sm">
            {linked.map(({ n, pr }) => {
              const check = prChecks[pr];
              return (
                <li key={n} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2">
                  <span>
                    <span className="font-semibold">Milestone {n}</span>
                    <span className="text-ink-soft">, pull request #{pr}</span>
                  </span>
                  <span className={check ? (check.ok ? "text-ink" : "text-void") : "text-ink-soft"}>
                    {check ? check.message : "Checked when you lock"}
                  </span>
                </li>
              );
            })}
          </ul>
        </Part>
      )}
    </div>
  );
}
