// Demo actors (ADR-10, WP-11 4a, WP-51): two sets of six throwaway keypairs
// (Client, Worker, Arbiter 1-3, Passer-by), funded with SOL from the deployer and
// with tUSDC minted by the faucet key. Idempotent: existing keys in
// .demo/actors.json are reused and balances are only topped up to the target.
//
// Writes .demo/actors.json, app/.env.local (pitch set) and .demo/hosted.env
// (hosted set, to paste into the hosting provider).
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  createMintToInstruction,
  getAccount,
  TokenAccountNotFoundError,
} from "@solana/spl-token";
import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  type TransactionInstruction,
} from "@solana/web3.js";
import {
  ACTORS_PATH,
  SET_NAMES,
  demoActorsEnvValue,
  dotenvLine,
  ensureActorSet,
  mergeDotenv,
  readActorsFile,
  readFaucetFile,
  resolveMint,
  writeActorsFile,
  type ActorEntry,
  type SetName,
} from "./lib/actors.ts";
import { cli, numArg, run } from "./lib/cli.ts";
import { DEMO_DIR, ROOT, env } from "./lib/env.ts";
import { ata, ensureAtaIx } from "./lib/instructions.ts";
import {
  keypairFromJson,
  loadKeypair,
  writePrivateFile,
  type SecretKeyJson,
} from "./lib/keys.ts";
import {
  errorMessage,
  formatSol,
  formatTokens,
  parseTokens,
  sent,
} from "./lib/log.ts";
import { connect } from "./lib/program.ts";
import { sendTx } from "./lib/tx.ts";

const USAGE = `
Usage: node scripts/demo-setup.ts [options]

Creates (or reuses) the pitch and hosted demo actor sets and funds them.

  --set <pitch|hosted|both>  which set(s) to set up (default both)
  --pitch-sol <n>            SOL per pitch actor (default 0.25; plan minimum 0.2)
  --hosted-sol <n>           SOL per hosted actor (default 0.05)
  --pitch-tusdc <n>          tUSDC per pitch actor (default 2000)
  --hosted-tusdc <n>         tUSDC per hosted actor (default 1500)
  --no-fund                  only create keys and write the env files
  --dry-run                  print the plan; send nothing, write nothing
  -h, --help                 this text

Env: RPC_URL, ANCHOR_WALLET (deployer, pays SOL), TUSDC_MINT (else .demo/faucet.json),
     FAUCET_SECRET (JSON array; else .demo/faucet.json), PROGRAM_ID (optional)
`;

const APP_ENV_LOCAL = join(ROOT, "app/.env.local");
const HOSTED_ENV = join(DEMO_DIR, "hosted.env");

interface Targets {
  lamports: bigint;
  tokens: bigint;
}

async function tokenBalance(
  connection: Connection,
  account: PublicKey,
): Promise<bigint | null> {
  try {
    return (await getAccount(connection, account, "confirmed")).amount;
  } catch (error) {
    if (error instanceof TokenAccountNotFoundError) return null;
    throw error;
  }
}

function faucetKey(): Keypair | undefined {
  const fromEnv = env.optional("FAUCET_SECRET");
  if (fromEnv) return keypairFromJson(JSON.parse(fromEnv) as SecretKeyJson);
  const file = readFaucetFile();
  return file ? keypairFromJson(file.faucetSecretKey) : undefined;
}

/** Splits instructions into transactions of at most `size` instructions. */
function chunks<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size)
    out.push(items.slice(i, i + size));
  return out;
}

async function fundSet(
  connection: Connection,
  set: SetName,
  entries: ActorEntry[],
  targets: Targets,
  mint: PublicKey | undefined,
  payer: Keypair | undefined,
  faucet: Keypair | undefined,
  dryRun: boolean,
): Promise<void> {
  const transfers: TransactionInstruction[] = [];
  const mintGroups: TransactionInstruction[][] = [];
  console.log(
    `\n[${set}] target ${formatSol(targets.lamports)} SOL and ${formatTokens(targets.tokens)} tUSDC each`,
  );
  for (const e of entries) {
    const owner = new PublicKey(e.publicKey);
    let line = `  ${e.label.padEnd(10)} ${e.publicKey}`;
    try {
      const lamports = BigInt(await connection.getBalance(owner, "confirmed"));
      const sol =
        lamports < targets.lamports ? targets.lamports - lamports : 0n;
      line += `  SOL ${formatSol(lamports)}${sol ? ` -> +${formatSol(sol)}` : " (ok)"}`;
      if (sol && payer) {
        transfers.push(
          SystemProgram.transfer({
            fromPubkey: payer.publicKey,
            toPubkey: owner,
            lamports: sol,
          }),
        );
      }
      if (mint) {
        const account = ata(mint, owner);
        const balance = (await tokenBalance(connection, account)) ?? 0n;
        const tokens = balance < targets.tokens ? targets.tokens - balance : 0n;
        line += `  tUSDC ${formatTokens(balance)}${tokens ? ` -> +${formatTokens(tokens)}` : " (ok)"}`;
        if (tokens && payer && faucet) {
          mintGroups.push([
            ensureAtaIx(payer.publicKey, mint, owner),
            createMintToInstruction(mint, account, faucet.publicKey, tokens),
          ]);
        }
      }
    } catch (error) {
      line += `  (balance unreadable: ${errorMessage(error)})`;
    }
    console.log(line);
  }
  if (dryRun) return;
  if (!payer) throw new Error("no deployer wallet to pay from");
  for (const batch of chunks(transfers, 8)) {
    sent(
      `[${set}] SOL to ${batch.length} actor(s)`,
      await sendTx(connection, batch, [payer]),
    );
  }
  if (mintGroups.length && !faucet) {
    console.log(
      `  [${set}] skipped tUSDC: no faucet key (.demo/faucet.json or FAUCET_SECRET)`,
    );
    return;
  }
  for (const batch of chunks(mintGroups, 3)) {
    sent(
      `[${set}] tUSDC to ${batch.length} actor(s)`,
      await sendTx(connection, batch.flat(), [payer, faucet as Keypair]),
    );
  }
}

function writeEnvFiles(
  sets: Partial<Record<SetName, ActorEntry[]>>,
  mint: PublicKey | undefined,
): void {
  const faucet = readFaucetFile();
  const extras: Record<string, string> = {
    VITE_PROGRAM_ID: env.programId().toBase58(),
  };
  if (mint) extras.VITE_TUSDC_MINT = mint.toBase58();
  if (faucet && (!mint || faucet.mint === mint.toBase58())) {
    extras.VITE_FAUCET_SECRET = JSON.stringify(faucet.faucetSecretKey);
  }

  if (sets.pitch) {
    const current = existsSync(APP_ENV_LOCAL)
      ? readFileSync(APP_ENV_LOCAL, "utf8")
      : "";
    const present = new Set(
      current
        .split("\n")
        .map((l) => /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=/.exec(l)?.[1])
        .filter(Boolean),
    );
    const updates: Record<string, string> = {
      VITE_DEMO_MODE: "true",
      VITE_DEMO_ACTORS: demoActorsEnvValue(sets.pitch),
    };
    // Only fill these when missing, so a hand-edited value is never overwritten.
    for (const [k, v] of Object.entries(extras))
      if (!present.has(k)) updates[k] = v;
    writePrivateFile(APP_ENV_LOCAL, mergeDotenv(current, updates));
    console.log(
      `wrote ${APP_ENV_LOCAL} (pitch set; never commit or deploy it)`,
    );
  }
  if (sets.hosted) {
    const lines = [
      "# Hosted demo build: paste into the hosting provider's environment.",
      "# These keys are public once bundled; they hold only test tokens.",
      dotenvLine("VITE_CLUSTER", "devnet"),
      ...Object.entries(extras).map(([k, v]) => dotenvLine(k, v)),
      dotenvLine("VITE_DEMO_MODE", "true"),
      dotenvLine("VITE_DEMO_ACTORS", demoActorsEnvValue(sets.hosted)),
    ];
    writePrivateFile(HOSTED_ENV, lines.join("\n") + "\n");
    console.log(`wrote ${HOSTED_ENV} (hosted set)`);
  }
}

run(async () => {
  const args = cli(USAGE, {
    set: { type: "string" },
    "pitch-sol": { type: "string" },
    "hosted-sol": { type: "string" },
    "pitch-tusdc": { type: "string" },
    "hosted-tusdc": { type: "string" },
    "no-fund": { type: "boolean" },
    "dry-run": { type: "boolean" },
  });
  const which = args.set ?? "both";
  if (which !== "both" && !SET_NAMES.includes(which as SetName))
    throw new Error("--set must be pitch, hosted or both");
  const sets: SetName[] =
    which === "both" ? [...SET_NAMES] : [which as SetName];
  const dryRun = args["dry-run"] === true;
  const fund = args["no-fund"] !== true;
  const sol = (n: number) => BigInt(Math.round(n * LAMPORTS_PER_SOL));
  const targets: Record<SetName, Targets> = {
    pitch: {
      lamports: sol(numArg(args["pitch-sol"], "pitch-sol", 0.25)),
      tokens: parseTokens(args["pitch-tusdc"] ?? "2000"),
    },
    hosted: {
      lamports: sol(numArg(args["hosted-sol"], "hosted-sol", 0.05)),
      tokens: parseTokens(args["hosted-tusdc"] ?? "1500"),
    },
  };

  const file = readActorsFile();
  const result: Partial<Record<SetName, ActorEntry[]>> = {};
  for (const set of sets) {
    const { entries, created } = ensureActorSet(file, set);
    result[set] = entries;
    file.sets[set] = entries;
    console.log(
      `[${set}] ${created.length ? `${dryRun ? "would generate" : "generated"} ${created.join(", ")}` : "reusing all six keys"}`,
    );
  }

  let mint: PublicKey | undefined;
  try {
    mint = resolveMint();
  } catch (error) {
    console.log(`note: ${errorMessage(error)} (tUSDC funding skipped)`);
  }

  const connection = connect();
  console.log(`RPC ${env.rpcUrl()}; mint ${mint?.toBase58() ?? "(none)"}`);
  let payer: Keypair | undefined;
  if (fund && !dryRun) payer = loadKeypair(env.walletPath());
  else if (existsSync(env.walletPath())) payer = loadKeypair(env.walletPath());
  if (payer) console.log(`Deployer ${payer.publicKey.toBase58()}`);
  const faucet = faucetKey();

  if (!dryRun) {
    writeActorsFile(file);
    console.log(`wrote ${ACTORS_PATH}`);
    writeEnvFiles(result, mint);
  }

  if (fund) {
    for (const set of sets) {
      await fundSet(
        connection,
        set,
        result[set] as ActorEntry[],
        targets[set],
        mint,
        payer,
        faucet,
        dryRun,
      );
    }
  }
  if (dryRun) console.log("\n--dry-run: nothing sent, nothing written.");
});
