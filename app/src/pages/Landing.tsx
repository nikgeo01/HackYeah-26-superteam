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

const PHASES = ["Locked", "Delivery", "Review", "Paid"];

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

/* ---------- A deal in four steps ---------- */

const STEPS: { title: string; body: string }[] = [
  {
    title: "The client puts the money in escrow",
    body: "Before any work starts, the client moves the full payment into a vault on Solana. We call this locking: the money is out of the client's hands, but nobody, not even us, can take it. Only the deal's rules can move it.",
  },
  {
    title: "The freelancer accepts and delivers",
    body: "The freelancer can see the money is really there before starting. The job is split into milestones, and each one is delivered and paid on its own.",
  },
  {
    title: "The client reviews in a fixed time",
    body: "After each delivery the client has a review time to approve or object. If they say nothing, silence counts as yes: anyone can then release the payment to the freelancer.",
  },
  {
    title: "Disagreements go to three arbiters",
    body: "If the client objects, three arbiters picked by both sides at the start vote. Two matching votes decide. They can never receive the money, and if they don't decide in time it is split 50/50.",
  },
];

function Steps() {
  return (
    <section id="steps" aria-labelledby="steps-title" className="scroll-mt-6 space-y-4">
      <h2 id="steps-title" className="text-title font-semibold leading-snug tracking-[-0.01em]">
        How a deal works, in four steps
      </h2>
      <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {STEPS.map((step, i) => (
          <li key={step.title}>
            <Sheet as="div" className="h-full space-y-2 px-5 py-5">
              <span className="figures block text-title font-semibold leading-none text-stamp">
                {i + 1}
              </span>
              <h3 className="font-semibold leading-snug text-ink">{step.title}</h3>
              <p className="text-sm text-ink-soft">{step.body}</p>
            </Sheet>
          </li>
        ))}
      </ol>
    </section>
  );
}

const WORDS: { word: string; meaning: string }[] = [
  { word: "Escrow, the vault", meaning: "Where the locked money waits. It belongs to the program, so no person holds a key." },
  { word: "Milestone", meaning: "One piece of the job with its own amount, paid on its own." },
  { word: "Review time", meaning: "How long the client has to approve or object after a delivery." },
  { word: "Objection deposit", meaning: "A small amount the client puts down to object, so objecting is not free. It goes to whoever wins." },
  { word: "Arbiters", meaning: "Three people both sides agree on at the start. They vote on disputes and can never be paid from the deal." },
  { word: "Passer-by", meaning: "Anyone at all. Once a timer runs out, even a stranger can trigger the payout the rules already decided." },
  { word: "tUSDC and devnet", meaning: "Test dollars on Solana's public test network. Real transactions, no real value." },
];

function Words() {
  return (
    <section aria-labelledby="words" className="space-y-4">
      <h2 id="words" className="text-title font-semibold leading-snug tracking-[-0.01em]">
        Words you will see
      </h2>
      <Sheet as="div" className="px-5 py-2 sm:px-7">
        <dl className="ledger">
          {WORDS.map((w) => (
            <div key={w.word} className="grid gap-x-6 gap-y-0.5 py-3 md:grid-cols-[13rem_minmax(0,1fr)] md:items-baseline">
              <dt className="font-semibold text-ink">{w.word}</dt>
              <dd className="text-ink-soft">{w.meaning}</dd>
            </div>
          ))}
        </dl>
      </Sheet>
    </section>
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
        {DEMO_MODE ? (
          <Step n={1} title="Pick who you are">
            <p className="text-sm text-ink-soft">
              Demo mode has a ready key for the client, the freelancer, three arbiters and a
              passer-by. Switch between them with the &ldquo;You:&rdquo; menu in the top right, or on
              the demo page.
            </p>
            {actor && (
              <p className="flex flex-wrap items-center gap-x-1.5 text-sm text-ink-soft">
                Right now you are
                <RoleMark shape={shapeForLabel(actor.label)} />
                <span className="font-semibold text-ink">{actor.label}</span>
                <span className="tnum">({shortAddress(actor.publicKey)})</span>
              </p>
            )}
            <ButtonLink to="/demo" kind="plain">
              Open the guided demo
            </ButtonLink>
          </Step>
        ) : (
          <Step n={1} title={actor ? "You are connected" : "Connect a wallet"}>
            {actor ? (
              <p className="flex flex-wrap items-center gap-x-1.5 text-sm text-ink-soft">
                Acting as
                <RoleMark shape={shapeForLabel(actor.label)} />
                <span className="font-semibold text-ink">{actor.label}</span>
                <span className="tnum">({shortAddress(actor.publicKey)})</span>
              </p>
            ) : (
              <WalletMultiButton />
            )}
          </Step>
        )}
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
          <p className="text-body font-semibold text-stamp">
            Escrow for freelance work, with no platform in the middle
          </p>
          <h1 className="max-w-[16ch] text-[clamp(2.25rem,5.4vw,3.815rem)] font-[680] leading-[1.02] tracking-[-0.03em] text-ink">
            Nobody has to go first.
          </h1>
          <p className="max-w-[46ch] text-lead leading-snug text-ink">
            A client and a freelancer who have never met can&rsquo;t trust each other with money.
            Kept keeps the payment safe in a vault on Solana that no person controls, and public rules
            decide when it moves.
          </p>
          <div className="flex flex-wrap items-center gap-2 pt-1">
            {DEMO_MODE ? (
              <ButtonLink to="/demo" kind="act" size="lg">
                Try the guided demo
              </ButtonLink>
            ) : (
              <ButtonLink to="/new" kind="act" size="lg">
                Create a deal
              </ButtonLink>
            )}
            <button
              type="button"
              onClick={() => document.getElementById("steps")?.scrollIntoView({ behavior: "smooth" })}
              className="inline-flex items-center rounded-[var(--radius-control)] px-3.5 py-3 text-body font-semibold text-ink-soft hover:bg-ground hover:text-ink"
            >
              How a deal works
            </button>
          </div>
          {DEMO_MODE && (
            <p className="text-sm text-ink-soft">
              No wallet or setup needed. Every click is a real transaction on Solana devnet, with test
              money.
            </p>
          )}
        </div>
      </section>

      <section aria-labelledby="who" className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)] md:gap-10">
        <h2 id="who" className="text-title font-semibold leading-snug tracking-[-0.01em]">
          For freelancers and the clients they have never met
        </h2>
        <div className="flex max-w-[62ch] flex-col gap-3">
          <p className="text-ink">
            Kasia is a freelance developer in Kraków. Her new client is a startup in another country.
            If she delivers first, they could keep the code and not pay. If they pay first, she could
            disappear. Neither can realistically take the other to court. Kept is for that deal: a
            freelance developer and a small company, paying in dollars, milestone by milestone.
          </p>
          <p className="text-ink-soft">
            They are technical, but they are not crypto people. So Kept speaks in deals, deadlines
            and dollars, and GitHub pull requests are part of the deal. Addresses and blockchain
            terms stay under &ldquo;Details&rdquo;, and every payment has a public receipt for
            anyone who wants to check.
          </p>
        </div>
      </section>

      <Steps />
      <Jobs />
      <TryIt />
      <Words />
    </div>
  );
}
