import { PROGRAM_ID } from "../lib/idl";
import { explorerAddressUrl } from "../lib/format";

// Placeholder for "How it works and limits" (PLAN 4.1). Filled in by WP-22 / WP-51.
export default function How() {
  return (
    <div className="space-y-3">
      <h1 className="text-2xl font-bold">How it works</h1>
      <ul className="list-disc space-y-1 pl-6 text-slate-700">
        <li>
          The client locks the payment for each milestone when the deal starts.
        </li>
        <li>
          If the client says nothing after delivery, the freelancer is paid.
          Anyone can release that payment.
        </li>
        <li>
          An objection costs the client a deposit. A panel of three arbiters
          decides; two matching votes settle it.
        </li>
        <li>
          If the arbiters do not decide in time, the payment is split 50/50.
        </li>
      </ul>
      <p className="text-sm">
        The rules are a Solana program:{" "}
        <a
          href={explorerAddressUrl(PROGRAM_ID)}
          target="_blank"
          rel="noreferrer"
          className="text-indigo-700 underline"
        >
          {PROGRAM_ID.toBase58()}
        </a>
      </p>
    </div>
  );
}
