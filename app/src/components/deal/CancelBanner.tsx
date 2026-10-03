// Mutual cancel on an Active deal (PLAN 4.3, last two rows). The program decides; we only
// show the right button. Agreeing bundles the refunds of undecided milestones.
import { useState } from "react";
import { useProgram } from "../../hooks/useProgram";
import { useTx } from "../../hooks/useTx";
import { useActor } from "../../providers/ActorProvider";
import { useChainTime } from "../../providers/ChainTimeProvider";
import { cancelRequests, type DealView, type Role } from "../../lib/deals";
import { COPY } from "../../lib/errors";
import { cancelDealIx, settleManyIxs } from "../../lib/instructions";
import { settleableIndexes } from "../../lib/outcomes";
import { Btn, Spinner } from "./common";

export function CancelBanner({ deal, role }: { deal: DealView; role: Role }) {
  const program = useProgram();
  const { publicKey } = useActor();
  const { now } = useChainTime();
  const { send, busy } = useTx();
  const [asking, setAsking] = useState(false);

  if (deal.status !== "active") return null;
  const req = cancelRequests(deal);
  const isParty = role === "client" || role === "worker";
  const mine =
    role === "client" ? req.client : role === "worker" ? req.worker : false;
  const theirs =
    role === "client" ? req.worker : role === "worker" ? req.client : false;
  const other = role === "client" ? "freelancer" : "client";

  const setFlag = (agree: boolean, label: string) =>
    void send(label, async () => {
      if (!publicKey) throw new Error(COPY.noWallet);
      const ix = await cancelDealIx(program, {
        signer: publicKey,
        deal: deal.address,
        agree,
      });
      return { instructions: [ix] };
    }).then(() => setAsking(false));

  const agree = () =>
    void send("Agree to cancel", async () => {
      if (!publicKey) throw new Error(COPY.noWallet);
      const ix = await cancelDealIx(program, {
        signer: publicKey,
        deal: deal.address,
        agree: true,
      });
      // Once both agree the deal is Cancelled: refund every undecided milestone right away.
      const t = Math.floor(now());
      const settles = await settleManyIxs(program, {
        cranker: publicKey,
        deal,
        indexes: settleableIndexes(deal, t, { dealStatus: "cancelled" }),
        now: t,
        assume: { dealStatus: "cancelled" },
      });
      return {
        instructions: [ix, ...settles.instructions],
        atas: settles.atas,
      };
    });

  if (isParty && mine) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border-2 border-amber-300 bg-amber-50 p-4">
        <p className="text-sm text-amber-950">
          <strong>You have asked to cancel this deal.</strong> It is cancelled
          only if the {other} agrees. Until then, all normal rules keep running.
        </p>
        <Btn
          variant="secondary"
          disabled={busy}
          onClick={() => setFlag(false, "Withdraw cancel request")}
        >
          {busy && <Spinner />}Withdraw request
        </Btn>
      </div>
    );
  }

  if (isParty && theirs) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border-2 border-orange-300 bg-orange-50 p-4">
        <p className="text-sm text-orange-950">
          <strong>The {other} asked to cancel.</strong> Undecided milestones
          would be refunded to {role === "client" ? "you" : "the client"}.
          Milestones already approved or decided still go to whoever won them.
        </p>
        <Btn variant="primary" disabled={busy} onClick={agree}>
          {busy && <Spinner />}Agree
        </Btn>
      </div>
    );
  }

  if (!isParty && (req.client || req.worker)) {
    return (
      <p className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
        The {req.client ? "client" : "freelancer"} has asked to cancel this
        deal. It is cancelled only if the {req.client ? "freelancer" : "client"}{" "}
        agrees.
      </p>
    );
  }

  if (!isParty) return null;

  return (
    <div className="flex flex-wrap items-center justify-end gap-2 text-sm">
      {asking ? (
        <div className="flex w-full flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3">
          <p className="text-slate-700">
            Ask the {other} to cancel? Nothing changes unless they agree. Then
            every undecided milestone is refunded to the client.
          </p>
          <div className="flex gap-2">
            <Btn
              variant="ghost"
              onClick={() => setAsking(false)}
              disabled={busy}
            >
              Never mind
            </Btn>
            <Btn
              variant="danger"
              disabled={busy}
              onClick={() => setFlag(true, "Ask to cancel")}
            >
              {busy && <Spinner />}Ask to cancel
            </Btn>
          </div>
        </div>
      ) : (
        <Btn variant="ghost" onClick={() => setAsking(true)}>
          Ask to cancel this deal…
        </Btn>
      )}
    </div>
  );
}
