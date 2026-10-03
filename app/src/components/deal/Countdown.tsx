// Countdowns on chain time (PLAN 4.5). `now` comes from useChainNow() on the page.
import { formatCountdown, formatDateTime } from "../../lib/format";

/** Inline "mm:ss" until `deadline`, with the absolute time as a tooltip. */
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
      className={`font-mono tabular-nums ${className}`}
    >
      {formatCountdown(deadline - now)}
    </time>
  );
}

/** A labelled countdown with a progress bar over a window of `windowSecs`. */
export function TimerBar({
  label,
  deadline,
  windowSecs,
  now,
  tone = "indigo",
}: {
  label: string;
  deadline: number;
  windowSecs: number;
  now: number;
  tone?: "indigo" | "amber" | "slate";
}) {
  const left = Math.max(0, deadline - now);
  const pct =
    windowSecs > 0 ? Math.min(100, (1 - left / windowSecs) * 100) : 100;
  const bar = {
    indigo: "bg-indigo-500",
    amber: "bg-amber-500",
    slate: "bg-slate-500",
  }[tone];
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span className="text-slate-600">{label}</span>
        <Countdown
          deadline={deadline}
          now={now}
          className="text-base font-semibold text-slate-900"
        />
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-slate-200">
        <div
          className={`h-full rounded-full transition-[width] duration-1000 ease-linear ${bar}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
