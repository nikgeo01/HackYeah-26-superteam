import type { ExplainedError } from "../lib/errors";
import { ReceiptLink } from "./ReceiptLink";

/** Plain message, optional receipt, and the raw text behind a collapsible "Details" (PLAN 4.6). */
export function ErrorDetails({ error }: { error: ExplainedError }) {
  return (
    <div className="space-y-1.5">
      <p className="text-ink">{error.message}</p>
      {error.signature && (
        <ReceiptLink signature={error.signature}>
          View the failed transaction
        </ReceiptLink>
      )}
      <details className="group text-micro text-ink-soft">
        <summary className="w-fit cursor-pointer select-none rounded-[var(--radius-tag)] font-medium hover:text-ink">
          Details
        </summary>
        <pre className="mt-1.5 max-h-48 overflow-auto whitespace-pre-wrap break-all rounded-[var(--radius-tag)] border border-rule-soft bg-ground/60 p-2 font-sans text-micro leading-snug text-ink">
          {error.code ? `${error.code}\n\n` : ""}
          {error.details}
        </pre>
      </details>
    </div>
  );
}

/** A full-width error band: void edge, plain message first. */
export function ErrorBanner({
  error,
  onClose,
}: {
  error: ExplainedError;
  onClose?: () => void;
}) {
  return (
    <div
      role="alert"
      className="flex items-start gap-3 rounded-r-[var(--radius-control)] border-l-4 border-l-void bg-void-wash px-4 py-3 text-sm"
    >
      <div className="min-w-0 flex-1">
        <ErrorDetails error={error} />
      </div>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          className="-mr-1 -mt-0.5 rounded-[var(--radius-tag)] px-1.5 text-lead leading-none text-ink-soft hover:text-ink"
          aria-label="Dismiss"
        >
          ×
        </button>
      )}
    </div>
  );
}
