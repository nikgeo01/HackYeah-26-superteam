// Shared fixtures for the integration tests. Every test creates its own deal,
// so tests never depend on each other's state, and time only moves forward.
import * as anchor from "@anchor-lang/core";
import { Program } from "@anchor-lang/core";
import {
  MINT_SIZE,
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountIdempotentInstruction,
  createInitializeMint2Instruction,
  createMintToInstruction,
  getAccount,
  getAssociatedTokenAddressSync,
  getMinimumBalanceForRentExemptMint,
} from "@solana/spl-token";
import { expect } from "chai";
import BN from "bn.js";
import type { MilestoneEscrow } from "../target/types/milestone_escrow.ts";

const { Keypair, PublicKey, LAMPORTS_PER_SOL, SYSVAR_CLOCK_PUBKEY } =
  anchor.web3;
type Keypair = anchor.web3.Keypair;
type PublicKeyT = anchor.web3.PublicKey;

export const DECIMALS = 6;
export const UNIT = 1_000_000n;
export const DEAL_SEED = Buffer.from("deal");
export const VAULT_SEED = Buffer.from("vault");

/// Clock sysvar layout: slot, epoch_start_timestamp, epoch,
/// leader_schedule_epoch, then unix_timestamp — five 8-byte fields.
const CLOCK_UNIX_TIMESTAMP_OFFSET = 32;

anchor.setProvider(anchor.AnchorProvider.env());
export const provider = anchor.getProvider() as anchor.AnchorProvider;
export const program = anchor.workspace
  .milestoneEscrow as Program<MilestoneEscrow>;
export const connection = provider.connection;

export type Actors = {
  client: Keypair;
  worker: Keypair;
  judges: [Keypair, Keypair, Keypair];
  stranger: Keypair;
};

export type Env = Actors & {
  mint: PublicKeyT;
  mintAuthority: Keypair;
  ata: (owner: PublicKeyT) => PublicKeyT;
};

export async function confirm(signature: string) {
  const latest = await connection.getLatestBlockhash();
  await connection.confirmTransaction({ signature, ...latest });
}

async function fundedKeypair(): Promise<Keypair> {
  const kp = Keypair.generate();
  await confirm(
    await connection.requestAirdrop(kp.publicKey, 2 * LAMPORTS_PER_SOL),
  );
  return kp;
}

/// Six funded people, a fresh 6-decimal mint, and token accounts for the
/// client and the worker. The client holds 1,000 tokens.
export async function setupEnv(): Promise<Env> {
  const [client, worker, j0, j1, j2, stranger, mintAuthority] =
    await Promise.all(Array.from({ length: 7 }, fundedKeypair));
  // Token setup goes through the Anchor provider rather than spl-token's
  // helpers: their blockhash handling breaks once tests have moved the clock.
  const mintKp = Keypair.generate();
  const mint = mintKp.publicKey;
  const env: Env = {
    client,
    worker,
    judges: [j0, j1, j2],
    stranger,
    mint,
    mintAuthority,
    ata: (owner) => getAssociatedTokenAddressSync(mint, owner),
  };
  const payer = mintAuthority.publicKey;
  const tx = new anchor.web3.Transaction().add(
    anchor.web3.SystemProgram.createAccount({
      fromPubkey: payer,
      newAccountPubkey: mint,
      lamports: await getMinimumBalanceForRentExemptMint(connection),
      space: MINT_SIZE,
      programId: TOKEN_PROGRAM_ID,
    }),
    createInitializeMint2Instruction(mint, DECIMALS, payer, null),
    ...[client, worker].map((owner) =>
      createAssociatedTokenAccountIdempotentInstruction(
        payer,
        env.ata(owner.publicKey),
        owner.publicKey,
        mint,
      ),
    ),
    createMintToInstruction(
      mint,
      env.ata(client.publicKey),
      payer,
      1_000n * UNIT,
    ),
  );
  await provider.sendAndConfirm(tx, [mintAuthority, mintKp]);
  return env;
}

export type MilestoneSpec = {
  amount: bigint;
  dueSecs?: number;
  proofRef?: number;
};

export type DealOptions = {
  milestones?: MilestoneSpec[];
  acceptWindowSecs?: number;
  reviewWindowSecs?: number;
  voteWindowSecs?: number;
  disputeDeposit?: bigint;
  proofAttestor?: number[];
  proofRepo?: string;
  worker?: PublicKeyT;
  judges?: PublicKeyT[];
};

let dealCounter = Date.now();

export function dealPda(client: PublicKeyT, dealId: BN): PublicKeyT {
  return PublicKey.findProgramAddressSync(
    [DEAL_SEED, client.toBuffer(), dealId.toArrayLike(Buffer, "le", 8)],
    program.programId,
  )[0];
}

export function vaultPda(deal: PublicKeyT): PublicKeyT {
  return PublicKey.findProgramAddressSync(
    [VAULT_SEED, deal.toBuffer()],
    program.programId,
  )[0];
}

export function createDealArgs(env: Env, opts: DealOptions = {}) {
  const milestones = (opts.milestones ?? [{ amount: 100n * UNIT }]).map(
    (m) => ({
      amount: new BN(m.amount.toString()),
      dueSecs: m.dueSecs ?? 600,
      proofKind: m.proofRef ? { prMerged: {} } : { off: {} },
      proofRef: m.proofRef ?? 0,
    }),
  );
  return {
    dealId: new BN(dealCounter++),
    worker: opts.worker ?? env.worker.publicKey,
    judges: (opts.judges ?? env.judges.map((j) => j.publicKey)) as [
      PublicKeyT,
      PublicKeyT,
      PublicKeyT,
    ],
    acceptWindowSecs: opts.acceptWindowSecs ?? 600,
    reviewWindowSecs: opts.reviewWindowSecs ?? 30,
    voteWindowSecs: opts.voteWindowSecs ?? 30,
    disputeDeposit: new BN((opts.disputeDeposit ?? 10n * UNIT).toString()),
    proofAttestor: opts.proofAttestor ?? Array(20).fill(0),
    proofRepo: opts.proofRepo ?? "",
    milestones,
  };
}

/// Creates and funds a deal; returns its addresses.
export async function createDeal(env: Env, opts: DealOptions = {}) {
  const args = createDealArgs(env, opts);
  const deal = dealPda(env.client.publicKey, args.dealId);
  const vault = vaultPda(deal);
  await program.methods
    .createDeal(args)
    .accountsPartial({
      client: env.client.publicKey,
      deal,
      mint: env.mint,
      vault,
      clientToken: env.ata(env.client.publicKey),
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .signers([env.client])
    .rpc();
  return { deal, vault, args };
}

/// Creates a deal and has the worker accept it.
export async function activeDeal(env: Env, opts: DealOptions = {}) {
  const created = await createDeal(env, opts);
  await accept(env, created.deal);
  return created;
}

export function accept(env: Env, deal: PublicKeyT) {
  return program.methods
    .acceptDeal()
    .accountsPartial({ worker: env.worker.publicKey, deal })
    .signers([env.worker])
    .rpc();
}

export function submit(env: Env, deal: PublicKeyT, index: number) {
  return program.methods
    .submitWork(index, Array(32).fill(index + 1), "https://example.com/pr")
    .accountsPartial({ worker: env.worker.publicKey, deal })
    .signers([env.worker])
    .rpc();
}

export function approve(env: Env, deal: PublicKeyT, index: number) {
  return program.methods
    .approveMilestone(index)
    .accountsPartial({ client: env.client.publicKey, deal })
    .signers([env.client])
    .rpc();
}

export function openDispute(env: Env, deal: PublicKeyT, index: number) {
  return program.methods
    .openDispute(index)
    .accountsPartial({
      client: env.client.publicKey,
      deal,
      mint: env.mint,
      vault: vaultPda(deal),
      clientToken: env.ata(env.client.publicKey),
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .signers([env.client])
    .rpc();
}

export function vote(
  deal: PublicKeyT,
  judge: Keypair,
  index: number,
  side: "worker" | "client",
) {
  return program.methods
    .castVote(index, side === "worker" ? { worker: {} } : { client: {} })
    .accountsPartial({ judge: judge.publicKey, deal })
    .signers([judge])
    .rpc();
}

export function cancel(deal: PublicKeyT, signer: Keypair, agree = true) {
  return program.methods
    .cancelDeal(agree)
    .accountsPartial({ signer: signer.publicKey, deal })
    .signers([signer])
    .rpc();
}

/// Settles a milestone as `cranker` (a stranger by default). Recipient token
/// accounts default to both parties' ATAs; pass `null` to omit one.
export function settle(
  env: Env,
  deal: PublicKeyT,
  index: number,
  opts: {
    cranker?: Keypair;
    workerToken?: PublicKeyT | null;
    clientToken?: PublicKeyT | null;
  } = {},
) {
  const cranker = opts.cranker ?? env.stranger;
  return program.methods
    .settleMilestone(index)
    .accountsPartial({
      cranker: cranker.publicKey,
      deal,
      mint: env.mint,
      vault: vaultPda(deal),
      workerToken:
        opts.workerToken === undefined
          ? env.ata(env.worker.publicKey)
          : opts.workerToken,
      clientToken:
        opts.clientToken === undefined
          ? env.ata(env.client.publicKey)
          : opts.clientToken,
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .signers([cranker])
    .rpc();
}

export function closeDeal(env: Env, deal: PublicKeyT) {
  return program.methods
    .closeDeal()
    .accountsPartial({
      cranker: env.stranger.publicKey,
      deal,
      client: env.client.publicKey,
      mint: env.mint,
      vault: vaultPda(deal),
      clientToken: env.ata(env.client.publicKey),
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .signers([env.stranger])
    .rpc();
}

export async function balance(account: PublicKeyT): Promise<bigint> {
  return (await getAccount(connection, account)).amount;
}

export function fetchDeal(deal: PublicKeyT) {
  return program.account.deal.fetch(deal);
}

/// The chain clock, not the wall clock, decides deadlines — so tests read the
/// same Clock sysvar the program does.
export async function chainNow(): Promise<number> {
  const clock = await connection.getAccountInfo(SYSVAR_CLOCK_PUBKEY);
  if (clock === null) throw new Error("clock sysvar is unreadable");
  return Number(clock.data.readBigInt64LE(CLOCK_UNIX_TIMESTAMP_OFFSET));
}

/// Jump the chain clock instead of waiting for it.
///
/// `anchor test` runs on Surfpool, which only produces blocks when a
/// transaction arrives, so sleeping never advances the clock.
/// `surfnet_timeTravel` takes milliseconds and only moves forward.
export async function timeTravelTo(unixSeconds: number) {
  const response = await fetch(connection.rpcEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "surfnet_timeTravel",
      params: [{ absoluteTimestamp: unixSeconds * 1000 }],
    }),
  });
  const { error } = (await response.json()) as { error?: { data?: string } };
  if (error) throw new Error(`surfnet_timeTravel failed: ${error.data}`);
}

/// Travel to `deadline + 1` (strictly past it).
export async function passDeadline(deadline: BN | number) {
  await timeTravelTo(Number(deadline) + 1);
}

export async function expectError(promise: Promise<unknown>, code: string) {
  try {
    await promise;
  } catch (error) {
    const anchorError = error as anchor.AnchorError;
    const actual =
      anchorError.error?.errorCode?.code ??
      String((error as Error).message ?? error);
    expect(actual).to.contain(code);
    return;
  }
  throw new Error(`expected the instruction to fail with ${code}`);
}

/// Invariant I4: the vault holds at least every unsettled amount plus every
/// locked deposit.
export async function assertVaultInvariant(deal: PublicKeyT) {
  const account = await fetchDeal(deal);
  let owed = 0n;
  for (const m of account.milestones) {
    if (!("settled" in m.status)) {
      owed += BigInt(m.amount.toString()) + BigInt(m.depositLocked.toString());
    }
  }
  expect(await balance(vaultPda(deal))).to.be.at.least(owed);
}

export const statusOf = (s: object) => Object.keys(s)[0];
