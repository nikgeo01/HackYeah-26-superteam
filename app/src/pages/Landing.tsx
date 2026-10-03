// Landing (PLAN 4.1): the product's own moment (a milestone paid by rule), who it is for, what
// replaces the platform, then connect, test dollars and next steps.
import { useEffect, useState } from "react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { FaucetButton } from "../components/FaucetButton";
import { RoleMark, shapeForLabel } from "../components/RoleSwitcher";
import { Amount, PhaseRun, Sheet, Stamp, TrackNode, type NodeState } from "../components/ui";
import { ButtonLink } from "../components/ui/ButtonLink";
import { Clock } from "../components/ui/Clock";
import { useActor } from "../providers/ActorProvider";
import { useBalances } from "../hooks/useBalances";
import { formatAmount, formatSol, shortAddress } from "../lib/format";
import { DEMO_MODE } from "../lib/env";

/* ---------- The specimen: one milestone, paid by rule, on a loop ---------- */

const LOOP_MS = 12_000;
const REVIEW_MS = 7_000; // the review clock runs 00:07 down to 00:00
const MOVE_MS = 1_600; // then the release is open to anyone, then the stamp lands

type Moment =
  | { kind: "review"; secondsLeft: number; progress: number }
  | { kind: "move" }
  | { kind: "paid"; loop: number };

function useReducedMotion(): boolean {
  const query = "(prefers-reduced-motion: reduce)";
  const [reduced, setReduced] = useState(
    () => typeof window !== "undefined" && window.matchMedia?.(query).matches,
  );
  useEffect(() => {
    const mq = window.matchMedia?.(query);
    if (!mq) return;
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

function useMoment(still: boolean): Moment {
  const [t, setT] = useState(0);
  useEffect(() => {
    if (still) return;
    const start = performance.now();
    const id = window.setInterval(() => setT(performance.now() - start), 100);
    return () => window.clearInterval(id);
  }, [still]);
  if (still) return { kind: "paid", loop: 0 };
  const loop = Math.floor(t / LOOP_MS);
  const at = t % LOOP_MS;
  if (at < REVIEW_MS)
    return {
      kind: "review",
      secondsLeft: Math.ceil((REVIEW_MS - at) / 1000),
      progress: at / REVIEW_MS,
    };
  if (at < REVIEW_MS + MOVE_MS) return { kind: "move" };
  return { kind: "paid", loop };
}

const PHASES = ["Locked", "Delivered", "Review", "Paid"];

function SideRow({ n, what, state, note }: { n: number; what: string; state: NodeState; note: string }) {
  return (
    <div className="flex items-baseline gap-3 py-3">
      <span className="translate-y-[3px]">
        <TrackNode state={state} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="font-semibold text-ink">Milestone {n}</span>{" "}
        <span className="text-ink-soft">{what}</span>
        <span className="block text-micro text-ink-soft">{note}</span>
      </span>
      <Amount value="5.00" size="sm" className="text-ink-soft" />
    </div>
  );
}

function Specimen() {
  const still = useReducedMotion();
  const m = useMoment(still);
  const node: NodeState = m.kind === "review" ? "progress" : m.kind === "move" ? "decided" : "settled";

  return (
    <figure className="m-0">
      <Sheet as="div" className="relative overflow-hidden px-5 pb-2 pt-4 sm:px-7">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-rule pb-3">
          <p className="text-sm text-ink-soft">
            <span className="font-semibold text-ink">API for a booking app</span>, from a startup
            to Kasia
          </p>
          <p className="text-sm text-ink-soft">
            <Amount value="15.00" size="sm" className="text-ink" /> locked
          </p>
        </div>

        <div className="relative" aria-hidden>
          {/* The track: one vertical line through every node. */}
          <span className="absolute bottom-6 left-[7px] top-6 w-px bg-rule" />

          <SideRow n={1} what="Booking endpoints" state="settled" note="Paid to Kasia two weeks ago" />

          <div className="flex gap-3 border-y border-rule-soft py-4">
            <span className="translate-y-[5px]">
              <TrackNode state={node} />
            </span>
            <div className="min-w-0 flex-1 space-y-3">
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-lead font-semibold leading-snug text-ink">
                  Milestone 2
                  <span className="block text-body font-normal text-ink">
                    Kasia delivered the API.
                  </span>
                </p>
                <Amount value="5.00" size="lg" />
              </div>

              <div className="relative min-h-[4.25rem]">
                {m.kind === "review" && (
                  <p className="text-sm text-ink">
                    Review time left{" "}
                    <Clock
                      text={`00:${String(m.secondsLeft).padStart(2, "0")}`}
                      className="text-lead font-semibold text-clock"
                    />
                    <span className="block text-ink-soft">
                      If the client says nothing, Kasia is paid when it reaches zero.
                    </span>
                  </p>
                )}
                {m.kind === "move" && (
                  <p className="text-sm text-ink">
                    <span className="font-semibold">Review time is over.</span>
                    <span className="block text-ink-soft">
                      No objection came, so anyone can now release the 5.00 to Kasia.
                    </span>
                  </p>
                )}
                {m.kind === "paid" && (
                  <>
                    <p className="pr-36 text-sm text-ink">
                      <span className="font-semibold">Paid to Kasia.</span>
                      <span className="block text-ink-soft">
                        Nobody had to press approve. The rule did it.
                      </span>
                    </p>
                    <Stamp
                      key={m.loop}
                      land={!still}
                      tilt={-7}
                      className="absolute right-0 top-1"
                    >
                      Paid by rule
                    </Stamp>
                  </>
                )}
              </div>

              <PhaseRun
                phases={PHASES}
                current={m.kind === "review" ? 2 : m.kind === "move" ? 3 : 4}
                progress={m.kind === "review" ? m.progress : 0.12}
                urgent={m.kind === "review"}
              />
            </div>
          </div>

          <SideRow n={3} what="Admin screens" state="open" note="Due in 9 days" />
        </div>
      </Sheet>
      <figcaption className="mt-2 text-micro text-ink-soft">
        An example milestone, playing on a loop. When the client&rsquo;s review time runs out with
        no objection, the rule pays the freelancer.
      </figcaption>
    </figure>
  );
}

/* ---------- What replaces the platform ---------- */

const JOBS: { job: string; platform: string; kept: string }[] = [
  {
    job: "Holding the money",
    platform: "The platform's bank account",
    kept: "A vault on Solana that no person holds a key to",
  },
  {
    job: "Deciding when to pay",
    platform: "The client, or a support agent if you complain",
    kept: "A public timer: if the client does not object in time, the freelancer is paid",
  },
  {
    job: "Settling a dispute",
    platform: "The platform's staff, on their schedule",
    kept: "Three arbiters both sides chose at the start. They can never take the money, and no decision in time means a 50/50 split",
  },
];

function Jobs() {
  return (
    <section aria-labelledby="jobs" className="space-y-4">
      <h2 id="jobs" className="text-title font-semibold leading-snug tracking-[-0.01em]">
        Three jobs a platform does, done by rules instead
      </h2>
      <Sheet as="div" className="px-5 py-2 sm:px-7">
        <div
          aria-hidden
          className="hidden grid-cols-[11rem_minmax(0,1fr)_minmax(0,1.4fr)] gap-x-6 border-b border-rule py-2 text-micro text-ink-soft md:grid"
        >
          <span>The job</span>
          <span>On a freelance platform</span>
          <span>On Kept</span>
        </div>
        <dl className="ledger">
          {JOBS.map((j) => (
            <div
              key={j.job}
              className="grid gap-x-6 gap-y-1 py-4 md:grid-cols-[11rem_minmax(0,1fr)_minmax(0,1.4fr)] md:items-baseline"
            >
              <dt className="font-semibold text-ink">{j.job}</dt>
              <dd className="text-sm text-ink-soft line-through decoration-ink-soft/40">
                <span className="sr-only">On a freelance platform: </span>
                {j.platform}
              </dd>
              <dd className="text-ink">
                <span className="sr-only">On Kept: </span>
                {j.kept}
              </dd>
            </div>
          ))}
        </dl>
      </Sheet>
    </section>
  );
}

/* ---------- Try it ---------- */

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <li className="grid grid-cols-[2rem_minmax(0,1fr)] gap-x-3 py-4">
      <span className="figures pt-0.5 text-lead font-semibold leading-none text-ink-soft">{n}</span>
      <div className="space-y-2">
        <h3 className="font-semibold text-ink">{title}</h3>
        {children}
      </div>
    </li>
  );
}

function TryIt() {
  const { actor } = useActor();
  const balances = useBalances(actor?.publicKey);

  return (
    <section aria-labelledby="try" className="space-y-2">
      <h2 id="try" className="text-title font-semibold leading-snug tracking-[-0.01em]">
        Try it with test money
      </h2>
      <p className="max-w-[62ch] text-ink-soft">
        Everything here runs on Solana devnet. The dollars are test tokens with no value, and the
        network fees are paid in free devnet SOL.
      </p>
      <ol className="ledger max-w-2xl">
        <Step n={1} title={actor ? "You are connected" : "Connect a wallet"}>
          {actor ? (
            <p className="flex flex-wrap items-center gap-x-1.5 text-sm text-ink-soft">
              Acting as
              <RoleMark shape={shapeForLabel(actor.label)} />
              <span className="font-semibold text-ink">{actor.label}</span>
              <span className="tnum">({shortAddress(actor.publicKey)})</span>
            </p>
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              <WalletMultiButton />
              {DEMO_MODE && (
                <span className="text-sm text-ink-soft">or pick a demo role in the header</span>
              )}
            </div>
          )}
        </Step>
        <Step n={2} title="Get test dollars">
          <div className="flex flex-wrap items-center gap-3">
            <FaucetButton />
            {balances.data && (
              <span className="text-sm text-ink-soft">
                You have{" "}
                <span className="figures font-semibold text-ink">
                  {formatAmount(balances.data.tusdc)}
                </span>{" "}
                and <span className="figures">{formatSol(balances.data.lamports)}</span> for fees.
              </span>
            )}
          </div>
        </Step>
        <Step n={3} title="Create a deal">
          <div className="flex flex-wrap items-center gap-2">
            <ButtonLink to="/new" kind="act">
              Create a deal
            </ButtonLink>
            <ButtonLink to="/how" kind="quiet">
              How it works, and its limits
            </ButtonLink>
          </div>
        </Step>
      </ol>
    </section>
  );
}

/* ---------- Page ---------- */

export default function Landing() {
  return (
    <div className="space-y-16 pb-4 sm:space-y-20">
      <section className="grid items-center gap-8 pt-2 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:gap-14">
        <Specimen />
        <div className="space-y-5 lg:order-first">
          <h1 className="max-w-[16ch] text-[clamp(2.25rem,5.4vw,3.815rem)] font-[680] leading-[1.02] tracking-[-0.03em] text-ink">
            Nobody has to go first.
          </h1>
          <p className="max-w-[46ch] text-lead leading-snug text-ink">
            The client locks the whole payment before you start. You deliver one milestone at a
            time, and if they say nothing within the review time, a public rule pays you.
          </p>
        </div>
      </section>

      <section aria-labelledby="who" className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)] md:gap-10">
        <h2 id="who" className="text-title font-semibold leading-snug tracking-[-0.01em]">
          For freelancers and the clients they have never met
        </h2>
        <p className="max-w-[62ch] text-ink">
          Kasia is a freelance developer in Kraków. Her new client is a startup in another country.
          If she delivers first, they could keep the code and not pay. If they pay first, she could
          disappear. Neither can realistically take the other to court. Kept is for that deal: a
          freelance developer and a small company, paying in dollars, milestone by milestone.
        </p>
      </section>

      <Jobs />
      <TryIt />
    </div>
  );
}
