// "Your move" (DESIGN.md, deal page): the single most important thing the viewer can do now,
// with its buttons. Deal-level actions live here (accept or cancel an Open deal, "Withdraw all",
// closing a finished deal, PLAN 4.3, 4.5 bundles); a milestone's move renders its own buttons
// into the slot this block provides. When there is nothing to do, it says what happens next.
import type { ReactNode } from "react";
import { useConnection } from "@solana/wallet-adapter-react";
import { useProgram } from "../../hooks/useProgram";
import { useTx } from "../../hooks/useTx";
import { useActor } from "../../providers/ActorProvider";
import { useChainTime } from "../../providers/ChainTimeProvider";
import { isFullySettled, type DealView, type Role } from "../../lib/deals";
import { COPY } from "../../lib/errors";
import {
  acceptDealIx,
  cancelOpenDealIxs,
  closeDealIx,
  settleManyIxs,
} from "../../lib/instructions";
import { crankReady, CRANK_BUFFER_SECS } from "../../lib/outcomes";
import { vaultPda } from "../../lib/pdas";
import { formatAmount, formatDuration } from "../../lib/format";
import { Amount, Ledger, Notice, splitAmount, type NoticeTone } from "../ui";
import { Btn, PullLink, Spinner, ARBITER_LABEL, AddressLink } from "./common";
import { Countdown } from "./Countdown";
import type { Move, NextEvent } from "./plan";

export interface Finished {
  title: string;
  signature: string;
}

export type DealLevel = "accept" | "clientOpen" | "waitOpen" | "expired" | "withdraw" | "close";

/** The deal-level block, if any, for this viewer (mirrors the old action bar's rules). */
export function dealLevelMove(deal: DealView, role: Role, now: number): DealLevel[] {
  const out: DealLevel[] = [];
  if (deal.status === "open") {
    const acceptOpen = now < deal.acceptDeadline;
    const expired = now >= deal.acceptDeadline + CRANK_BUFFER_SECS;
    if (role === "worker" && acceptOpen) out.push("accept");
    else if (role === "client") out.push("clientOpen");
    else if (!expired) out.push("waitOpen");
    if (expired && role !== "client") out.push("expired");
  }
  const ready = deal.milestones.filter((m) => crankReady(deal, m.index, now));
  if (deal.status !== "open" && ready.length >= 2) out.push("withdraw");
  if (isFullySettled(deal)) out.push("close");
  return out;
}

/** Terms summary shown to the freelancer above "Accept this deal". */
function AcceptTerms({ deal }: { deal: DealView }) {
  const proofs = deal.milestones.filter((m) => m.proofKind !== "off");
  return (
    <div className="space-y-3 text-sm">
      <Ledger
        className="max-w-2xl border-y border-rule-soft"
        rows={deal.milestones.map((m) => ({
          key: String(m.index),
          label: (
            <span className="text-ink">
              Milestone {m.index + 1}: deliver within {formatDuration(m.dueSecs)} of accepting
              {m.proofKind !== "off" && (
                <>
                  , released by merging <PullLink repo={deal.proofRepo} n={m.proofRef} />
                </>
              )}
            </span>
          ),
          value: formatAmount(m.amount),
        }))}
      />
      <ul className="max-w-[68ch] list-disc space-y-1 pl-5 marker:text-ink-soft">
        <li>
          After you deliver, the client has {formatDuration(deal.reviewWindowSecs)} to approve or
          object. If they say nothing, you are paid.
        </li>
        <li>
          An objection locks a deposit of{" "}
          {deal.disputeDeposit > 0n ? formatAmount(deal.disputeDeposit) : "nothing"} from the
          client. The arbiters then have {formatDuration(deal.voteWindowSecs)} to vote; with no
          majority the payment is split 50/50.
        </li>
        <li>
          Arbiters:{" "}
          {deal.judges.map((j, i) => (
            <span key={j.toBase58()}>
              {ARBITER_LABEL[i].replace("Arbiter picked", "picked")} <AddressLink address={j} />
              {i < 2 ? "; " : "."}
            </span>
          ))}
        </li>
      </ul>
      {deal.proofRepo && proofs.length > 0 && (
        <Notice tone="clock">
          <strong>Repository {deal.proofRepo}.</strong> Check that this repository belongs to the
          client. Merging the pull request is their acceptance, and it releases your payment.
        </Notice>
      )}
    </div>
  );
}

function Block({
  tone,
  title,
  hint,
  children,
}: {
  tone: NoticeTone;
  title: ReactNode;
  hint?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <Notice tone={tone} className="space-y-3 py-4 sm:px-5">
      <div className="space-y-1">
        {tone === "move" && <p className="text-sm font-semibold text-stamp">Your move</p>}
        <p className="max-w-[68ch] text-lead font-semibold leading-snug text-ink">{title}</p>
        {hint && <p className="max-w-[68ch] text-sm text-ink-soft">{hint}</p>}
      </div>
      {children}
    </Notice>
  );
}

export function YourMove({
  deal,
  role,
  now,
  onFinished,
  featured,
  next,
  setSlot,
}: {
  deal: DealView;
  role: Role;
  now: number;
  onFinished: (f: Finished) => void;
  /** The viewer's best milestone move, if this block should show it. */
  featured: { index: number; move: Move } | null;
  /** The next timed event, for "Nothing for you right now". */
  next: NextEvent | null;
  /** Receives the element a milestone renders its buttons into. */
  setSlot: (el: HTMLElement | null) => void;
}) {
  const program = useProgram();
  const { connection } = useConnection();
  const { publicKey } = useActor();
  const chain = useChainTime();
  const { send, busy } = useTx();

  const signer = () => {
    if (!publicKey) throw new Error(COPY.noWallet);
    return publicKey;
  };

  const cancelOpen = (label: string) =>
    void send(label, async () =>
      cancelOpenDealIxs(program, { signer: signer(), deal, now: Math.floor(chain.now()) }),
    ).then((sig) => {
      if (sig)
        onFinished({
          title: "The deal was cancelled and the money returned to the client.",
          signature: sig,
        });
    });

  const levels = dealLevelMove(deal, role, now);
  const open = levels.find((l) => l === "accept" || l === "clientOpen" || l === "waitOpen" || l === "expired");
  const spin = busy && <Spinner />;

  // ---- Open deal
  if (open === "accept")
    return (
      <Block
        tone="move"
        title="Review the terms and accept this deal."
        hint={
          <>
            Time left to accept: <Countdown deadline={deal.acceptDeadline} now={now} className="font-semibold text-ink" />
          </>
        }
      >
        <AcceptTerms deal={deal} />
        <Btn
          disabled={busy}
          onClick={() =>
            void send("Accept this deal", async () => ({
              instructions: [await acceptDealIx(program, { worker: signer(), deal: deal.address })],
            }))
          }
        >
          {spin}Accept this deal
        </Btn>
      </Block>
    );
  if (open === "clientOpen")
    return (
      <Block
        tone="info"
        title="Waiting for the freelancer to accept."
        hint={
          <>
            {now < deal.acceptDeadline ? (
              <>
                They have <Countdown deadline={deal.acceptDeadline} now={now} className="font-semibold text-ink" /> left.{" "}
              </>
            ) : (
              "The time to accept is over. "
            )}
            Your money is locked in the deal, not with us. You can cancel and get it all back until
            they accept.
          </>
        }
      >
        <Btn variant="secondary" disabled={busy} onClick={() => cancelOpen("Cancel deal")}>
          {spin}Cancel and get a refund
        </Btn>
      </Block>
    );
  if (open === "waitOpen")
    return (
      <Block
        tone={deal.acceptDeadline - now < 60 ? "clock" : "info"}
        title={
          now < deal.acceptDeadline ? (
            <>
              Nothing for you right now. Next: the freelancer accepts, or the time to accept ends in{" "}
              <Countdown deadline={deal.acceptDeadline} now={now} />.
            </>
          ) : (
            "The time to accept is over."
          )
        }
      />
    );
  if (open === "expired")
    return (
      <Block
        tone="move"
        title="The freelancer never accepted."
        hint="Anyone can now cancel the deal; all of the money goes back to the client."
      >
        <Btn disabled={busy} onClick={() => cancelOpen("Cancel and refund the client")}>
          {spin}Cancel and refund the client
        </Btn>
      </Block>
    );

  const featuredBlock = featured && (
    <Block tone="move" title={featured.move.text} hint={featured.move.hint}>
      {featured.move.release ? (
        <Btn
          variant="secondary"
          onClick={() =>
            document
              .getElementById(`milestone-${featured.index + 1}`)
              ?.scrollIntoView({ behavior: "smooth", block: "start" })
          }
          data-preview-ok
        >
          Go to milestone {featured.index + 1}
        </Btn>
      ) : (
        <div ref={setSlot} />
      )}
    </Block>
  );

  if (featured?.move.personal) return featuredBlock;

  // ---- Withdraw all
  if (levels.includes("withdraw")) {
    const ready = deal.milestones.filter((m) => crankReady(deal, m.index, now));
    const sum = splitAmount(formatAmount(ready.reduce((s, m) => s + m.amount, 0n)));
    return (
      <Block
        tone="move"
        title={`${ready.length} payments are ready: milestones ${ready.map((m) => m.index + 1).join(", ")}.`}
        hint="Send them all in one transaction. Anyone can do it."
      >
        <Btn
          disabled={busy}
          onClick={() =>
            void send("Withdraw all", async () => {
              const t = Math.floor(chain.now());
              return settleManyIxs(program, {
                cranker: signer(),
                deal,
                indexes: ready.map((m) => m.index),
                now: t,
              });
            })
          }
        >
          {spin}Withdraw all
        </Btn>
        <p className="text-sm text-ink-soft">
          <Amount value={sum.value} symbol={sum.symbol} size="sm" className="text-ink" /> plus any
          deposits.
        </p>
      </Block>
    );
  }

  if (featuredBlock) return featuredBlock;

  // ---- Close
  if (levels.includes("close"))
    return (
      <Block
        tone={role === "client" ? "move" : "info"}
        title="Every milestone is paid out."
        hint="Anyone can close the deal; the small storage deposit (rent) goes back to the client."
      >
        <Btn
          variant={role === "client" ? "primary" : "secondary"}
          disabled={busy}
          onClick={() =>
            void send("Close deal and return rent", async () => {
              const vault = vaultPda(deal.address, program.programId);
              let balance = 0n;
              try {
                const res = await connection.getTokenAccountBalance(vault, "confirmed");
                balance = BigInt(res.value.amount);
              } catch {
                // Vault already gone or unreadable: nothing to sweep.
              }
              const { ix, atas } = await closeDealIx(program, {
                cranker: signer(),
                deal,
                vaultBalance: balance,
              });
              return { instructions: [ix], atas };
            }).then((sig) => {
              if (sig)
                onFinished({
                  title: "The deal is closed. Its rent went back to the client.",
                  signature: sig,
                });
            })
          }
        >
          {spin}Close deal and return rent
        </Btn>
      </Block>
    );

  // ---- Nothing to do: say what happens next, and when.
  const soon = next !== null && next.at - now < 60;
  return (
    <Block
      tone={soon ? "clock" : "info"}
      title={
        next ? (
          <>
            Nothing for you right now. Next: {next.text} in{" "}
            <Countdown deadline={next.at} now={now} />.
          </>
        ) : (
          "Nothing for you right now."
        )
      }
      hint={
        role === "stranger"
          ? "You have no part in this deal. You can still see everything, and you can release payments whose timers have run out."
          : undefined
      }
    />
  );
}
