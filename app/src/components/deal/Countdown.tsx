// Countdowns on chain time (PLAN 4.5). `now` comes from useChainNow() on the page.
import { formatCountdown, formatDateTime } from "../../lib/format";

/**
 * Clock text with tabular digits, but a proportional colon: this face's tabular colon is
 * figure-wide and reads as "00 : 41".
 */
export function ClockText({ text }: { text: string }) {
  const parts = text.split(":");
  return (
    <>
      {parts.map((p, i) => (
        <span key={i}>
          {i > 0 && <span className="[font-variant-numeric:normal]">:</span>}
          {p}
        </span>
      ))}
    </>
  );
}

/** Inline "mm:ss" until `deadline`, with the absolute time as a tooltip. Tabular digits, no jitter. */
export function Countdown({
  deadline,
  now,
  className = "",
}: {
  deadline: number;
  now: number;
  className?: string;
}) {
  return (
    <time
      dateTime={new Date(deadline * 1000).toISOString()}
      title={formatDateTime(deadline)}
      className={`tnum whitespace-nowrap ${className}`}
    >
      <ClockText text={formatCountdown(deadline - now)} />
    </time>
  );
}
