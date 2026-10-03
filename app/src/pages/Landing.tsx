// Landing (PLAN 4.1): one-sentence pitch, who it is for, connect, test dollars, next steps.
import { Link } from "react-router-dom";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { FaucetButton } from "../components/FaucetButton";
import { useActor } from "../providers/ActorProvider";
import { useBalances } from "../hooks/useBalances";
import { formatAmount, formatSol, shortAddress } from "../lib/format";
import { DEMO_MODE } from "../lib/env";

const STEPS: [string, string][] = [
  [
    "The client locks the payment",
    "All milestones are paid into a vault up front. No person holds a key to it.",
  ],
  [
    "The freelancer delivers",
    "Each milestone has a due time. Deliver by sharing a link, or by opening a pull request.",
  ],
  [
    "Silence pays",
    "The client approves or objects within a fixed time. If they say nothing, the freelancer is paid.",
  ],
  [
    "Objections cost a deposit",
    "Three arbiters chosen at the start vote. They can never take the money. No decision in time means a 50/50 split.",
  ],
];

const linkClass =
  "rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50";

export default function Landing() {
  const { actor } = useActor();
  const balances = useBalances(actor?.publicKey);

  return (
    <div className="space-y-10">
      <section className="space-y-4 pt-4">
        <h1 className="max-w-3xl text-3xl font-bold leading-tight sm:text-4xl">
          Get paid for every milestone, without a platform in the middle.
        </h1>
        <p className="max-w-3xl text-lg text-slate-700">
          Kept is milestone escrow for freelance developers and their clients:
          the payment is locked when the work starts, the rules for releasing
          it are public and fixed, and no company holds the money or can change
          the rules.
        </p>
      </section>

      <section className="max-w-3xl rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Who it is for
        </h2>
        <p className="mt-2 text-slate-800">
          Kasia is a freelance developer in Kraków. Her new client is a startup
          in another country that she has never met. If she delivers first,
          they could take the code and not pay. If they pay first, she could
          disappear. Neither can realistically take the other to court. With
          Kept, the client locks the money first, and clear timers decide what
          happens next, so neither has to trust the other or a platform taking
          a cut.
        </p>
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          {!actor && <WalletMultiButton />}
          <FaucetButton className="px-4 py-2" />
          <Link
            to="/new"
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700"
          >
            Create a deal
          </Link>
          <Link to="/deals" className={linkClass}>
            My deals
          </Link>
          <Link to="/how" className={linkClass}>
            How it works and its limits
          </Link>
          {DEMO_MODE && (
            <Link to="/demo" className={linkClass}>
              Demo roles
            </Link>
          )}
        </div>
        {actor ? (
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
        ) : (
          <p className="text-sm text-slate-600">
            Connect a wallet{DEMO_MODE ? " or pick a demo role in the header" : ""}
            , then get free test dollars to try it. Everything here runs on
            Solana devnet with test money.
          </p>
        )}
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {STEPS.map(([title, text], i) => (
          <div
            key={title}
            className="rounded-lg border border-slate-200 bg-white p-4"
          >
            <p className="text-xs font-semibold text-indigo-600">
              Step {i + 1}
            </p>
            <h3 className="mt-1 font-semibold">{title}</h3>
            <p className="mt-1 text-sm text-slate-600">{text}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
