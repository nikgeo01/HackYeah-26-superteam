// Instruction builders for all 11 instructions. They return instructions and never send:
// sending lives in tx.ts (PLAN 5.2). Every account is passed explicitly (accountsStrict).
import type { Program } from "@anchor-lang/core";
import BN from "bn.js";
import {
  ComputeBudgetProgram,
  PublicKey,
  SystemProgram,
  type TransactionInstruction,
} from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import type { Payout } from "@client/rules";
import type { MilestoneEscrow } from "./idl";
import type { DealView, ProofKindName } from "./deals";
import { ata, dealPda, vaultPda } from "./pdas";
import {
  payoutFor,
  votesAfter,
  voteDecides,
  type Assume,
  type SideName,
} from "./outcomes";
import { enumValue } from "./format";
import type { AtaSpec } from "./tx";

type EscrowProgram = Program<MilestoneEscrow>;

/** Compute budget for `submit_proof` (secp256k1 recovery plus hashing). */
export const SUBMIT_PROOF_COMPUTE_UNITS = 400_000;

// ---------------------------------------------------------------- create_deal

export interface MilestoneInputValue {
  /** Raw base units (6 decimals). */
  amount: bigint;
  dueSecs: number;
  proofKind?: ProofKindName;
  /** Pull request number, 0 = none. */
  proofRef?: number;
}

export interface CreateDealInput {
  dealId: bigint;
  worker: PublicKey;
  judges: [PublicKey, PublicKey, PublicKey];
  acceptWindowSecs: number;
  reviewWindowSecs: number;
  voteWindowSecs: number;
  disputeDeposit: bigint;
  /** 20 bytes; all zero disables proofs. */
  proofAttestor: Uint8Array | number[];
  proofRepo: string;
  milestones: MilestoneInputValue[];
}

/** "0x2448…" to 20 bytes; empty string gives all zeros. Throws on malformed input. */
export function attestorBytes(hex: string): number[] {
  const text = hex.trim().toLowerCase().replace(/^0x/, "");
  if (text === "") return new Array<number>(20).fill(0);
  if (!/^[0-9a-f]{40}$/.test(text))
    throw new Error(
      "The attestor address must be 0x followed by 40 hex characters",
    );
  return Array.from({ length: 20 }, (_, i) =>
    parseInt(text.slice(i * 2, i * 2 + 2), 16),
  );
}

/** create_deal; the client funds the vault from their tUSDC associated token account. */
export async function createDealIx(
  program: EscrowProgram,
  p: { client: PublicKey; mint: PublicKey; input: CreateDealInput },
): Promise<{ ix: TransactionInstruction; deal: PublicKey; vault: PublicKey }> {
  const { client, mint, input } = p;
  const deal = dealPda(client, input.dealId, program.programId);
  const vault = vaultPda(deal, program.programId);
  const ix = await program.methods
    .createDeal({
      dealId: new BN(input.dealId.toString()),
      worker: input.worker,
      judges: input.judges,
      acceptWindowSecs: input.acceptWindowSecs,
      reviewWindowSecs: input.reviewWindowSecs,
      voteWindowSecs: input.voteWindowSecs,
      disputeDeposit: new BN(input.disputeDeposit.toString()),
      proofAttestor: Array.from(input.proofAttestor),
      proofRepo: input.proofRepo,
      milestones: input.milestones.map((m) => ({
        amount: new BN(m.amount.toString()),
        dueSecs: m.dueSecs,
        proofKind: enumValue(m.proofKind ?? "off"),
        proofRef: m.proofRef ?? 0,
      })),
    })
    .accountsStrict({
      client,
      deal,
      mint,
      vault,
      clientToken: ata(mint, client),
      tokenProgram: TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    })
    .instruction();
  return { ix, deal, vault };
}

// ---------------------------------------------------------------- party actions

export function acceptDealIx(
  program: EscrowProgram,
  p: { worker: PublicKey; deal: PublicKey },
) {
  return program.methods
    .acceptDeal()
    .accountsStrict({ worker: p.worker, deal: p.deal })
    .instruction();
}

export function submitWorkIx(
  program: EscrowProgram,
  p: {
    worker: PublicKey;
    deal: PublicKey;
    index: number;
    deliverableHash: Uint8Array;
    uri: string;
  },
) {
  return program.methods
    .submitWork(p.index, Array.from(p.deliverableHash), p.uri)
    .accountsStrict({ worker: p.worker, deal: p.deal })
    .instruction();
}

/** SHA-256 of the deliverable link, as stored on-chain by submit_work. */
export async function hashDeliverable(uri: string): Promise<Uint8Array> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(uri),
  );
  return new Uint8Array(digest);
}

export function approveMilestoneIx(
  program: EscrowProgram,
  p: { client: PublicKey; deal: PublicKey; index: number },
) {
  return program.methods
    .approveMilestone(p.index)
    .accountsStrict({ client: p.client, deal: p.deal })
    .instruction();
}

/** open_dispute; locks the deal's deposit from the client's associated token account. */
export function openDisputeIx(
  program: EscrowProgram,
  p: { deal: DealView; index: number },
) {
  const { deal } = p;
  return program.methods
    .openDispute(p.index)
    .accountsStrict({
      client: deal.client,
      deal: deal.address,
      mint: deal.mint,
      vault: vaultPda(deal.address, program.programId),
      clientToken: ata(deal.mint, deal.client),
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .instruction();
}

export function castVoteIx(
  program: EscrowProgram,
  p: { judge: PublicKey; deal: PublicKey; index: number; side: SideName },
) {
  return program.methods
    .castVote(p.index, enumValue(p.side))
    .accountsStrict({ judge: p.judge, deal: p.deal })
    .instruction();
}

/** set_proof_target; v1 supports only "PR merged". */
export function setProofTargetIx(
  program: EscrowProgram,
  p: { client: PublicKey; deal: PublicKey; index: number; prNumber: number },
) {
  return program.methods
    .setProofTarget(p.index, enumValue("prMerged"), p.prNumber)
    .accountsStrict({ client: p.client, deal: p.deal })
    .instruction();
}

export interface ProofInput {
  context: string;
  identifier: Uint8Array | number[];
  owner: string;
  timestampS: number;
  epoch: number;
  signature: Uint8Array | number[];
}

/** [ComputeBudget 400k, submit_proof]. Permissionless. */
export async function submitProofIxs(
  program: EscrowProgram,
  p: {
    submitter: PublicKey;
    deal: PublicKey;
    index: number;
    proof: ProofInput;
  },
): Promise<TransactionInstruction[]> {
  const ix = await program.methods
    .submitProof(p.index, {
      context: p.proof.context,
      identifier: Array.from(p.proof.identifier),
      owner: p.proof.owner,
      timestampS: p.proof.timestampS,
      epoch: p.proof.epoch,
      signature: Array.from(p.proof.signature),
    })
    .accountsStrict({ submitter: p.submitter, deal: p.deal })
    .instruction();
  return [
    ComputeBudgetProgram.setComputeUnitLimit({
      units: SUBMIT_PROOF_COMPUTE_UNITS,
    }),
    ix,
  ];
}

export function cancelDealIx(
  program: EscrowProgram,
  p: { signer: PublicKey; deal: PublicKey; agree: boolean },
) {
  return program.methods
    .cancelDeal(p.agree)
    .accountsStrict({ signer: p.signer, deal: p.deal })
    .instruction();
}

// ---------------------------------------------------------------- payouts

export interface SettleBuild {
  ix: TransactionInstruction;
  payout: Payout;
  /** Recipient associated token accounts to create idempotently first (tx.ts does it). */
  atas: AtaSpec[];
}

/**
 * settle_milestone. Uses the payout-rule mirror to pass each recipient's associated token
 * account only when that side receives something, else null. `assume` evaluates the rule as
 * if an earlier instruction in the same transaction had already run (approve, vote, cancel).
 * Throws "NothingToSettle" when the mirror says the settle would fail.
 */
export async function settleMilestoneIx(
  program: EscrowProgram,
  p: {
    cranker: PublicKey;
    deal: DealView;
    index: number;
    now: number;
    assume?: Assume;
  },
): Promise<SettleBuild> {
  const { deal } = p;
  const payout = payoutFor(deal, p.index, p.now, p.assume);
  if (!payout) throw new Error("NothingToSettle");
  const workerToken = payout.toWorker > 0n ? ata(deal.mint, deal.worker) : null;
  const clientToken = payout.toClient > 0n ? ata(deal.mint, deal.client) : null;
  const atas: AtaSpec[] = [];
  if (workerToken) atas.push({ owner: deal.worker, mint: deal.mint });
  if (clientToken) atas.push({ owner: deal.client, mint: deal.mint });
  const ix = await program.methods
    .settleMilestone(p.index)
    .accountsStrict({
      cranker: p.cranker,
      deal: deal.address,
      mint: deal.mint,
      vault: vaultPda(deal.address, program.programId),
      workerToken,
      clientToken,
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .instruction();
  return { ix, payout, atas };
}

/**
 * close_deal. `vaultBalance` is the vault's current token amount; the client's associated
 * token account is passed only when there is a remainder to sweep.
 */
export async function closeDealIx(
  program: EscrowProgram,
  p: { cranker: PublicKey; deal: DealView; vaultBalance: bigint },
): Promise<{ ix: TransactionInstruction; atas: AtaSpec[] }> {
  const { deal } = p;
  const sweep = p.vaultBalance > 0n;
  const ix = await program.methods
    .closeDeal()
    .accountsStrict({
      cranker: p.cranker,
      deal: deal.address,
      client: deal.client,
      mint: deal.mint,
      vault: vaultPda(deal.address, program.programId),
      clientToken: sweep ? ata(deal.mint, deal.client) : null,
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .instruction();
  return { ix, atas: sweep ? [{ owner: deal.client, mint: deal.mint }] : [] };
}

// ---------------------------------------------------------------- bundles (PLAN 4.5)

export interface Bundle {
  instructions: TransactionInstruction[];
  atas: AtaSpec[];
}

/** [approve, settle]: the client sees "approve, paid" as one transaction. */
export async function approveAndSettleIxs(
  program: EscrowProgram,
  p: { deal: DealView; index: number; now: number },
): Promise<Bundle> {
  const approve = await approveMilestoneIx(program, {
    client: p.deal.client,
    deal: p.deal.address,
    index: p.index,
  });
  const settle = await settleMilestoneIx(program, {
    cranker: p.deal.client,
    deal: p.deal,
    index: p.index,
    now: p.now,
    assume: { milestone: { status: "approved" } },
  });
  return { instructions: [approve, settle.ix], atas: settle.atas };
}

/** [cast_vote] or, when this vote creates a majority, [cast_vote, settle]. */
export async function voteIxs(
  program: EscrowProgram,
  p: {
    judge: PublicKey;
    deal: DealView;
    index: number;
    side: SideName;
    now: number;
  },
): Promise<Bundle & { decides: boolean }> {
  const m = p.deal.milestones[p.index];
  const slot = p.deal.judges.findIndex((j) => j.equals(p.judge));
  const vote = await castVoteIx(program, {
    judge: p.judge,
    deal: p.deal.address,
    index: p.index,
    side: p.side,
  });
  if (!m || slot < 0 || !voteDecides(m.votes, slot, p.side)) {
    return { instructions: [vote], atas: [], decides: false };
  }
  const settle = await settleMilestoneIx(program, {
    cranker: p.judge,
    deal: p.deal,
    index: p.index,
    now: p.now,
    assume: { milestone: { votes: votesAfter(m.votes, slot, p.side) } },
  });
  return { instructions: [vote, settle.ix], atas: settle.atas, decides: true };
}

/** One settle per index ("Withdraw all"). Indexes the mirror says cannot settle are skipped. */
export async function settleManyIxs(
  program: EscrowProgram,
  p: {
    cranker: PublicKey;
    deal: DealView;
    indexes: number[];
    now: number;
    assume?: Assume;
  },
): Promise<Bundle> {
  const instructions: TransactionInstruction[] = [];
  const atas: AtaSpec[] = [];
  for (const index of p.indexes) {
    if (!payoutFor(p.deal, index, p.now, p.assume)) continue;
    const s = await settleMilestoneIx(program, { ...p, index });
    instructions.push(s.ix);
    atas.push(...s.atas);
  }
  return { instructions, atas };
}

/**
 * Open-deal cancel: [cancel_deal(true), settle x N, close_deal] in one transaction. On an Open
 * deal every milestone refunds to the client, and the vault then holds nothing more to sweep.
 */
export async function cancelOpenDealIxs(
  program: EscrowProgram,
  p: { signer: PublicKey; deal: DealView; now: number },
): Promise<Bundle> {
  const cancel = await cancelDealIx(program, {
    signer: p.signer,
    deal: p.deal.address,
    agree: true,
  });
  const settles = await settleManyIxs(program, {
    cranker: p.signer,
    deal: p.deal,
    indexes: p.deal.milestones.map((m) => m.index),
    now: p.now,
    assume: { dealStatus: "cancelled" },
  });
  const close = await closeDealIx(program, {
    cranker: p.signer,
    deal: p.deal,
    vaultBalance: 0n,
  });
  return {
    instructions: [cancel, ...settles.instructions, close.ix],
    atas: [...settles.atas, ...close.atas],
  };
}
