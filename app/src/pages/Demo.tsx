// Demo page (PLAN 4.1, 4.7, ADR-10), only routed when VITE_DEMO_MODE=true: every demo actor as
// a ledger row with balances and an "Act as" button, then the pre-seeded deals as quiet rows.
import type { ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import type { PublicKey } from "@solana/web3.js";
import { useActor, type ActorId } from "../providers/ActorProvider";
import { useBalances } from "../hooks/useBalances";
import { useDeal } from "../hooks/useDeals";
import { useChainNow } from "../providers/ChainTimeProvider";
import { RoleMark, shapeForLabel, type RoleShape } from "../components/RoleSwitcher";
import { nextStep } from "../components/DealCard";
import { Button, Heading, Notice, Sheet } from "../components/ui";
import { InlineAmount } from "../components/ui/InlineAmount";
import { explorerAddressUrl, formatSol, shortAddress } from "../lib/format";
import { DEMO_DEALS_RAW } from "../lib/env";
import { DEMO_SECURITY_NOTE, type DemoRoleId } from "../lib/actors";
import { roleIn } from "../lib/deals";
import { toPublicKey } from "../lib/pdas";

/** Parses VITE_DEMO_DEALS (`{ "D1": "<address>", ... }`); bad entries are skipped. */
function parseDemoDeals(raw: string): { label: string; address: string }[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return [];
    return Object.entries(parsed as Record<string, unknown>).flatMap(([label, value]) => {
      const key = toPublicKey(typeof value === "string" ? value : null);
      return key ? [{ label, address: key.toBase58() }] : [];
    });
  } catch (err) {
    console.warn("VITE_DEMO_DEALS is not valid JSON", err);
    return [];
  }
}

const DEMO_DEALS = parseDemoDeals(DEMO_DEALS_RAW);

const linkClass =
  "text-ink underline decoration-ink/35 underline-offset-[3px] hover:decoration-stamp";

/** Column layout shared by the header and every row (stacks on a phone). */
const ROW =
  "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 px-4 py-3 md:grid-cols-[minmax(0,10rem)_minmax(0,1fr)_7.5rem_6.5rem_10rem] sm:px-5";

function Row({
  shape,
  name,
  address,
  blurb,
  publicKey,
  active,
  action,
  onSelect,
}: {
  shape: RoleShape;
  name: string;
  address?: PublicKey | null;
  blurb: ReactNode;
  publicKey: PublicKey | null;
  active: boolean;
  action: string;
  onSelect: () => void;
}) {
  const { data } = useBalances(publicKey);
  return (
    <li className={`${ROW} ${active ? "bg-stamp-wash" : ""}`} aria-current={active || undefined}>
      <div className="col-start-1 row-start-1 min-w-0">
        <p className="flex items-center gap-2 font-semibold">
          <RoleMark shape={shape} />
          {name}
        </p>
        {address && (
          <a
            href={explorerAddressUrl(address)}
            target="_blank"
            rel="noreferrer"
            title={address.toBase58()}
            className={`ml-[1.125rem] text-micro text-ink-soft ${linkClass}`}
          >
            {shortAddress(address)}
          </a>
        )}
      </div>
      <div className="col-start-2 row-start-1 justify-self-end md:col-start-5">
        {active ? (
          <span className="inline-block px-3.5 py-2 text-sm font-semibold text-stamp">Acting now</span>
        ) : (
          <Button kind="plain" onClick={onSelect}>
            {action}
          </Button>
        )}
      </div>
      <p className="col-span-2 text-sm text-ink-soft md:col-span-1 md:col-start-2 md:row-start-1">{blurb}</p>
      <p className="col-span-2 flex gap-4 text-sm md:contents">
        <span className="md:col-start-3 md:row-start-1 md:text-right">
          {publicKey ? (data ? <InlineAmount raw={data.tusdc} /> : <span className="text-ink-soft">loading</span>) : <span className="text-ink-soft">not connected</span>}
        </span>
        <span className="figures md:col-start-4 md:row-start-1 md:text-right">
          {publicKey && data ? (
            <>
              {formatSol(data.lamports).replace(" SOL", "")}
              <span className="ml-[0.2em] text-[0.8em] text-ink-soft">SOL</span>
            </>
          ) : null}
        </span>
      </p>
    </li>
  );
}

/** What each seeded deal (scripts/seed-deals.ts) shows, and who to be when you open it. */
const SCENARIOS: Record<string, { title: string; shows: string; as: DemoRoleId; key?: boolean }> = {
  D1: {
    title: "A new deal, waiting for the freelancer",
    shows: "The money is already in escrow. Accept the deal, then deliver the first milestone.",
    as: "worker",
  },
  D2: {
    title: "Work delivered, the client is reviewing",
    shows: "Approve and pay with one click, or object and send it to the arbiters.",
    as: "client",
  },
  D3: {
    title: "The client stayed silent",
    shows: "The review time ran out with no answer. A stranger releases the payment, and it can only go to the freelancer. This is where the platform disappears.",
    as: "passerby",
    key: true,
  },
  D4: {
    title: "A dispute, one vote already in",
    shows: "Cast the deciding vote. The vote and the payout happen in the same transaction.",
    as: "arbiter2",
  },
  D5: {
    title: "The arbiters ran out of time",
    shows: "No majority before the deadline, so anyone can settle it as a 50/50 split.",
    as: "passerby",
  },
  D6: {
    title: "The pull request is merged",
    shows: "Submit a proof that GitHub merged the agreed pull request. The program checks it and pays.",
    as: "worker",
  },
  D7: {
    title: "The pull request is still open",
    shows: "Merge it on GitHub, then prove the merge here to release the payment.",
    as: "worker",
  },
  D8: {
    title: "A finished deal",
    shows: "Everything is paid out. Look through its transactions on the public record, then close it.",
    as: "passerby",
  },
};

function SeededDeal({ label, address, now }: { label: string; address: string; now: number }) {
  const { publicKey, demoActors, select, activeId } = useActor();
  const navigate = useNavigate();
  const { data: deal, isLoading } = useDeal(address);
  const scenario = SCENARIOS[label];
  const actAs = scenario ? demoActors.find((a) => a.id === scenario.as) : undefined;
  const open = () => {
    if (actAs) select(actAs.id);
    navigate(`/deal/${address}`);
  };
  return (
    <li
      className={`grid gap-x-6 gap-y-2 px-4 py-4 sm:px-5 md:grid-cols-[minmax(0,1fr)_auto] md:items-center ${scenario?.key ? "bg-stamp-wash" : ""}`}
    >
      <div className="min-w-0 space-y-1">
        <p className="font-semibold text-ink">
          {scenario?.title ?? label}
          {scenario?.key && <span className="ml-2 text-sm font-semibold text-stamp">The key moment</span>}
        </p>
        {scenario && <p className="max-w-[62ch] text-sm text-ink">{scenario.shows}</p>}
        <p className="text-micro text-ink-soft">
          {isLoading
            ? "Loading this deal"
            : deal
              ? (
                  <>
                    <InlineAmount raw={deal.total} /> · Now:{" "}
                    {nextStep(deal, roleIn(deal, actAs?.publicKey ?? publicKey), actAs?.publicKey ?? publicKey, now).text}
                  </>
                )
              : `Not found at ${shortAddress(address)}. It may be closed already, or not seeded yet.`}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2 md:justify-end">
        {actAs ? (
          <Button kind={scenario?.key ? "act" : "plain"} onClick={open} disabled={!deal && !isLoading}>
            {activeId === actAs.id ? "Open" : `Open as ${actAs.label}`}
          </Button>
        ) : (
          <Link to={`/deal/${address}`} className={linkClass}>
            Open
          </Link>
        )}
      </div>
    </li>
  );
}

export default function Demo() {
  const { demoActors, activeId, select, actor } = useActor();
  const now = useChainNow();
  const choose = (id: ActorId) => () => select(id);
  const walletKey = actor?.kind === "wallet" ? actor.publicKey : null;
  const navigate = useNavigate();
  const startAsClient = () => {
    select("client");
    navigate("/new");
  };

  return (
    <div className="space-y-10">
      <header className="max-w-[68ch] space-y-3">
        <Heading level={1}>Guided demo</Heading>
        <p className="text-lead leading-snug text-ink">
          A deal has a client, a freelancer, three arbiters and the rest of the world. Here you can be
          any of them, with no wallet. Every button you press sends a real transaction on Solana
          devnet, signed by that person&apos;s key, and you can check each one on Solana Explorer.
        </p>
      </header>

      <section className="space-y-4">
        <div className="max-w-[68ch] space-y-1">
          <Heading level={2}>Start from the beginning</Heading>
          <p className="text-ink-soft">
            Be the client and create a deal: the demo freelancer and arbiters are filled in for you.
            Then switch to the freelancer to accept and deliver, and watch the review clock run out.
          </p>
        </div>
        <Button onClick={startAsClient} disabled={!demoActors.some((a) => a.id === "client")}>
          Create a deal as the client
        </Button>
      </section>

      <section className="space-y-4">
        <div className="max-w-[68ch] space-y-1">
          <Heading level={2}>Or jump to a moment</Heading>
          <p className="text-ink-soft">
            These deals were prepared ahead of time, each stopped at an interesting point. Opening one
            switches you to the right person for that moment.
          </p>
        </div>
        {DEMO_DEALS.length === 0 ? (
          <p className="text-sm text-ink-soft">
            This build has no prepared deals. Find recent deals under{" "}
            <Link to="/deals" className={linkClass}>
              My deals
            </Link>
            , or{" "}
            <Link to="/new" className={linkClass}>
              create one
            </Link>
            .
          </p>
        ) : (
          <Sheet className="overflow-hidden">
            <ul className="ledger">
              {DEMO_DEALS.map((d) => (
                <SeededDeal key={d.label} label={d.label} address={d.address} now={now} />
              ))}
            </ul>
          </Sheet>
        )}
      </section>

      <section className="space-y-4">
        <div className="max-w-[68ch] space-y-1">
          <Heading level={2}>All the people</Heading>
          <p className="text-ink-soft">
            Switch freely, here or with the &ldquo;You:&rdquo; menu in the header. The Passer-by has no
            part in any deal: use it to show that anyone can trigger a payout once its timer is over,
            and that the money still only goes to the client or the freelancer.
          </p>
        </div>
        {demoActors.length === 0 ? (
          <p className="text-sm text-void">
            No demo people are configured in this build. Set VITE_DEMO_ACTORS and rebuild.
          </p>
        ) : (
          <Sheet className="overflow-hidden">
            <div
              aria-hidden
              className={`${ROW} hidden border-b border-rule text-sm text-ink-soft md:grid`}
            >
              <span>Role</span>
              <span>Stands for</span>
              <span className="text-right">Test dollars</span>
              <span className="text-right">Fees</span>
              <span />
            </div>
            <ul className="ledger">
              <Row
                shape="wallet"
                name="Your wallet"
                address={walletKey}
                blurb="Your own wallet, for example Phantom. It can play the client."
                publicKey={walletKey}
                active={activeId === "wallet"}
                action="Use my wallet"
                onSelect={choose("wallet")}
              />
              {demoActors.map((a) => (
                <Row
                  key={a.id}
                  shape={shapeForLabel(a.label)}
                  name={a.label}
                  address={a.publicKey}
                  blurb={a.blurb}
                  publicKey={a.publicKey}
                  active={activeId === a.id}
                  action={`Act as ${a.label}`}
                  onSelect={choose(a.id)}
                />
              ))}
            </ul>
          </Sheet>
        )}
      </section>

      <Notice>
        <strong className="font-semibold">Demo keys are public.</strong> {DEMO_SECURITY_NOTE}
      </Notice>
    </div>
  );
}
