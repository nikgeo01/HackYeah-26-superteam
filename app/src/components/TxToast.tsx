// Transaction receipts: each toast is a slip torn off the ledger, stacked bottom-right, away from
// the left-aligned action buttons.
import type { Toast } from "../providers/TxToastProvider";
import { ErrorDetails } from "./ErrorDetails";
import { ExplorerButton } from "./ExplorerButton";
import { Spinner } from "./ui";

const STATUS_TEXT: Record<Toast["status"], string> = {
  pending: "Sending to Solana devnet",
  confirmed: "Confirmed on Solana devnet. Anyone can check it on the public record.",
  failed: "Did not go through.",
};

/** The torn top edge of a slip: a row of teeth, drawn twice (rule colour, then sheet 1px lower). */
const teeth = (colour: string) => ({
  backgroundImage: `linear-gradient(135deg, ${colour} 5px, transparent 0), linear-gradient(225deg, ${colour} 5px, transparent 0)`,
  backgroundSize: "10px 10px",
  backgroundPosition: "left bottom",
  backgroundRepeat: "repeat-x",
});
const TORN_RULE = teeth("var(--color-rule)");
const TORN_SHEET = teeth("var(--color-sheet)");

/** One transaction toast: pending, confirmed or failed, with receipt links. */
export function TxToast({
  toast,
  onDismiss,
}: {
  toast: Toast;
  onDismiss: () => void;
}) {
  const failed = toast.status === "failed";
  return (
    <div
      role={failed ? "alert" : "status"}
      className={`relative mt-[9px] w-80 max-w-[calc(100vw-2rem)] rounded-b-[var(--radius-control)] border-x border-b bg-sheet px-4 pb-3 pt-2.5 text-sm ${
        failed ? "border-void/70" : "border-rule"
      }`}
    >
      <span aria-hidden className="absolute inset-x-[-1px] -top-[9px] h-[10px]" style={TORN_RULE} />
      <span aria-hidden className="absolute inset-x-0 -top-[8px] h-[10px]" style={TORN_SHEET} />
      {failed && <span aria-hidden className="absolute inset-y-0 left-[-1px] w-[3px] bg-void" />}
      <div className="flex items-start justify-between gap-2">
        <p className="font-semibold leading-snug text-ink">{toast.label}</p>
        <button
          type="button"
          onClick={onDismiss}
          className="-mr-1.5 -mt-0.5 rounded-[var(--radius-tag)] px-1.5 text-lead leading-none text-ink-soft hover:text-ink"
          aria-label="Dismiss"
        >
          ×
        </button>
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
        <span
          className={`inline-flex items-center gap-2 ${
            failed ? "font-medium text-void" : "text-ink-soft"
          }`}
        >
          {toast.status === "pending" && <Spinner className="text-ink-soft" />}
          {STATUS_TEXT[toast.status]}
        </span>
      </div>
      {toast.signatures.length > 0 && !failed && (
        <div className="mt-2.5 flex flex-wrap gap-2">
          {toast.signatures.map((sig, i) => (
            <ExplorerButton
              key={sig}
              signature={sig}
              kind={toast.status === "confirmed" ? "act" : "plain"}
            >
              {toast.signatures.length > 1
                ? `Verify transaction ${i + 1}`
                : "Verify on Solana Explorer"}
            </ExplorerButton>
          ))}
        </div>
      )}
      {failed && toast.error && (
        <div className="mt-2 border-t border-dashed border-rule pt-2">
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
    <div
      className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-2"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      {toasts.map((t) => (
        <TxToast key={t.id} toast={t} onDismiss={() => onDismiss(t.id)} />
      ))}
    </div>
  );
}
