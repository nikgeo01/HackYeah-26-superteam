import { DEMO_SECURITY_NOTE } from "../lib/actors";
import { DEMO_MODE } from "../lib/env";

/** The demo-mode security note (ADR-10). Renders nothing outside demo mode. */
export function DemoNote({ className = "" }: { className?: string }) {
  if (!DEMO_MODE) return null;
  return (
    <p className={`max-w-[70ch] text-micro text-ink-soft ${className}`}>
      <strong className="font-semibold text-ink">Demo mode.</strong> {DEMO_SECURITY_NOTE}
    </p>
  );
}

/** Permanent reminder that nothing here is real money. Plain text, not a badge. */
export function DevnetChip() {
  return (
    <span className="whitespace-nowrap text-micro text-ink-soft" title="Solana devnet">
      on devnet, with test money
    </span>
  );
}
