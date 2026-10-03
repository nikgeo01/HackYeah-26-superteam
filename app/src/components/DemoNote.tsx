import { DEMO_SECURITY_NOTE } from "../lib/actors";
import { DEMO_MODE } from "../lib/env";

/** The demo-mode security note (ADR-10). Renders nothing outside demo mode. */
export function DemoNote({ className = "" }: { className?: string }) {
  if (!DEMO_MODE) return null;
  return (
    <p
      className={`rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 ${className}`}
    >
      <strong>Demo mode.</strong> {DEMO_SECURITY_NOTE}
    </p>
  );
}

/** Permanent header chip. */
export function DevnetChip() {
  return (
    <span className="whitespace-nowrap rounded-full bg-yellow-100 px-2.5 py-0.5 text-xs font-semibold text-yellow-900 ring-1 ring-yellow-300">
      Devnet: test money only
    </span>
  );
}
