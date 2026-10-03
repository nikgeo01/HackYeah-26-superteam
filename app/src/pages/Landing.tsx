import { Link } from "react-router-dom";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { FaucetButton } from "../components/FaucetButton";
import { useActor } from "../providers/ActorProvider";
import { useBalances } from "../hooks/useBalances";
import { formatAmount, formatSol, shortAddress } from "../lib/format";

// Placeholder landing page (PLAN 4.1). Filled in by WP-22.
export default function Landing() {
  const { actor } = useActor();
  const balances = useBalances(actor?.publicKey);

  return (
    <div className="space-y-6">
      <section className="space-y-2">
        <h1 className="text-3xl font-bold">
          Get paid for every milestone, without a platform in the middle.
        </h1>
        <p className="text-slate-700">
          For freelance developers and the clients who hire them. The payment is
          locked when the work starts. If the client says nothing after you
          deliver, you are paid automatically.
        </p>
      </section>
      <section className="flex flex-wrap items-center gap-3">
        {!actor && <WalletMultiButton />}
        <FaucetButton />
        <Link
          to="/how"
          className="text-sm font-medium text-indigo-700 underline"
        >
          How it works and its limits
        </Link>
      </section>
      {actor && (
        <p className="text-sm text-slate-600">
          Acting as <strong>{actor.label}</strong> (
          {shortAddress(actor.publicKey)})
          {balances.data && (
            <>
              {" "}
              · {formatAmount(balances.data.tusdc)} ·{" "}
              {formatSol(balances.data.lamports)}
            </>
          )}
        </p>
      )}
    </div>
  );
}
