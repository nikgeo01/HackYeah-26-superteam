// Ledger-style form building blocks for the create-deal wizard (see app/DESIGN.md).
import type { ReactNode } from "react";
import { formatDuration } from "../../lib/format";
import {
  durationSecs,
  TIME_UNITS,
  type DurationDraft,
  type TimeUnit,
} from "./model";

const cx = (...parts: (string | false | null | undefined)[]) =>
  parts.filter(Boolean).join(" ");

/** Sheet ground, rule border, ink when focused, void when wrong. The focus ring is stamp. */
export const inputClass = (invalid: boolean) =>
  cx(
    "w-full min-w-0 rounded-[var(--radius-control)] border bg-sheet px-3 py-2 text-body text-ink",
    "placeholder:text-ink-soft/55 focus:border-ink",
    invalid ? "border-void" : "border-rule hover:border-ink/40",
  );

/** A label above the control in sentence case; help (ink-soft) or a fix-it error (void) under it. */
export function Field({
  label,
  hint,
  error,
  htmlFor,
  children,
  className,
}: {
  label: ReactNode;
  hint?: ReactNode;
  error?: string;
  htmlFor?: string;
  children: ReactNode;
  className?: string;
}) {
  const noteId = htmlFor ? `${htmlFor}-note` : undefined;
  return (
    <div className={cx("space-y-1.5", className)}>
      <label htmlFor={htmlFor} className="block text-sm font-semibold text-ink">
        {label}
      </label>
      {children}
      {error ? (
        <p id={noteId} className="text-sm text-void">
          {error}
        </p>
      ) : (
        hint && (
          <p id={noteId} className="max-w-[60ch] text-sm text-ink-soft">
            {hint}
          </p>
        )
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
  // Only spell it out when the words add something ("90 minutes" -> "1 hour 30 minutes").
  const words = secs !== null && !invalid ? formatDuration(secs) : null;
  const echo = words && words !== `${value.value.trim()} ${value.unit}` && words !== `1 ${value.unit.replace(/s$/, "")}`;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex">
        <input
          id={id}
          inputMode="decimal"
          value={value.value}
          aria-invalid={invalid || undefined}
          aria-describedby={`${id}-note`}
          onChange={(e) => onChange({ ...value, value: e.target.value })}
          className={cx(inputClass(invalid), "w-20 rounded-r-none")}
        />
        <select
          aria-label="Unit"
          value={value.unit}
          onChange={(e) => onChange({ ...value, unit: e.target.value as TimeUnit })}
          className="-ml-px rounded-r-[var(--radius-control)] border border-rule bg-ground/60 py-2 pl-2 pr-1 text-body text-ink hover:border-ink/40 focus:border-ink"
        >
          {TIME_UNITS.map((u) => (
            <option key={u} value={u}>
              {u}
            </option>
          ))}
        </select>
      </div>
      {echo && <span className="text-sm text-ink-soft">{words}</span>}
    </div>
  );
}

/** A section of a step: a heading and a short line of context, then its fields. */
export function Part({
  title,
  intro,
  children,
}: {
  title: string;
  intro?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="space-y-4 border-t border-rule-soft pt-6 first:border-t-0 first:pt-0">
      <div className="space-y-1">
        <h2 className="text-lead font-semibold leading-snug">{title}</h2>
        {intro && <p className="max-w-[62ch] text-sm text-ink-soft">{intro}</p>}
      </div>
      {children}
    </section>
  );
}
