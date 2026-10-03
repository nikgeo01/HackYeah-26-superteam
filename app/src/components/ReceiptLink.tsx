import { explorerTxUrl } from "../lib/format";
import { OutArrow } from "./ExplorerButton";

/** "Receipt" link to the Solana Explorer transaction page (devnet). Opens in a new tab. */
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
      className={`font-medium text-ink underline decoration-ink/40 decoration-1 underline-offset-[3px] hover:text-stamp hover:decoration-stamp ${className}`}
      title={`Opens Solana Explorer in a new tab: ${signature}`}
    >
      {children}
      <OutArrow className="ml-1 inline-block align-[-1px]" />
    </a>
  );
}
