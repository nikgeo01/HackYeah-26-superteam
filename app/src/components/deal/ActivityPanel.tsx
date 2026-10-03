// "On the public record": every transaction that touched this deal, read back from Solana, in
// plain words, each with a button to verify it on Solana Explorer. Nothing here is from our server.
import { useQuery } from "@tanstack/react-query";
import { useConnection } from "@solana/wallet-adapter-react";
import type { Connection, PublicKey } from "@solana/web3.js";
import { roleIn, type DealView } from "../../lib/deals";
import { formatDateTime, shortAddress } from "../../lib/format";
import { vaultPda } from "../../lib/pdas";
import { ExplorerButton } from "../ExplorerButton";
import { Spinner } from "../ui";
import { ROLE_LABEL, TxLink } from "./common";

/** The program's instructions as Anchor logs them, in the words the rest of the app uses. */
const ACTION: Record<string, string> = {
  CreateDeal: "Deal created, payment locked in the vault",
  AcceptDeal: "Freelancer accepted the deal",
  SubmitWork: "Work delivered",
  ApproveMilestone: "Client approved",
  OpenDispute: "Client objected",
  CastVote: "Arbiter voted",
  SettleMilestone: "Milestone paid out",
  SetProofTarget: "Pull request linked",
  SubmitProof: "Merge proof submitted",
  CancelDeal: "Cancel requested",
  CloseDeal: "Deal closed, leftovers returned",
};

interface Activity {
  signature: string;
  at: number;
  ok: boolean;
  what: string;
  signer: PublicKey | null;
}

const LIMIT = 25;

async function fetchActivity(connection: Connection, deal: PublicKey): Promise<Activity[]> {
  const sigs = await connection.getSignaturesForAddress(deal, { limit: LIMIT }, "confirmed");
  if (sigs.length === 0) return [];
  const txs = await connection.getTransactions(
    sigs.map((s) => s.signature),
    { commitment: "confirmed", maxSupportedTransactionVersion: 0 },
  );
  return sigs.map((s, i) => {
    const tx = txs[i];
    const names = (tx?.meta?.logMessages ?? [])
      .map((l) => /^Program log: Instruction: (\w+)$/.exec(l)?.[1])
      .filter((n): n is string => !!n && n in ACTION);
    const unique = [...new Set(names)];
    return {
      signature: s.signature,
      at: s.blockTime ?? 0,
      ok: s.err === null,
      what: unique.length
        ? unique.map((n, k) => (k === 0 ? ACTION[n] : ACTION[n][0].toLowerCase() + ACTION[n].slice(1))).join(", then ")
        : "Transaction",
      signer: tx?.transaction.message.staticAccountKeys[0] ?? null,
    };
  });
}

export function ActivityPanel({ deal }: { deal: DealView }) {
  const { connection } = useConnection();
  const address = deal.address.toBase58();
  const { data, isLoading, isError } = useQuery({
    // The deal's own data (settledCount, status) is in the key so the list refreshes after each move.
    queryKey: ["activity", address, deal.status, deal.settledCount, deal.milestones.map((m) => m.status).join()],
    queryFn: () => fetchActivity(connection, deal.address),
    staleTime: 10_000,
  });

  const who = (signer: PublicKey | null) => {
    if (!signer) return "";
    const role = roleIn(deal, signer);
    return role === "stranger" ? "a passer-by" : `the ${ROLE_LABEL[role].toLowerCase()}`;
  };

  return (
    <section aria-labelledby="record" className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="max-w-[62ch] space-y-1">
          <h2 id="record" className="text-body font-semibold text-ink">
            On the public record
          </h2>
          <p className="text-sm text-ink-soft">
            Every step of this deal is a Solana transaction. You do not have to trust this page: open
            any of them on Solana Explorer, or look at the vault to see the money sitting there.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ExplorerButton address={vaultPda(deal.address)}>See the vault</ExplorerButton>
          <ExplorerButton address={deal.address}>See the deal account</ExplorerButton>
        </div>
      </div>

      {isLoading ? (
        <p className="flex items-center gap-2 text-sm text-ink-soft">
          <Spinner /> Reading the transactions from Solana…
        </p>
      ) : isError || !data ? (
        <p className="text-sm text-ink-soft">
          Could not read the history right now. The deal account on Solana Explorer has it.
        </p>
      ) : data.length === 0 ? (
        <p className="text-sm text-ink-soft">No transactions found yet.</p>
      ) : (
        <ol className="ledger border-y border-rule">
          {data.map((a) => (
            <li
              key={a.signature}
              className="grid gap-x-4 gap-y-0.5 py-2.5 text-sm sm:grid-cols-[8.5rem_minmax(0,1fr)_auto] sm:items-baseline"
            >
              <span className="tnum text-ink-soft">{formatDateTime(a.at)}</span>
              <span className="min-w-0">
                <span className={a.ok ? "font-medium text-ink" : "font-medium text-void"}>
                  {a.ok ? a.what : `Failed: ${a.what.toLowerCase()}`}
                </span>
                {a.signer && (
                  <span className="text-ink-soft">
                    {" "}
                    · signed by {who(a.signer)}{" "}
                    <span className="tnum" title={a.signer.toBase58()}>
                      ({shortAddress(a.signer)})
                    </span>
                  </span>
                )}
              </span>
              <TxLink signature={a.signature} className="justify-self-start sm:justify-self-end">
                Verify
              </TxLink>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
