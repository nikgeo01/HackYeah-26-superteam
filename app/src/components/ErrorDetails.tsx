import type { ExplainedError } from "../lib/errors";
import { ReceiptLink } from "./ReceiptLink";

/** Plain message, optional receipt, and the raw text behind a collapsible "Details" (PLAN 4.6). */
export function ErrorDetails({ error }: { error: ExplainedError }) {
  return (
    <div className="space-y-1">
      <p>{error.message}</p>
      {error.signature && (
        <ReceiptLink signature={error.signature}>
          View the failed transaction
        </ReceiptLink>
      )}
      <details className="text-xs text-slate-500">
        <summary className="cursor-pointer select-none">Details</summary>
        <pre className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap break-all rounded bg-slate-100 p-2">
          {error.code ? `${error.code}\n\n` : ""}
          {error.details}
        </pre>
      </details>
    </div>
  );
}

/** A full-width error banner. */
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
      className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900"
    >
      <div className="flex-1">
        <ErrorDetails error={error} />
      </div>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          className="text-red-700 hover:text-red-900"
          aria-label="Dismiss"
        >
          ×
        </button>
      )}
    </div>
  );
}
