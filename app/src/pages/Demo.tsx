// Demo page (PLAN 4.1, 4.7, ADR-10), only routed when VITE_DEMO_MODE=true: every demo actor as
// a ledger row with balances and an "Act as" button, then the pre-seeded deals as quiet rows.
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
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
import { DEMO_SECURITY_NOTE } from "../lib/actors";
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

function SeededDeal({ label, address, now }: { label: string; address: string; now: number }) {
  const { publicKey } = useActor();
  const { data: deal, isLoading } = useDeal(address);
  return (
    <li className="grid gap-x-4 gap-y-1 py-3 sm:grid-cols-[minmax(0,8rem)_minmax(0,1fr)_auto] sm:items-baseline">
      <p className="font-semibold">
        <Link to={`/deal/${address}`} className={linkClass}>
          {label}
        </Link>
      </p>
      <p className="text-sm text-ink-soft">
        {isLoading
          ? "Loading this deal"
          : deal
            ? nextStep(deal, roleIn(deal, publicKey), publicKey, now).text
            : `Not found at ${shortAddress(address)}. It may be closed already, or not seeded yet.`}
      </p>
      {deal && <InlineAmount raw={deal.total} className="sm:text-right" />}
    </li>
  );
}

export default function Demo() {
  const { demoActors, activeId, select, actor } = useActor();
  const now = useChainNow();
  const choose = (id: ActorId) => () => select(id);
  const walletKey = actor?.kind === "wallet" ? actor.publicKey : null;

  return (
    <div className="space-y-10">
      <header className="max-w-[68ch] space-y-3">
        <Heading level={1}>Demo roles</Heading>
        <p className="text-ink-soft">
          A deal has up to six people: the client, the freelancer, three arbiters and anyone else. To
          show it on one screen, act as any of them here or with the switcher in the header. Every action
          is a real devnet transaction signed by that person&apos;s key.
        </p>
        <p className="text-ink-soft">
          The Passer-by has no part in any deal. Use it to show that anyone can release a payment once
          its timer is over, and that the money still goes only to the client or the freelancer.
        </p>
        <Notice>
          <strong className="font-semibold">Demo keys are public.</strong> {DEMO_SECURITY_NOTE}
        </Notice>
      </header>

      <section className="space-y-4">
        <Heading level={2}>The people</Heading>
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

      <section className="max-w-[68ch] space-y-4">
        <Heading level={2}>Prepared deals</Heading>
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
          <ul className="ledger border-y border-rule">
            {DEMO_DEALS.map((d) => (
              <SeededDeal key={d.label} label={d.label} address={d.address} now={now} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
