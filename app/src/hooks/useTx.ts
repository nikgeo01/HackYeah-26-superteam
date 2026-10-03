// Send transactions as the active actor, with toasts and cache refresh. Pages call this.
import { useCallback, useState } from "react";
import { useConnection } from "@solana/wallet-adapter-react";
import { useQueryClient } from "@tanstack/react-query";
import { useActor } from "../providers/ActorProvider";
import { useTxToasts } from "../providers/TxToastProvider";
import { COPY, explainError, type ExplainedError } from "../lib/errors";
import {
  errorLogs,
  sendAllSequential,
  sendInstructions,
  type TxSpec,
} from "../lib/tx";

/** A spec, or a function that builds one (run after the toast appears, so build errors are shown too). */
export type SpecOrBuilder = TxSpec | (() => Promise<TxSpec>);

export interface UseTx {
  /** Sends one transaction. Resolves to the signature, or null on failure (the toast shows why). */
  send: (label: string, spec: SpecOrBuilder) => Promise<string | null>;
  /** Signs several transactions in one prompt and sends them in order. Null on failure. */
  sendAll: (
    label: string,
    specs: TxSpec[] | (() => Promise<TxSpec[]>),
  ) => Promise<string[] | null>;
  /** True while a send started by this hook is in flight. */
  busy: boolean;
  /** The last failure from this hook, for inline display. */
  lastError: ExplainedError | null;
}

export function useTx(): UseTx {
  const { connection } = useConnection();
  const { actor } = useActor();
  const toasts = useTxToasts();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [lastError, setLastError] = useState<ExplainedError | null>(null);

  const run = useCallback(
    async <R>(
      label: string,
      body: (id: number) => Promise<R>,
      sigsOf: (r: R) => string[],
    ): Promise<R | null> => {
      const id = toasts.start(label);
      setBusy(true);
      setLastError(null);
      try {
        if (!actor) throw new Error(COPY.noWallet);
        const result = await body(id);
        toasts.confirm(id, sigsOf(result));
        return result;
      } catch (err) {
        console.error(label, err);
        const explained = !actor
          ? {
              ...explainError(err),
              kind: "noWallet" as const,
              message: COPY.noWallet,
            }
          : explainError(err, await errorLogs(err, connection));
        toasts.fail(id, explained);
        setLastError(explained);
        return null;
      } finally {
        setBusy(false);
        // Something may have changed on-chain even on failure; refresh deals and balances.
        void queryClient.invalidateQueries();
      }
    },
    [actor, connection, toasts, queryClient],
  );

  const send = useCallback(
    (label: string, spec: SpecOrBuilder) =>
      run(
        label,
        async () => {
          const resolved = typeof spec === "function" ? await spec() : spec;
          return sendInstructions(connection, actor!, resolved);
        },
        (sig) => [sig],
      ),
    [run, connection, actor],
  );

  const sendAll = useCallback(
    (label: string, specs: TxSpec[] | (() => Promise<TxSpec[]>)) =>
      run(
        label,
        async (id) => {
          const resolved = typeof specs === "function" ? await specs() : specs;
          return sendAllSequential(connection, actor!, resolved, (sig) =>
            toasts.addSignature(id, sig),
          );
        },
        (sigs) => sigs,
      ),
    [run, connection, actor, toasts],
  );

  return { send, sendAll, busy, lastError };
}
