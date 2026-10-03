import { useActor } from "../providers/ActorProvider";
import { useTx } from "../hooks/useTx";
import {
  faucetTxSpec,
  faucetUnavailableReason,
  FAUCET_AMOUNT,
} from "../lib/faucet";
import { formatAmount } from "../lib/format";
import { Button, Spinner, type ButtonKind } from "./ui";

/** Mints 1,000 test dollars to the active actor. The actor pays the (tiny) network fee. */
export function FaucetButton({
  className = "",
  kind = "plain",
}: {
  className?: string;
  kind?: ButtonKind;
}) {
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
    <Button
      kind={kind}
      disabled={disabled}
      title={title}
      aria-busy={busy || undefined}
      onClick={() =>
        actor && void send("Get test dollars", faucetTxSpec(actor.publicKey))
      }
      className={className}
    >
      {busy && <Spinner />}
      {busy ? "Getting test dollars" : "Get test dollars"}
    </Button>
  );
}
