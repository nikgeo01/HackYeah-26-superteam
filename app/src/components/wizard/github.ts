// Pull-request check before create_deal (PLAN 3.9, 4.3): binding a PR that is already merged
// would pay the freelancer immediately, so the app refuses any PR that is not open.
// Uses the public GitHub API without a token (public repositories only, 60 requests per hour).

export interface PrCheck {
  pr: number;
  ok: boolean;
  /** Plain explanation shown next to the milestone. */
  message: string;
  title?: string;
  url?: string;
}

export async function checkPullRequest(
  repo: string,
  pr: number,
  signal?: AbortSignal,
): Promise<PrCheck> {
  let res: Response;
  try {
    res = await fetch(`https://api.github.com/repos/${repo}/pulls/${pr}`, {
      headers: { Accept: "application/vnd.github+json" },
      signal,
    });
  } catch {
    return {
      pr,
      ok: false,
      message: "Could not reach GitHub. Check your connection and try again.",
    };
  }
  if (res.status === 404)
    return {
      pr,
      ok: false,
      message: `Pull request #${pr} was not found in ${repo}. The repository must be public.`,
    };
  if (res.status === 403 || res.status === 429)
    return {
      pr,
      ok: false,
      message:
        "GitHub is limiting requests from this network. Wait a few minutes and try again.",
    };
  if (!res.ok)
    return {
      pr,
      ok: false,
      message: `GitHub answered with an error (${res.status}). Try again.`,
    };
  const body = (await res.json()) as {
    state?: string;
    merged?: boolean;
    merged_at?: string | null;
    title?: string;
    html_url?: string;
  };
  const base = { pr, title: body.title, url: body.html_url };
  if (body.merged || body.merged_at)
    return {
      ...base,
      ok: false,
      message: `Pull request #${pr} is already merged. Linking it would pay the freelancer at once. Use an open pull request.`,
    };
  if (body.state !== "open")
    return {
      ...base,
      ok: false,
      message: `Pull request #${pr} is closed. Use an open pull request.`,
    };
  return { ...base, ok: true, message: `Pull request #${pr} is open.` };
}
