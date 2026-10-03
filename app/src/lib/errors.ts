// Turns any failure into plain copy for Kasia (PLAN 4.6). Errors are matched by name, not number.
import { PROGRAM_ERRORS } from "./idl";
import { TxFailedError } from "./tx";

/** Plain copy for every `EscrowError` in the IDL. */
export const PROGRAM_ERROR_COPY: Record<string, string> = {
  InvalidMilestoneCount: "A deal needs between 1 and 5 milestones.",
  ZeroAmount: "Every milestone needs an amount above zero.",
  WindowOutOfBounds:
    "One of the time limits is too short or longer than a year.",
  DuplicateParty:
    "The client, the freelancer and the three arbiters must all be different people.",
  InvalidRepo: 'The repository must look like "owner/name".',
  InvalidProofTarget:
    "The pull request settings for this milestone are not valid.",
  DuplicateProofTarget:
    "This pull request is already linked to another milestone.",
  MathOverflow: "These amounts are too large.",
  NotClient: "Only the client can do this.",
  NotWorker: "Only the freelancer can do this.",
  NotJudge: "Only one of this deal's arbiters can vote.",
  NotParty: "Only the client or the freelancer can do this.",
  DealNotOpen: "This deal is no longer waiting to be accepted.",
  DealNotActive: "This deal is not in progress.",
  DealNotCancellable: "This deal can no longer be cancelled.",
  InvalidCancelArgument:
    "A deal that was never accepted can be cancelled, but a cancel request cannot be withdrawn.",
  AcceptWindowClosed: "The time to accept this deal is over.",
  InvalidMilestoneIndex: "This milestone does not exist.",
  InvalidMilestoneStatus:
    "This milestone has moved on. Refresh to see what changed.",
  SubmitWindowClosed: "The delivery deadline for this milestone has passed.",
  ReviewWindowClosed: "The review time is over. You can no longer object.",
  VoteWindowClosed: "The voting time is over.",
  AlreadyVoted: "You have already voted on this milestone.",
  AlreadyDecided: "The arbiters have already decided this milestone.",
  UriTooLong: "The link is too long (128 characters at most).",
  ProofTargetAlreadySet: "A pull request is already linked to this milestone.",
  NoProofTarget: "This milestone is not linked to a pull request.",
  ProofMalformed: "The GitHub proof is damaged or incomplete.",
  ProofIdentifierMismatch: "The proof is not about the agreed pull request.",
  ProofContextMismatch: "The proof was made for a different deal or milestone.",
  ProofSignatureInvalid: "The proof's signature does not check out.",
  ProofAttestorMismatch:
    "The proof was not signed by the attestor agreed in this deal.",
  AlreadySettled: "This milestone has already been paid out.",
  NothingToSettle: "Nothing to pay out yet.",
  MissingRecipientAccount:
    "A token account for the person being paid is missing. Try again.",
  DealNotFullySettled:
    "Every milestone must be paid out before the deal can be closed.",
};

export const COPY = {
  rejected: "You cancelled the request.",
  noSol: "This wallet needs a little test SOL for network fees.",
  noTokens: "Not enough test dollars. Use Get test dollars.",
  slow: "The network was slow. Check the receipt link before retrying.",
  noWallet: "Connect a wallet (or pick a demo role) first.",
  unknown: "Something went wrong.",
} as const;

export type ErrorKind =
  | "program"
  | "rejected"
  | "noSol"
  | "noTokens"
  | "slow"
  | "noWallet"
  | "unknown";

export interface ExplainedError {
  kind: ErrorKind;
  /** Plain message to show. */
  message: string;
  /** Program error name when known, e.g. "NothingToSettle". */
  code?: string;
  /** Raw text for a collapsible "Details". */
  details: string;
  /** Present when the transaction landed (receipt link even on failure). */
  signature?: string;
}

function rawText(err: unknown): string {
  if (err instanceof Error) {
    const logs = (err as { logs?: unknown }).logs;
    const extra =
      Array.isArray(logs) && logs.length
        ? `\n${(logs as string[]).join("\n")}`
        : "";
    return `${err.name}: ${err.message}${extra}`;
  }
  try {
    return typeof err === "string" ? err : JSON.stringify(err);
  } catch {
    return String(err);
  }
}

/** Finds the program error name in an Anchor error, logs or a "custom program error: 0x…". */
function programErrorName(err: unknown, text: string): string | undefined {
  const anchorCode = (
    err as { error?: { errorCode?: { code?: unknown } } } | null
  )?.error?.errorCode?.code;
  if (typeof anchorCode === "string" && anchorCode in PROGRAM_ERROR_COPY)
    return anchorCode;
  const named = /Error Code: (\w+)/.exec(text)?.[1];
  if (named && named in PROGRAM_ERROR_COPY) return named;
  for (const match of text.matchAll(/custom program error: 0x([0-9a-f]+)/gi)) {
    const name = PROGRAM_ERRORS.get(parseInt(match[1], 16));
    if (name) return name;
  }
  const custom = /"Custom":\s*(\d+)/.exec(text)?.[1];
  if (custom) {
    const name = PROGRAM_ERRORS.get(Number(custom));
    if (name) return name;
  }
  return undefined;
}

/** Maps any thrown value to plain copy plus raw details. Pass extra `logs` when available. */
export function explainError(
  err: unknown,
  logs: string[] = [],
): ExplainedError {
  const text = [rawText(err), ...logs].join("\n");
  const signature = err instanceof TxFailedError ? err.signature : undefined;
  const base = { details: text, signature };

  const code = programErrorName(err, text);
  if (code)
    return {
      ...base,
      kind: "program",
      code,
      message: PROGRAM_ERROR_COPY[code],
    };

  const name = err instanceof Error ? err.name : "";
  if (
    name === "WalletSignTransactionError" ||
    /user rejected|rejected the request|request rejected|user denied|declined/i.test(
      text,
    )
  ) {
    return { ...base, kind: "rejected", message: COPY.rejected };
  }
  if (
    name === "WalletNotConnectedError" ||
    /wallet not connected|no active signer/i.test(text)
  ) {
    return { ...base, kind: "noWallet", message: COPY.noWallet };
  }
  if (
    /no record of a prior credit|insufficient lamports|insufficient funds for (fee|rent)|InsufficientFundsForFee|InsufficientFundsForRent/i.test(
      text,
    )
  ) {
    return { ...base, kind: "noSol", message: COPY.noSol };
  }
  // SPL Token error 0x1 = InsufficientFunds; also the plain log line.
  if (
    /Error: insufficient funds|TokenInsufficientFunds|custom program error: 0x1\b/i.test(
      text,
    )
  ) {
    return { ...base, kind: "noTokens", message: COPY.noTokens };
  }
  if (
    /blockhash not found|block height exceeded|TransactionExpired|was not confirmed in|timed? ?out|timeout/i.test(
      text,
    )
  ) {
    return { ...base, kind: "slow", message: COPY.slow };
  }
  return { ...base, kind: "unknown", message: COPY.unknown };
}
