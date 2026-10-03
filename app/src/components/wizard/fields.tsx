// Small form building blocks for the create-deal wizard.
import type { ReactNode } from "react";
import { formatDuration } from "../../lib/format";
import {
  durationSecs,
  TIME_UNITS,
  type DurationDraft,
  type TimeUnit,
} from "./model";

export const inputClass = (invalid: boolean) =>
  `w-full rounded-md border bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 ${
    invalid
      ? "border-red-400 focus:ring-red-300"
      : "border-slate-300 focus:ring-indigo-300"
  }`;

export function Field({
  label,
  hint,
  error,
  htmlFor,
  children,
}: {
  label: ReactNode;
  hint?: ReactNode;
  error?: string;
  htmlFor?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1">
      <label htmlFor={htmlFor} className="block text-sm font-medium">
        {label}
      </label>
      {children}
      {error ? (
        <p className="text-xs text-red-700">{error}</p>
      ) : (
        hint && <p className="text-xs text-slate-500">{hint}</p>
      )}
    </div>
  );
}

/** A number plus a unit (seconds, minutes, hours, days), with the result in words. */
export function DurationInput({
  id,
  value,
  onChange,
  invalid,
}: {
  id: string;
  value: DurationDraft;
  onChange: (next: DurationDraft) => void;
  invalid: boolean;
}) {
  const secs = durationSecs(value);
  return (
    <div className="flex items-center gap-2">
      <input
        id={id}
        inputMode="decimal"
        value={value.value}
        onChange={(e) => onChange({ ...value, value: e.target.value })}
        className={`${inputClass(invalid)} max-w-28`}
      />
      <select
        aria-label="Unit"
        value={value.unit}
        onChange={(e) =>
          onChange({ ...value, unit: e.target.value as TimeUnit })
        }
        className="rounded-md border border-slate-300 bg-white px-2 py-2 text-sm"
      >
        {TIME_UNITS.map((u) => (
          <option key={u} value={u}>
            {u}
          </option>
        ))}
      </select>
      {secs !== null && !invalid && (
        <span className="text-xs text-slate-500">{formatDuration(secs)}</span>
      )}
    </div>
  );
}

export function Button({
  children,
  variant = "secondary",
  className = "",
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "link";
}) {
  const styles = {
    primary:
      "rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700",
    secondary:
      "rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-800 hover:bg-slate-50",
    link: "text-sm font-medium text-indigo-700 underline underline-offset-2 hover:text-indigo-900",
  }[variant];
  return (
    <button
      type="button"
      className={`${styles} disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
