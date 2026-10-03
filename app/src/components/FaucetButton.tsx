import { useActor } from "../providers/ActorProvider";
import { useTx } from "../hooks/useTx";
import {
  faucetTxSpec,
  faucetUnavailableReason,
  FAUCET_AMOUNT,
} from "../lib/faucet";
import { formatAmount } from "../lib/format";

/** Mints 1,000 test dollars to the active actor. The actor pays the (tiny) network fee. */
export function FaucetButton({ className = "" }: { className?: string }) {
  const { actor } = useActor();
  const { send, busy } = useTx();
  const unavailable = faucetUnavailableReason();
  const disabled = busy || !actor || unavailable !== null;
  const title =
    unavailable ??
    (!actor
      ? "Connect a wallet first."
      : `Adds ${formatAmount(FAUCET_AMOUNT)} to this account.`);

  return (
    <button
      type="button"
      disabled={disabled}
      title={title}
      onClick={() =>
        actor && void send("Get test dollars", faucetTxSpec(actor.publicKey))
      }
      className={`rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
    >
      {busy ? "Sending…" : "Get test dollars"}
    </button>
  );
}
