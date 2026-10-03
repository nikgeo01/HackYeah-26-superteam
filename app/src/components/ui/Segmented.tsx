// A quiet segmented control: one choice out of a few, shown as a row of pressed/unpressed segments.
import type { ReactNode } from "react";

export interface Segment<T extends string> {
  id: T;
  label: ReactNode;
  /** Optional count shown after the label. */
  count?: number;
}

export function Segmented<T extends string>({
  label,
  segments,
  value,
  onChange,
  className = "",
}: {
  /** Accessible name of the group, e.g. "Show deals where". */
  label: string;
  segments: Segment<T>[];
  value: T;
  onChange: (id: T) => void;
  className?: string;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className={`inline-flex max-w-full flex-wrap gap-0.5 rounded-[var(--radius-control)] border border-rule bg-ground/70 p-0.5 ${className}`}
    >
      {segments.map((s) => {
        const on = s.id === value;
        return (
          <button
            key={s.id}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(s.id)}
            className={`inline-flex items-baseline gap-1.5 rounded-[4px] px-2.5 py-1.5 sm:px-3 text-sm transition-colors ${
              on
                ? "border border-rule bg-sheet font-semibold text-ink"
                : "border border-transparent text-ink-soft hover:text-ink"
            }`}
          >
            {s.label}
            {s.count !== undefined && (
              <span className={`figures text-micro ${on ? "text-ink-soft" : "text-ink-soft/80"}`}>
                {s.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
