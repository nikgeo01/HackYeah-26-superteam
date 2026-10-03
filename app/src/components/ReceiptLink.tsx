import { explorerTxUrl } from "../lib/format";

/** "Receipt" link to the Solana Explorer transaction page (devnet). */
export function ReceiptLink({
  signature,
  children = "View receipt",
  className = "",
}: {
  signature: string;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <a
      href={explorerTxUrl(signature)}
      target="_blank"
      rel="noreferrer"
      className={`font-medium text-indigo-700 underline underline-offset-2 hover:text-indigo-900 ${className}`}
      title={signature}
    >
      {children}
    </a>
  );
}
