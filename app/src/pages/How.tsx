// "How it works and limits" (PLAN 4.1, WP-51): rules, payout table, what if someone
// disappears, who can do what, honest limits, and the live upgrade status of the program.
import { Link } from "react-router-dom";
import {
  DISAPPEAR_NOTE,
  DISAPPEAR_ROWS,
  LIMITS,
  PAYOUT_NOTE,
  PAYOUT_ROWS,
  PERMISSION_ROWS,
  RULES,
} from "../components/how/content";
import { UpgradeStatus } from "../components/how/UpgradeStatus";

const SECTIONS = [
  ["rules", "The rules"],
  ["payouts", "Who gets paid when"],
  ["disappears", "What if someone disappears"],
  ["who", "Who can do what"],
  ["limits", "Honest limits"],
  ["program", "The program"],
] as const;

function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-4 space-y-3">
      <h2 className="text-xl font-semibold">{title}</h2>
      {children}
    </section>
  );
}

const th = "py-2 pr-4 text-left font-medium text-slate-500";
const td = "py-2 pr-4 align-top";

export default function How() {
  return (
    <div className="mx-auto max-w-3xl space-y-10">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold">How it works and its limits</h1>
        <p className="text-slate-700">
          Kept replaces the freelance platform in the middle with a small
          public program on Solana. It holds the money, applies fixed timers,
          and lets a panel of three arbiters settle disagreements. Here is
          exactly what it does, and what it cannot do.
        </p>
        <nav className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
          {SECTIONS.map(([id, label]) => (
            <a
              key={id}
              href={`#${id}`}
              onClick={(e) => {
                // HashRouter owns the URL hash, so scroll instead of navigating.
                e.preventDefault();
                document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
              }}
              className="text-indigo-700 underline underline-offset-2"
            >
              {label}
            </a>
          ))}
        </nav>
      </div>

      <Section id="rules" title="The rules">
        <ol className="list-decimal space-y-2 pl-6 text-slate-800">
          {RULES.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ol>
      </Section>

      <Section id="payouts" title="Who gets paid when">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200">
                <th className={th}>When</th>
                <th className={th}>The freelancer gets</th>
                <th className={th}>The client gets</th>
              </tr>
            </thead>
            <tbody>
              {PAYOUT_ROWS.map((r) => (
                <tr key={r.when} className="border-b border-slate-100">
                  <td className={td}>{r.when}</td>
                  <td className={td}>{r.freelancer}</td>
                  <td className={td}>{r.client}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-sm text-slate-600">{PAYOUT_NOTE}</p>
        <p className="text-sm text-slate-600">
          In every case the money in a milestone (plus any deposit) is fully
          paid out, to the client, the freelancer or both. Nothing is kept as
          a fee.
        </p>
      </Section>

      <Section id="disappears" title="What if someone disappears">
        <p className="text-sm text-slate-700">
          Every step has a deadline, so money can never be stuck because
          someone stopped answering.
        </p>
        <dl className="divide-y divide-slate-200 rounded-lg border border-slate-200">
          {DISAPPEAR_ROWS.map((r) => (
            <div key={r.who} className="grid gap-1 px-4 py-3 sm:grid-cols-[16rem_1fr]">
              <dt className="text-sm font-medium">{r.who}</dt>
              <dd className="text-sm text-slate-700">{r.what}</dd>
            </div>
          ))}
        </dl>
        <p className="text-sm text-slate-600">{DISAPPEAR_NOTE}</p>
      </Section>

      <Section id="who" title="Who can do what">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200">
                <th className={th}>Action</th>
                <th className={th}>Who</th>
              </tr>
            </thead>
            <tbody>
              {PERMISSION_ROWS.map((r) => (
                <tr key={r.action} className="border-b border-slate-100">
                  <td className={td}>{r.action}</td>
                  <td className={td}>{r.who}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-sm text-slate-600">
          There is no admin button, no fee and no pause switch in the program.
        </p>
      </Section>

      <Section id="limits" title="Honest limits">
        <ul className="list-disc space-y-2 pl-6 text-slate-800">
          {LIMITS.map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
      </Section>

      <Section id="program" title="The program">
        <p className="text-sm text-slate-700">
          The rules above are the code of one Solana program. You can inspect
          it, and every payment, on the public explorer.
        </p>
        <UpgradeStatus />
      </Section>

      <p className="text-sm">
        <Link to="/new" className="font-medium text-indigo-700 underline">
          Create a deal
        </Link>{" "}
        ·{" "}
        <Link to="/deals" className="font-medium text-indigo-700 underline">
          My deals
        </Link>
      </p>
    </div>
  );
}
