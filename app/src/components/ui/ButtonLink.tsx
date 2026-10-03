// A router link that looks like a Button (see ui/index.tsx). Use it when the action navigates.
import { Link, type LinkProps } from "react-router-dom";

type Kind = "act" | "plain" | "quiet";

const KIND: Record<Kind, string> = {
  act: "bg-stamp text-sheet hover:bg-stamp-deep border border-stamp",
  plain: "bg-sheet text-ink border border-ink/70 hover:bg-ground",
  quiet: "bg-transparent text-ink-soft border border-transparent hover:text-ink hover:bg-ground",
};

export function ButtonLink({
  kind = "plain",
  size = "md",
  className = "",
  ...rest
}: LinkProps & { kind?: Kind; size?: "md" | "lg" }) {
  return (
    <Link
      {...rest}
      className={`inline-flex items-center justify-center gap-2 rounded-[var(--radius-control)] font-semibold transition-colors ${
        size === "lg" ? "px-5 py-3 text-lead" : "px-3.5 py-2 text-sm"
      } ${KIND[kind]} ${className}`}
    />
  );
}
