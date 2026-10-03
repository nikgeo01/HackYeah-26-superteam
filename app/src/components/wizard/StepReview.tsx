// Step 3: review the terms, see the total to lock against the client's balance.
import type { PublicKey } from "@solana/web3.js";
import { useActor } from "../../providers/ActorProvider";
import { useBalances } from "../../hooks/useBalances";
import { FaucetButton } from "../FaucetButton";
import { PartyName } from "../DealCard";
import { formatAmount, formatDuration } from "../../lib/format";
import type { PrCheck } from "./github";
import { JUDGE_LABELS, type DealInputDraft } from "./model";

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1 py-2 sm:grid-cols-[14rem_1fr]">
      <dt className="text-sm text-slate-500">{label}</dt>
      <dd className="text-sm">{children}</dd>
    </div>
  );
}

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
  const { demoActors } = useActor();
  const { data: balances, isLoading } = useBalances(client);
  const short = balances !== undefined && balances.tusdc < total;
  const proofs = input.milestones.some((m) => m.proofRef > 0);

  return (
    <div className="space-y-6">
      <dl className="divide-y divide-slate-200 rounded-lg border border-slate-200 px-4">
        <Row label="You (client)">
          <PartyName address={client} actors={demoActors} />
        </Row>
        <Row label="Freelancer">
          <PartyName address={input.worker} actors={demoActors} />
        </Row>
        {input.judges.map((j, i) => (
          <Row key={JUDGE_LABELS[i]} label={JUDGE_LABELS[i]}>
            <PartyName address={j} actors={demoActors} />
          </Row>
        ))}
        <Row label="Time to accept">
          {formatDuration(input.acceptWindowSecs)}
        </Row>
        <Row label="Your review time per delivery">
          {formatDuration(input.reviewWindowSecs)} (then silence pays)
        </Row>
        <Row label="Arbiters' voting time">
          {formatDuration(input.voteWindowSecs)} (then a 50/50 split)
        </Row>
        <Row label="Objection deposit">
          {input.disputeDeposit === 0n ? (
            <span className="text-amber-800">
              0: objections are free for you
            </span>
          ) : (
            formatAmount(input.disputeDeposit)
          )}
        </Row>
        {input.proofRepo && (
          <Row label="GitHub repository">
            <a
              href={`https://github.com/${input.proofRepo}`}
              target="_blank"
              rel="noreferrer"
              className="text-indigo-700 underline"
            >
              {input.proofRepo}
            </a>
          </Row>
        )}
      </dl>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-slate-500">
              <th className="py-2 pr-3 font-medium">Milestone</th>
              <th className="py-2 pr-3 font-medium">Amount</th>
              <th className="py-2 pr-3 font-medium">Due after acceptance</th>
              {proofs && (
                <th className="py-2 font-medium">Released by merging</th>
              )}
            </tr>
          </thead>
          <tbody>
            {input.milestones.map((m, i) => (
              <tr key={i} className="border-b border-slate-100">
                <td className="py-2 pr-3">{i + 1}</td>
                <td className="py-2 pr-3">{formatAmount(m.amount)}</td>
                <td className="py-2 pr-3">{formatDuration(m.dueSecs)}</td>
                {proofs && (
                  <td className="py-2">
                    {m.proofRef > 0 ? (
                      <>
                        PR #{m.proofRef}
                        {prChecks[m.proofRef] && (
                          <span
                            className={`ml-2 text-xs ${prChecks[m.proofRef].ok ? "text-emerald-700" : "text-red-700"}`}
                          >
                            {prChecks[m.proofRef].message}
                          </span>
                        )}
                      </>
                    ) : (
                      "No"
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {proofs && (
        <p className="rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-900">
          Only use a repository where you decide what gets merged. Merging a
          linked pull request releases that payment. Before locking the
          funds, the app checks with GitHub that each pull request is still
          open.
        </p>
      )}

      <div className="rounded-lg bg-slate-900 px-4 py-4 text-white">
        <p className="text-sm text-slate-300">Total to lock now</p>
        <p className="text-3xl font-bold">{formatAmount(total)}</p>
        <p className="mt-1 text-sm text-slate-300">
          Your balance:{" "}
          {isLoading || !balances ? "…" : formatAmount(balances.tusdc)}
        </p>
        <p className="mt-2 text-xs text-slate-400">
          The money goes into a vault controlled only by the program&apos;s
          rules. No person, including us, holds a key to it. A small amount of
          test SOL pays the network fee and the storage deposit, which comes
          back to you when the deal is closed.
        </p>
      </div>
      {short && (
        <div className="flex flex-wrap items-center gap-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">
          <span>You do not have enough test dollars for this deal.</span>
          <FaucetButton />
        </div>
      )}
    </div>
  );
}
