// The prover (WP-41): a stateless HTTP wrapper around client/proof.ts.
//
//   POST /prove { "deal": "<address>", "index": 0 }  ->  ProofArgs JSON
//
// It reads the Deal from chain and asks the attestor to witness exactly the URL
// stored in that deal, so it can only ever request a deal's own pull request.
// It ENFORCES NOTHING: the program verifies every proof itself and rejects one
// that does not match the deal. Delete this service and nothing becomes unsafe.
// It holds RECLAIM_APP_SECRET and GITHUB_PAT and never returns either.
import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import { PublicKey } from "@solana/web3.js";
import { proveMilestone } from "../client/proof.ts";
import { errorMessage } from "../scripts/lib/log.ts";
import { env } from "../scripts/lib/env.ts";
import { connect, loadProgram } from "../scripts/lib/program.ts";

const PORT = Number(env.optional("PORT") ?? 8787);
const ALLOWED_ORIGINS = (env.optional("APP_ORIGIN") ?? "http://localhost:5173")
  .split(",")
  .map((o) => o.trim().replace(/\/+$/, ""))
  .filter(Boolean);
const RATE_LIMIT = Number(env.optional("PROVER_RATE_LIMIT") ?? 6); // requests per window per IP
const RATE_WINDOW_MS =
  Number(env.optional("PROVER_RATE_WINDOW_SECS") ?? 600) * 1000;
const MAX_BODY_BYTES = 1024;
const MAX_MILESTONES = 5;

const creds = {
  appId: env.required("RECLAIM_APP_ID"),
  appSecret: env.required("RECLAIM_APP_SECRET"),
  githubToken: env.optional("GITHUB_PAT"),
};
const secrets = [creds.appSecret, creds.githubToken].filter((s): s is string =>
  Boolean(s),
);
const program = loadProgram(connect());

/** Removes any secret from text that leaves the process (responses and logs). */
function scrub(text: string): string {
  let out = text;
  for (const s of secrets) out = out.split(s).join("[redacted]");
  return out.replace(
    /(authorization["']?\s*[:=]\s*["']?)(bearer\s+)?[^"',\s}]+/gi,
    "$1[redacted]",
  );
}

const hits = new Map<string, number[]>();
function rateLimited(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  const limited = recent.length >= RATE_LIMIT;
  if (!limited) recent.push(now);
  hits.set(ip, recent);
  return limited;
}
setInterval(() => {
  const now = Date.now();
  for (const [ip, times] of hits)
    if (times.every((t) => now - t >= RATE_WINDOW_MS)) hits.delete(ip);
}, RATE_WINDOW_MS).unref();

// Behind a hosting proxy (TRUST_PROXY=1) every request comes from the proxy, so the
// rate limit keys on the first X-Forwarded-For address instead.
const TRUST_PROXY = env.optional("TRUST_PROXY") === "1";
function clientIp(req: IncomingMessage): string {
  const forwarded = req.headers["x-forwarded-for"];
  const first = (Array.isArray(forwarded) ? forwarded[0] : forwarded)
    ?.split(",")[0]
    ?.trim();
  if (TRUST_PROXY && first) return first;
  return req.socket.remoteAddress ?? "unknown";
}

function cors(req: IncomingMessage, res: ServerResponse): void {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.setHeader("Access-Control-Max-Age", "600");
  }
}

function send(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(body));
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let size = 0;
    const parts: Buffer[] = [];
    req.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new Error("body too large"));
        req.destroy();
        return;
      }
      parts.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(parts).toString("utf8")));
    req.on("error", reject);
  });
}

/** Input shape only: a base58 address and a milestone index. No allow or deny logic. */
function parseRequest(text: string): { deal: PublicKey; index: number } {
  const body = JSON.parse(text) as { deal?: unknown; index?: unknown };
  if (typeof body.deal !== "string")
    throw new Error("deal must be a base58 address");
  const deal = new PublicKey(body.deal);
  const index = body.index;
  if (
    typeof index !== "number" ||
    !Number.isInteger(index) ||
    index < 0 ||
    index >= MAX_MILESTONES
  ) {
    throw new Error(`index must be an integer from 0 to ${MAX_MILESTONES - 1}`);
  }
  return { deal, index };
}

const server = createServer(async (req, res) => {
  cors(req, res);
  const url = new URL(req.url ?? "/", "http://localhost");
  if (req.method === "OPTIONS") {
    res.writeHead(204).end();
    return;
  }
  if (req.method === "GET" && url.pathname === "/health") {
    send(res, 200, { ok: true, program: program.programId.toBase58() });
    return;
  }
  if (req.method !== "POST" || url.pathname !== "/prove") {
    send(res, 404, { error: "POST /prove { deal, index }" });
    return;
  }
  const ip = clientIp(req);
  if (rateLimited(ip)) {
    send(res, 429, { error: "too many requests; try again later" });
    return;
  }

  let input: { deal: PublicKey; index: number };
  try {
    input = parseRequest(await readBody(req));
  } catch (error) {
    send(res, 400, { error: `bad request: ${errorMessage(error)}` });
    return;
  }

  const started = Date.now();
  try {
    const { proof, target } = await proveMilestone(
      program,
      input.deal,
      input.index,
      creds,
      {
        contextAddress: env.optional("PROOF_CONTEXT_ADDRESS"),
      },
    );
    console.log(
      `proved ${target.url} for ${input.deal.toBase58()}#${input.index} in ${Date.now() - started} ms`,
    );
    send(res, 200, proof);
  } catch (error) {
    const message = scrub(errorMessage(error));
    console.log(
      `failed ${input.deal.toBase58()}#${input.index} after ${Date.now() - started} ms: ${message}`,
    );
    // Deal lookups and "no PR bound" are the caller's problem; anything else is upstream.
    const status =
      /Account does not exist|has no (milestone|pull request)/.test(message)
        ? 404
        : 502;
    send(res, status, { error: message });
  }
});

server.listen(PORT, () => {
  console.log(
    `prover listening on http://localhost:${PORT} (CORS: ${ALLOWED_ORIGINS.join(", ")})`,
  );
  console.log(`program ${program.programId.toBase58()} on ${env.rpcUrl()}`);
});
