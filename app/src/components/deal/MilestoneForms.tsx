// Two small forms on a milestone card: the freelancer delivers work, and the client links a
// pull request (checked open on GitHub first, PLAN 4.3 last paragraph).
import { useState } from "react";
import { useProgram } from "../../hooks/useProgram";
import { useTx } from "../../hooks/useTx";
import { useActor } from "../../providers/ActorProvider";
import type { DealView, MilestoneInfo } from "../../lib/deals";
import { COPY, type ExplainedError } from "../../lib/errors";
import {
  hashDeliverable,
  setProofTargetIx,
  submitWorkIx,
} from "../../lib/instructions";
import { ErrorBanner } from "../ErrorDetails";
import { Btn, localError, Spinner } from "./common";

/** Bytes of the deliverable link the program accepts (MAX_URI_LEN). */
const MAX_URI_BYTES = 128;

export function DeliverWorkForm({
  deal,
  milestone,
}: {
  deal: DealView;
  milestone: MilestoneInfo;
}) {
  const program = useProgram();
  const { publicKey } = useActor();
  const { send, busy } = useTx();
  const [uri, setUri] = useState("");
  const [error, setError] = useState<ExplainedError | null>(null);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const link = uri.trim();
    if (!link) {
      setError(localError("Paste a link to your work first."));
      return;
    }
    if (new TextEncoder().encode(link).length > MAX_URI_BYTES) {
      setError(localError("The link is too long (128 characters at most)."));
      return;
    }
    setError(null);
    void send("Deliver work", async () => {
      if (!publicKey) throw new Error(COPY.noWallet);
      const hash = await hashDeliverable(link);
      const ix = await submitWorkIx(program, {
        worker: publicKey,
        deal: deal.address,
        index: milestone.index,
        deliverableHash: hash,
        uri: link,
      });
      return { instructions: [ix] };
    }).then((sig) => {
      if (sig) setUri("");
    });
  };

  return (
    <form
      onSubmit={submit}
      className="space-y-2 rounded-xl border-2 border-emerald-200 bg-emerald-50/50 p-4"
    >
      <label
        htmlFor={`uri-${milestone.index}`}
        className="block text-sm font-semibold text-slate-900"
      >
        Deliver work
      </label>
      <p className="text-xs text-slate-600">
        Paste a link to what you delivered (a pull request, a release, a
        document). The app stores its fingerprint (SHA-256) on Solana, and the
        client's review time starts.
      </p>
      <div className="flex flex-wrap gap-2">
        <input
          id={`uri-${milestone.index}`}
          type="url"
          inputMode="url"
          placeholder="https://github.com/owner/repo/pull/12"
          value={uri}
          onChange={(e) => setUri(e.target.value)}
          className="min-w-0 flex-1 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
        />
        <Btn type="submit" variant="success" disabled={busy}>
          {busy && <Spinner />}Deliver work
        </Btn>
      </div>
      {error && <ErrorBanner error={error} onClose={() => setError(null)} />}
    </form>
  );
}

interface GithubPull {
  state?: string;
  merged?: boolean;
  title?: string;
}

/** Asks the public GitHub API whether `repo` has an open pull request #n. Throws plain copy. */
async function checkPullIsOpen(repo: string, n: number): Promise<GithubPull> {
  let res: Response;
  try {
    res = await fetch(`https://api.github.com/repos/${repo}/pulls/${n}`, {
      headers: { Accept: "application/vnd.github+json" },
    });
  } catch (err) {
    throw new Error(
      `Could not reach GitHub to check the pull request. (${String(err)})`,
    );
  }
  if (res.status === 404)
    throw new Error(
      `There is no pull request #${n} in ${repo} (or the repository is private).`,
    );
  if (res.status === 403 || res.status === 429)
    throw new Error(
      "GitHub's rate limit was hit. Wait a minute and try again.",
    );
  if (!res.ok)
    throw new Error(`GitHub answered with an error (HTTP ${res.status}).`);
  const pull = (await res.json()) as GithubPull;
  if (pull.merged)
    throw new Error(
      `Pull request #${n} is already merged. Linking it would release the payment at once, so it is refused.`,
    );
  if (pull.state !== "open")
    throw new Error(
      `Pull request #${n} is closed. Only an open pull request can be linked.`,
    );
  return pull;
}

export function LinkPullRequestForm({
  deal,
  milestone,
}: {
  deal: DealView;
  milestone: MilestoneInfo;
}) {
  const program = useProgram();
  const { publicKey } = useActor();
  const { send, busy } = useTx();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<ExplainedError | null>(null);

  if (!open)
    return (
      <Btn variant="secondary" onClick={() => setOpen(true)}>
        Link a pull request
      </Btn>
    );

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const n = Number(value.trim().replace(/^#/, ""));
    if (!Number.isInteger(n) || n <= 0 || n > 0xffffffff) {
      setError(localError("Enter the pull request number, for example 12."));
      return;
    }
    if (deal.milestones.some((m) => m.proofRef === n)) {
      setError(
        localError(
          `Pull request #${n} is already linked to another milestone.`,
        ),
      );
      return;
    }
    setChecking(true);
    try {
      await checkPullIsOpen(deal.proofRepo, n);
    } catch (err) {
      setError(
        localError(
          err instanceof Error ? err.message : String(err),
          String(err),
        ),
      );
      return;
    } finally {
      setChecking(false);
    }
    const sig = await send(`Link pull request #${n}`, async () => {
      if (!publicKey) throw new Error(COPY.noWallet);
      const ix = await setProofTargetIx(program, {
        client: publicKey,
        deal: deal.address,
        index: milestone.index,
        prNumber: n,
      });
      return { instructions: [ix] };
    });
    if (sig) {
      setOpen(false);
      setValue("");
    }
  };

  return (
    <form
      onSubmit={(e) => void submit(e)}
      className="space-y-2 rounded-xl border border-violet-200 bg-violet-50/50 p-4"
    >
      <label
        htmlFor={`pr-${milestone.index}`}
        className="block text-sm font-semibold text-slate-900"
      >
        Link a pull request in {deal.proofRepo}
      </label>
      <p className="text-xs text-slate-600">
        Merging this pull request will be your acceptance: it releases this
        payment. This can be set once and never changed. Only use a repository
        where you decide what gets merged.
      </p>
      <div className="flex flex-wrap gap-2">
        <input
          id={`pr-${milestone.index}`}
          inputMode="numeric"
          placeholder="12"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="w-28 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
        />
        <Btn type="submit" variant="proof" disabled={busy || checking}>
          {(busy || checking) && <Spinner />}
          {checking ? "Checking GitHub…" : "Check and link"}
        </Btn>
        <Btn
          variant="ghost"
          onClick={() => setOpen(false)}
          disabled={busy || checking}
        >
          Cancel
        </Btn>
      </div>
      {error && <ErrorBanner error={error} onClose={() => setError(null)} />}
    </form>
  );
}
