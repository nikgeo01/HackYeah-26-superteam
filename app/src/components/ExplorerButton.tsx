import type { PublicKey } from "@solana/web3.js";
import { explorerAddressUrl, explorerTxUrl } from "../lib/format";

/** The "opens in a new tab" arrow. */
export function OutArrow({ className = "" }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 12 12" className={`h-3 w-3 shrink-0 ${className}`}>
      <path d="M4 2h6v6M10 2 3 9" fill="none" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

const KIND = {
  act: "bg-stamp text-sheet border border-stamp hover:bg-stamp-deep",
  plain: "bg-sheet text-ink border border-ink/70 hover:bg-ground",
} as const;

/**
 * A button-sized link to Solana Explorer (devnet), so anyone can check on the public record that
 * a transaction really happened. Pass a `signature` for one transaction, or an `address`.
 */
export function ExplorerButton({
  signature,
  address,
  children = "Verify on Solana Explorer",
  kind = "plain",
  className = "",
}: {
  signature?: string;
  address?: PublicKey | string;
  children?: React.ReactNode;
  kind?: keyof typeof KIND;
  className?: string;
}) {
  const href = signature ? explorerTxUrl(signature) : address ? explorerAddressUrl(address) : null;
  if (!href) return null;
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      title="Opens Solana Explorer, the public record of the network, in a new tab"
      className={`inline-flex items-center justify-center gap-2 rounded-[var(--radius-control)] px-3.5 py-2 text-sm font-semibold transition-colors ${KIND[kind]} ${className}`}
    >
      {children}
      <OutArrow />
    </a>
  );
}
