// Design-system primitives (see app/DESIGN.md). Every page builds on these instead of raw colours.
import type { ButtonHTMLAttributes, ReactNode } from "react";

const cx = (...parts: (string | false | null | undefined)[]) =>
  parts.filter(Boolean).join(" ");

/* ---------- Buttons ---------- */

export type ButtonKind = "act" | "plain" | "quiet" | "void";

const BUTTON: Record<ButtonKind, string> = {
  // The one action you can take: violet stamp ink.
  act: "bg-stamp text-sheet hover:bg-stamp-deep border border-stamp",
  // A secondary choice: ink outline.
  plain: "bg-sheet text-ink border border-ink/70 hover:bg-ground",
  // Low-emphasis (cancel, details).
  quiet:
    "bg-transparent text-ink-soft border border-transparent hover:text-ink hover:bg-ground",
  // Destructive confirmation only.
  void: "bg-void text-sheet border border-void hover:brightness-110",
};

export function Button({
  kind = "act",
  size = "md",
  className,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  kind?: ButtonKind;
  size?: "md" | "lg";
}) {
  return (
    <button
      type="button"
      {...rest}
      className={cx(
        "inline-flex items-center justify-center gap-2 rounded-[var(--radius-control)] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-45",
        size === "lg" ? "px-5 py-3 text-lead" : "px-3.5 py-2 text-sm",
        BUTTON[kind],
        className,
      )}
    />
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cx(
        "inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent",
        className,
      )}
    />
  );
}

/* ---------- Text and money ---------- */

/**
 * An amount: figures large and lining, the currency smaller and lighter.
 * Pass the already formatted number (from lib/format) and the symbol separately.
 */
export function Amount({
  value,
  symbol = "tUSDC",
  size = "md",
  className,
}: {
  value: string;
  symbol?: string;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}) {
  const sizes = {
    sm: "text-body font-semibold",
    md: "text-lead font-semibold",
    lg: "text-amount font-[650] tracking-[-0.02em] leading-none",
    xl: "text-display font-[650] tracking-[-0.03em] leading-none",
  } as const;
  return (
    <span className={cx("figures whitespace-nowrap", sizes[size], className)}>
      {value}
      <span className="ml-[0.25em] text-[0.45em] font-medium tracking-normal text-ink-soft align-[0.15em]">
        {symbol}
      </span>
    </span>
  );
}

/** Split "12.50 tUSDC" from lib/format into number and symbol for <Amount>. */
export function splitAmount(formatted: string): { value: string; symbol: string } {
  const i = formatted.lastIndexOf(" ");
  return i < 0
    ? { value: formatted, symbol: "" }
    : { value: formatted.slice(0, i), symbol: formatted.slice(i + 1) };
}

/* ---------- Tags ---------- */

export type TagTone = "ink" | "stamp" | "clock" | "void" | "soft";

const TAG: Record<TagTone, string> = {
  ink: "border-ink/60 text-ink",
  stamp: "border-stamp text-stamp bg-stamp-wash",
  clock: "border-clock text-clock bg-clock-wash",
  void: "border-void text-void bg-void-wash",
  soft: "border-rule text-ink-soft",
};

/** A small square-cornered status tag. Words carry the meaning; tone only supports it. */
export function Tag({
  tone = "ink",
  children,
  className,
}: {
  tone?: TagTone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 rounded-[var(--radius-tag)] border px-1.5 py-px text-micro font-semibold",
        TAG[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/* ---------- The stamp ---------- */

/**
 * The ink stamp for a settled outcome. `land` plays the landing animation once (only when the
 * settlement happened while the viewer was watching).
 */
export function Stamp({
  children,
  tone = "stamp",
  land = false,
  tilt = -6,
  className,
}: {
  children: ReactNode;
  tone?: "stamp" | "ink" | "clock";
  land?: boolean;
  tilt?: number;
  className?: string;
}) {
  const colour = {
    stamp: "text-stamp border-stamp",
    ink: "text-ink border-ink",
    clock: "text-clock border-clock",
  }[tone];
  return (
    <span
      role="img"
      aria-label={typeof children === "string" ? children : undefined}
      style={{ ["--stamp-tilt" as string]: `${tilt}deg`, transform: `rotate(${tilt}deg)` }}
      className={cx(
        "inline-block select-none rounded-[2px] border-[3px] p-[2px] uppercase",
        colour,
        land && "stamp-land",
        className,
      )}
    >
      <span className="block rounded-[1px] border border-current px-2.5 py-1 text-[0.8rem] font-extrabold leading-tight tracking-[0.08em] opacity-90 [mix-blend-mode:multiply]">
        {children}
      </span>
    </span>
  );
}

/* ---------- Surfaces ---------- */

/** The working surface that sits on the green ground. No shadow; depth is the colour step. */
export function Sheet({
  children,
  className,
  as: As = "section",
}: {
  children: ReactNode;
  className?: string;
  as?: "section" | "div" | "article" | "aside";
}) {
  return (
    <As
      className={cx(
        "rounded-[var(--radius-sheet)] border border-rule bg-sheet",
        className,
      )}
    >
      {children}
    </As>
  );
}

/** Ledger rows: label left, value right-aligned with lining figures, a ruling line between rows. */
export function Ledger({
  rows,
  className,
}: {
  rows: { label: ReactNode; value: ReactNode; key?: string }[];
  className?: string;
}) {
  return (
    <dl className={cx("ledger", className)}>
      {rows.map((r, i) => (
        <div
          key={r.key ?? i}
          className="flex items-baseline justify-between gap-4 py-2 text-sm"
        >
          <dt className="text-ink-soft">{r.label}</dt>
          <dd className="figures text-right font-medium text-ink">{r.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** A section heading inside a sheet: sentence case, no eyebrow. */
export function Heading({
  children,
  level = 2,
  className,
}: {
  children: ReactNode;
  level?: 1 | 2 | 3;
  className?: string;
}) {
  const sizes = {
    1: "text-heading font-[650] tracking-[-0.015em] leading-tight",
    2: "text-title font-semibold tracking-[-0.01em] leading-snug",
    3: "text-lead font-semibold leading-snug",
  } as const;
  const H = (`h${level}` as "h1" | "h2" | "h3");
  return <H className={cx(sizes[level], className)}>{children}</H>;
}

/* ---------- Notices ---------- */

export type NoticeTone = "info" | "move" | "clock" | "void";

/**
 * A notice box: a soft tint with a thin matching outline. "move" is reserved for "this is your
 * move" (stamp violet);
 * "clock" for time running out; "void" for errors.
 */
export function Notice({
  tone = "info",
  children,
  className,
}: {
  tone?: NoticeTone;
  children: ReactNode;
  className?: string;
}) {
  const tones = {
    info: "border-rule bg-ground/60 text-ink",
    move: "border-stamp/25 bg-stamp-wash text-ink",
    clock: "border-clock/30 bg-clock-wash text-ink",
    void: "border-void/35 bg-void-wash text-ink",
  } as const;
  return (
    <div
      className={cx(
        "rounded-[var(--radius-control)] border px-4 py-3 text-sm",
        tones[tone],
        className,
      )}
    >
      {children}
    </div>
  );
}

/* ---------- The milestone track ---------- */

export type NodeState = "open" | "progress" | "decided" | "settled" | "dead";

/** A node on the vertical milestone track. Fill shows how far the milestone has got. */
export function TrackNode({ state, label }: { state: NodeState; label?: string }) {
  const body = {
    open: "bg-sheet border-ink/50",
    progress: "bg-[linear-gradient(90deg,var(--color-ink)_50%,var(--color-sheet)_50%)] border-ink",
    decided: "bg-ink border-ink",
    settled: "bg-stamp border-stamp",
    dead: "bg-rule border-rule",
  }[state];
  return (
    <span
      aria-label={label}
      className={cx("relative z-10 block h-4 w-4 shrink-0 rounded-full border-2", body)}
    />
  );
}

/**
 * Phases of a milestone as a horizontal run: done phases solid, the current one highlighted,
 * future ones faint. `progress` (0..1) fills the current phase, e.g. the review clock.
 */
export function PhaseRun({
  phases,
  current,
  progress,
  urgent = false,
}: {
  phases: string[];
  current: number;
  progress?: number;
  urgent?: boolean;
}) {
  return (
    <ol className="flex w-full flex-wrap items-center gap-x-1 gap-y-1 text-micro">
      {phases.map((p, i) => {
        const done = i < current;
        const now = i === current;
        return (
          <li key={p} className="flex min-w-0 flex-1 flex-col gap-1" aria-current={now ? "step" : undefined}>
            <span
              className={cx(
                "truncate",
                done && "text-ink",
                now && (urgent ? "font-semibold text-clock" : "font-semibold text-ink"),
                !done && !now && "text-ink-soft/70",
              )}
            >
              {p}
            </span>
            <span className="relative block h-[3px] overflow-hidden rounded-full bg-rule-soft">
              <span
                className={cx(
                  "absolute inset-y-0 left-0 rounded-full",
                  done && "w-full bg-ink",
                  now && (urgent ? "bg-clock" : "bg-ink"),
                )}
                style={now ? { width: `${Math.round(Math.max(0.04, Math.min(1, progress ?? 0.5)) * 100)}%` } : undefined}
              />
            </span>
          </li>
        );
      })}
    </ol>
  );
}
