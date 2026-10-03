// The permissionless crank (WP-31): scans every deal of the program, asks the
// payout rule mirror (client/rules.ts) what `settle_milestone` would pay at the
// current chain time, and settles everything that is settleable. Anyone can run
// this with any funded wallet; it can only ever pay a deal's client or worker.
//
// Recipient token accounts are passed only for a side whose payout is non-zero,
// and are created idempotently in the same transaction.
import { getAccount, TokenAccountNotFoundError } from "@solana/spl-token";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { vaultAddress } from "../client/pdas.ts";
import { decideOutcome } from "../client/rules.ts";
import { cli, intArg, run } from "./lib/cli.ts";
import { chainNow, fetchAllDeals, type DealInfo } from "./lib/deal.ts";
import { env, expandHome } from "./lib/env.ts";
import { closeIxs, settleIxs } from "./lib/instructions.ts";
import { loadKeypair } from "./lib/keys.ts";
import { errorMessage, formatTokens, sent } from "./lib/log.ts";
import { connect, loadProgram, type EscrowProgram } from "./lib/program.ts";
import { sendTx } from "./lib/tx.ts";

const USAGE = `
Usage: node scripts/crank.ts [options]

Settles every milestone that the payout rule says is settleable now (chain time).

  --deal <address>   only this deal
  --close            also close fully settled deals (rent goes back to the client)
  --watch            keep running, scanning every --interval seconds
  --interval <secs>  scan interval for --watch (default 10)
  --dry-run          print what would be settled; send nothing (no wallet needed)
  -h, --help         this text

Env: RPC_URL, PROGRAM_ID, CRANK_WALLET (else ANCHOR_WALLET, else ~/.config/solana/id.json)
`;

interface Options {
  close: boolean;
  dryRun: boolean;
  only?: PublicKey;
}

async function vaultBalance(
  connection: Connection,
  program: EscrowProgram,
  deal: PublicKey,
): Promise<bigint> {
  try {
    return (
      await getAccount(
        connection,
        vaultAddress(program.programId, deal),
        "confirmed",
      )
    ).amount;
  } catch (error) {
    if (error instanceof TokenAccountNotFoundError) return 0n;
    throw error;
  }
}

/** One scan. Returns the number of transactions sent (or that would be sent). */
async function scan(
  connection: Connection,
  program: EscrowProgram,
  cranker: Keypair,
  opts: Options,
): Promise<number> {
  const [deals, now] = await Promise.all([
    fetchAllDeals(connection, program),
    chainNow(connection),
  ]);
  const scoped = opts.only
    ? deals.filter((d) => d.address.equals(opts.only as PublicKey))
    : deals;
  let actions = 0;
  for (const deal of scoped) {
    actions += await settleDeal(connection, program, cranker, deal, now, opts);
    if (opts.close)
      actions += await closeIfDone(connection, program, cranker, deal, opts);
  }
  console.log(
    `[${new Date().toISOString()}] chain time ${now}: ${scoped.length} deal(s) scanned, ${actions} action(s)`,
  );
  return actions;
}

async function settleDeal(
  connection: Connection,
  program: EscrowProgram,
  cranker: Keypair,
  deal: DealInfo,
  now: number,
  opts: Options,
): Promise<number> {
  let actions = 0;
  for (const m of deal.milestones) {
    const payout = decideOutcome(deal.status, m, now);
    if (!payout) continue;
    const what =
      `${deal.address.toBase58()} #${m.index} (${m.status}${deal.status === "cancelled" ? ", deal cancelled" : ""}): ` +
      `${payout.outcome}, worker ${formatTokens(payout.toWorker)}, client ${formatTokens(payout.toClient)} tUSDC`;
    actions++;
    if (opts.dryRun) {
      console.log(`  would settle ${what}`);
      continue;
    }
    try {
      const ixs = await settleIxs(
        program,
        cranker.publicKey,
        deal,
        m.index,
        payout,
      );
      sent(`settled ${what}`, await sendTx(connection, ixs, [cranker]));
      m.status = "settled";
      deal.settledCount++;
    } catch (error) {
      // Another cranker may have won the race, or chain time moved; the next scan retries.
      console.log(`  failed ${what}: ${errorMessage(error)}`);
    }
  }
  return actions;
}

async function closeIfDone(
  connection: Connection,
  program: EscrowProgram,
  cranker: Keypair,
  deal: DealInfo,
  opts: Options,
): Promise<number> {
  if (deal.settledCount !== deal.milestones.length) return 0;
  const balance = await vaultBalance(connection, program, deal.address);
  const what = `${deal.address.toBase58()} (vault remainder ${formatTokens(balance)} tUSDC to the client)`;
  if (opts.dryRun) {
    console.log(`  would close ${what}`);
    return 1;
  }
  try {
    sent(
      `closed ${what}`,
      await sendTx(
        connection,
        await closeIxs(program, cranker.publicKey, deal, balance),
        [cranker],
      ),
    );
  } catch (error) {
    console.log(`  failed to close ${what}: ${errorMessage(error)}`);
  }
  return 1;
}

run(async () => {
  const args = cli(USAGE, {
    deal: { type: "string" },
    close: { type: "boolean" },
    watch: { type: "boolean" },
    interval: { type: "string" },
    "dry-run": { type: "boolean" },
  });
  const opts: Options = {
    close: args.close === true,
    dryRun: args["dry-run"] === true,
    only: args.deal ? new PublicKey(args.deal) : undefined,
  };
  const interval = intArg(args.interval, "interval", 10);
  const walletPath = expandHome(
    env.optional("CRANK_WALLET") ?? env.walletPath(),
  );
  const cranker = opts.dryRun ? Keypair.generate() : loadKeypair(walletPath);
  const connection = connect();
  const program = loadProgram(connection, cranker);
  console.log(
    `Crank on ${env.rpcUrl()}, program ${program.programId.toBase58()}` +
      (opts.dryRun
        ? " (dry run)"
        : `, cranker ${cranker.publicKey.toBase58()}`),
  );

  if (!args.watch) {
    await scan(connection, program, cranker, opts);
    return;
  }
  for (;;) {
    try {
      await scan(connection, program, cranker, opts);
    } catch (error) {
      console.log(`scan failed: ${errorMessage(error)}`);
    }
    await new Promise((resolve) => setTimeout(resolve, interval * 1000));
  }
});
