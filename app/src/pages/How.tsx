// "How it works and limits" (PLAN 4.1, WP-51): the rules as one readable document. Payouts and
// "if someone disappears" are ledgers, permissions a compact table with the role shapes, and the
// live upgrade status of the program closes it.
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  DISAPPEAR_NOTE,
  DISAPPEAR_ROWS,
  LIMITS,
  PAYOUT_NOTE,
  PAYOUT_ROWS,
  PERMISSION_NOTE,
  PERMISSION_ROWS,
  RULES,
  type Allowed,
} from "../components/how/content";
import { UpgradeStatus } from "../components/how/UpgradeStatus";
import { RoleMark, type RoleShape } from "../components/RoleSwitcher";
import { Heading } from "../components/ui";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-4 border-t border-rule pt-8">
      <Heading level={2}>{title}</Heading>
      {children}
    </section>
  );
}

const Note = ({ children }: { children: ReactNode }) => (
  <p className="text-sm text-ink-soft">{children}</p>
);

const ROLES: { key: "client" | "worker" | "arbiter" | "anyone"; label: string; shape: RoleShape }[] = [
  { key: "client", label: "Client", shape: "client" },
  { key: "worker", label: "Freelancer", shape: "worker" },
  { key: "arbiter", label: "Arbiters", shape: "arbiter" },
  { key: "anyone", label: "Anyone", shape: "stranger" },
];

function Cell({ allowed, shape }: { allowed: Allowed | undefined; shape: RoleShape }) {
  if (!allowed) return <span className="sr-only">No</span>;
  return (
    <span className="inline-flex flex-col items-center gap-1">
      <RoleMark shape={shape} />
      <span className={allowed === true ? "sr-only" : "text-micro leading-tight text-ink-soft"}>
        {allowed === true ? "Yes" : allowed}
      </span>
    </span>
  );
}

export default function How() {
  return (
    <article className="max-w-[68ch] space-y-8">
      <header className="space-y-3">
        <Heading level={1}>How it works, and where it stops</Heading>
        <p className="text-lead leading-snug text-ink-soft">
          Kept replaces the freelance platform in the middle with a small public program on Solana.
          It holds the money, runs fixed timers, and lets three arbiters settle disagreements. This
          page says exactly what it does, and what it cannot do.
        </p>
      </header>

      <Section title="The rules">
        <ol className="list-decimal space-y-3 pl-5 marker:font-semibold marker:text-ink-soft">
          {RULES.map((r) => (
            <li key={r} className="pl-1">
              {r}
            </li>
          ))}
        </ol>
      </Section>

      <Section title="Who gets paid when">
        <p>
          When a milestone is settled, the program checks these cases from the top. The first one that
          applies decides what <RoleMark shape="worker" className="mx-0.5" /> the freelancer and{" "}
          <RoleMark shape="client" className="mx-0.5" /> the client get.
        </p>
        <ol className="ledger border-y border-rule">
          {PAYOUT_ROWS.map((r, i) => (
            <li key={r.when} className="grid gap-x-4 gap-y-2 py-3 sm:grid-cols-[1.5rem_minmax(0,1fr)_15rem]">
              <span className="figures hidden text-sm text-ink-soft sm:block">{i + 1}</span>
              <p className="text-sm font-medium">{r.when}</p>
              <dl className="space-y-1 text-sm">
                <div className="flex items-baseline gap-2">
                  <dt className="pt-[0.1em]">
                    <RoleMark shape="worker" />
                    <span className="sr-only">Freelancer</span>
                  </dt>
                  <dd className={r.freelancer === "Nothing" ? "text-ink-soft" : ""}>{r.freelancer}</dd>
                </div>
                <div className="flex items-baseline gap-2">
                  <dt>
                    <RoleMark shape="client" />
                    <span className="sr-only">Client</span>
                  </dt>
                  <dd className={r.client === "Nothing" ? "text-ink-soft" : ""}>{r.client}</dd>
                </div>
              </dl>
            </li>
          ))}
        </ol>
        <Note>
          {PAYOUT_NOTE} Nothing is
          ever kept as a fee: the whole milestone, and any deposit, is paid out.
        </Note>
      </Section>

      <Section title="If someone disappears">
        <p>Every step has a deadline, so money is never stuck because someone stopped answering.</p>
        <dl className="ledger border-y border-rule">
          {DISAPPEAR_ROWS.map((r) => (
            <div key={r.who} className="grid gap-x-6 gap-y-1 py-3 sm:grid-cols-[minmax(0,14rem)_minmax(0,1fr)]">
              <dt className="text-sm font-medium">{r.who}</dt>
              <dd className="text-sm">
                <span className="font-semibold">{r.by}.</span>{" "}
                <span className="text-ink-soft">{r.what}</span>
              </dd>
            </div>
          ))}
        </dl>
        <Note>{DISAPPEAR_NOTE}</Note>
      </Section>

      <Section title="Who can do what">
        <div className="relative -mx-1 overflow-x-auto px-1">
          <table className="w-full min-w-[30rem] border-y border-rule text-sm">
            <thead>
              <tr className="border-b border-rule text-left">
                <th scope="col" className="py-2 pr-4 font-medium text-ink-soft">
                  Action
                </th>
                {ROLES.map((r) => (
                  <th key={r.key} scope="col" className="w-[4.75rem] px-1 py-2 text-center font-medium">
                    <span className="inline-flex flex-col items-center gap-1">
                      <RoleMark shape={r.shape} />
                      {r.label}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {PERMISSION_ROWS.map((row) => (
                <tr key={row.action} className="border-t border-rule-soft first:border-t-0">
                  <th scope="row" className="py-2.5 pr-4 text-left font-normal">
                    {row.action}
                  </th>
                  {ROLES.map((r) => (
                    <td key={r.key} className="px-1 py-2.5 text-center align-middle">
                      <Cell allowed={row[r.key]} shape={r.shape} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Note>{PERMISSION_NOTE}</Note>
      </Section>

      <Section title="Honest limits">
        <ul className="list-disc space-y-3 pl-5 marker:text-ink-soft">
          {LIMITS.map((l) => (
            <li key={l} className="pl-1">
              {l}
            </li>
          ))}
        </ul>
      </Section>

      <Section title="The program">
        <p>
          The rules above are the code of one Solana program. Anyone can inspect it, and every payment
          it has made, on the public explorer.
        </p>
        <UpgradeStatus />
      </Section>

      <div className="flex flex-wrap items-center gap-4 border-t border-rule pt-8">
        <Link
          to="/new"
          className="inline-flex items-center rounded-[var(--radius-control)] border border-stamp bg-stamp px-3.5 py-2 text-sm font-semibold text-sheet hover:bg-stamp-deep"
        >
          Create a deal
        </Link>
        <Link
          to="/deals"
          className="text-sm font-semibold text-ink underline decoration-ink/35 underline-offset-[3px] hover:decoration-stamp"
        >
          See my deals
        </Link>
      </div>
    </article>
  );
}
