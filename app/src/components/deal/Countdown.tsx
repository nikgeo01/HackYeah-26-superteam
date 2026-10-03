// Countdowns on chain time (PLAN 4.5). `now` comes from useChainNow() on the page.
import { formatCountdown, formatDateTime } from "../../lib/format";

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
      {formatCountdown(deadline - now)}
    </time>
  );
}
