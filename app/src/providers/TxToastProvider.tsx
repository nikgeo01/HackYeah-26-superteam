// Transaction toasts (PLAN 4.2): pending, confirmed, failed, each with a receipt link.
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { ExplainedError } from "../lib/errors";
import { TxToastList } from "../components/TxToast";

export type ToastStatus = "pending" | "confirmed" | "failed";

export interface Toast {
  id: number;
  /** What the user did, in plain words ("Approve and pay"). */
  label: string;
  status: ToastStatus;
  /** Receipt signatures (several for a multi-transaction send). */
  signatures: string[];
  error?: ExplainedError;
}

export interface TxToastApi {
  toasts: Toast[];
  /** Adds a pending toast and returns its id. */
  start: (label: string) => number;
  /** Adds a receipt to a toast without changing its status. */
  addSignature: (id: number, signature: string) => void;
  confirm: (id: number, signatures?: string[]) => void;
  fail: (id: number, error: ExplainedError) => void;
  dismiss: (id: number) => void;
}

const TxToastContext = createContext<TxToastApi | null>(null);
const AUTO_DISMISS_MS = 15_000;

export function TxToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);

  const update = useCallback((id: number, patch: (t: Toast) => Toast) => {
    setToasts((all) => all.map((t) => (t.id === id ? patch(t) : t)));
  }, []);

  const dismiss = useCallback(
    (id: number) => setToasts((all) => all.filter((t) => t.id !== id)),
    [],
  );

  const start = useCallback((label: string) => {
    const id = nextId.current++;
    setToasts((all) => [
      ...all,
      { id, label, status: "pending", signatures: [] },
    ]);
    return id;
  }, []);

  const addSignature = useCallback(
    (id: number, signature: string) =>
      update(id, (t) =>
        t.signatures.includes(signature)
          ? t
          : { ...t, signatures: [...t.signatures, signature] },
      ),
    [update],
  );

  const confirm = useCallback(
    (id: number, signatures: string[] = []) => {
      update(id, (t) => ({
        ...t,
        status: "confirmed",
        signatures: [
          ...t.signatures,
          ...signatures.filter((s) => !t.signatures.includes(s)),
        ],
      }));
      setTimeout(() => dismiss(id), AUTO_DISMISS_MS);
    },
    [update, dismiss],
  );

  const fail = useCallback(
    (id: number, error: ExplainedError) =>
      update(id, (t) => ({
        ...t,
        status: "failed",
        error,
        signatures:
          error.signature && !t.signatures.includes(error.signature)
            ? [...t.signatures, error.signature]
            : t.signatures,
      })),
    [update],
  );

  const value = useMemo(
    () => ({ toasts, start, addSignature, confirm, fail, dismiss }),
    [toasts, start, addSignature, confirm, fail, dismiss],
  );

  return (
    <TxToastContext.Provider value={value}>
      {children}
      <TxToastList toasts={toasts} onDismiss={dismiss} />
    </TxToastContext.Provider>
  );
}

export function useTxToasts(): TxToastApi {
  const ctx = useContext(TxToastContext);
  if (!ctx)
    throw new Error("useTxToasts must be used inside <TxToastProvider>");
  return ctx;
}
