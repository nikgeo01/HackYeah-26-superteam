import type { Toast } from "../providers/TxToastProvider";
import { ErrorDetails } from "./ErrorDetails";
import { ReceiptLink } from "./ReceiptLink";

const STYLE: Record<Toast["status"], string> = {
  pending: "border-slate-200 bg-white",
  confirmed: "border-emerald-300 bg-emerald-50",
  failed: "border-red-300 bg-red-50",
};

const STATUS_TEXT: Record<Toast["status"], string> = {
  pending: "Waiting for the network…",
  confirmed: "Done.",
  failed: "Did not go through.",
};

/** One transaction toast: pending, confirmed or failed, with receipt links. */
export function TxToast({
  toast,
  onDismiss,
}: {
  toast: Toast;
  onDismiss: () => void;
}) {
  return (
    <div
      role="status"
      className={`w-80 rounded-lg border p-3 text-sm shadow-lg ${STYLE[toast.status]}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="font-semibold">{toast.label}</div>
        <button
          type="button"
          onClick={onDismiss}
          className="text-slate-400 hover:text-slate-700"
          aria-label="Dismiss"
        >
          ×
        </button>
      </div>
      <div className="mt-1 flex items-center gap-2 text-slate-700">
        {toast.status === "pending" && (
          <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-slate-300 border-t-slate-700" />
        )}
        <span>{STATUS_TEXT[toast.status]}</span>
      </div>
      {toast.signatures.length > 0 && toast.status !== "failed" && (
        <div className="mt-1 flex flex-wrap gap-x-3">
          {toast.signatures.map((sig, i) => (
            <ReceiptLink key={sig} signature={sig}>
              {toast.signatures.length > 1
                ? `Receipt ${i + 1}`
                : "View receipt"}
            </ReceiptLink>
          ))}
        </div>
      )}
      {toast.status === "failed" && toast.error && (
        <div className="mt-2 text-red-900">
          <ErrorDetails error={toast.error} />
        </div>
      )}
    </div>
  );
}

export function TxToastList({
  toasts,
  onDismiss,
}: {
  toasts: Toast[];
  onDismiss: (id: number) => void;
}) {
  if (toasts.length === 0) return null;
  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map((t) => (
        <TxToast key={t.id} toast={t} onDismiss={() => onDismiss(t.id)} />
      ))}
    </div>
  );
}
