// Instruction builders for the scripts. They build; they never send.
import BN from "bn.js";
import {
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountIdempotentInstruction,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import { PublicKey, type TransactionInstruction } from "@solana/web3.js";
import { dealAddress, vaultAddress } from "../../client/pdas.ts";
import type { Payout } from "../../client/rules.ts";
import type { ProofArgs } from "../../client/proof.ts";
import type { DealInfo } from "./deal.ts";
import type { EscrowProgram } from "./program.ts";

export const ata = (mint: PublicKey, owner: PublicKey): PublicKey =>
  getAssociatedTokenAddressSync(mint, owner);

export const ensureAtaIx = (
  payer: PublicKey,
  mint: PublicKey,
  owner: PublicKey,
): TransactionInstruction =>
  createAssociatedTokenAccountIdempotentInstruction(
    payer,
    ata(mint, owner),
    owner,
    mint,
  );

export interface MilestoneSpec {
  amount: bigint;
  dueSecs: number;
  /** PR number bound at creation (0 = no proof). */
  proofRef?: number;
}

export interface DealSpec {
  dealId: bigint;
  worker: PublicKey;
  judges: [PublicKey, PublicKey, PublicKey];
  acceptWindowSecs: number;
  reviewWindowSecs: number;
  voteWindowSecs: number;
  disputeDeposit: bigint;
  /** 20 bytes; zeros disable proofs. */
  proofAttestor: number[];
  proofRepo: string;
  milestones: MilestoneSpec[];
}

export async function createDealIx(
  program: EscrowProgram,
  client: PublicKey,
  mint: PublicKey,
  spec: DealSpec,
): Promise<{ deal: PublicKey; ix: TransactionInstruction }> {
  const deal = dealAddress(program.programId, client, spec.dealId);
  const ix = await program.methods
    .createDeal({
      dealId: new BN(spec.dealId.toString()),
      worker: spec.worker,
      judges: spec.judges,
      acceptWindowSecs: spec.acceptWindowSecs,
      reviewWindowSecs: spec.reviewWindowSecs,
      voteWindowSecs: spec.voteWindowSecs,
      disputeDeposit: new BN(spec.disputeDeposit.toString()),
      proofAttestor: spec.proofAttestor,
      proofRepo: spec.proofRepo,
      milestones: spec.milestones.map((m) => ({
        amount: new BN(m.amount.toString()),
        dueSecs: m.dueSecs,
        proofKind: m.proofRef ? { prMerged: {} } : { off: {} },
        proofRef: m.proofRef ?? 0,
      })),
    })
    .accountsPartial({
      client,
      deal,
      mint,
      vault: vaultAddress(program.programId, deal),
      clientToken: ata(mint, client),
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .instruction();
  return { deal, ix };
}

export const acceptIx = (
  program: EscrowProgram,
  worker: PublicKey,
  deal: PublicKey,
) =>
  program.methods.acceptDeal().accountsPartial({ worker, deal }).instruction();

export const submitWorkIx = (
  program: EscrowProgram,
  worker: PublicKey,
  deal: PublicKey,
  index: number,
  deliverableHash: number[],
  uri: string,
) =>
  program.methods
    .submitWork(index, deliverableHash, uri)
    .accountsPartial({ worker, deal })
    .instruction();

export const approveIx = (
  program: EscrowProgram,
  client: PublicKey,
  deal: PublicKey,
  index: number,
) =>
  program.methods
    .approveMilestone(index)
    .accountsPartial({ client, deal })
    .instruction();

export const openDisputeIx = (
  program: EscrowProgram,
  client: PublicKey,
  deal: PublicKey,
  mint: PublicKey,
  index: number,
) =>
  program.methods
    .openDispute(index)
    .accountsPartial({
      client,
      deal,
      mint,
      vault: vaultAddress(program.programId, deal),
      clientToken: ata(mint, client),
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .instruction();

export const voteIx = (
  program: EscrowProgram,
  judge: PublicKey,
  deal: PublicKey,
  index: number,
  side: "worker" | "client",
) =>
  program.methods
    .castVote(index, side === "worker" ? { worker: {} } : { client: {} })
    .accountsPartial({ judge, deal })
    .instruction();

export const submitProofIx = (
  program: EscrowProgram,
  submitter: PublicKey,
  deal: PublicKey,
  index: number,
  proof: ProofArgs,
) =>
  program.methods
    .submitProof(index, proof)
    .accountsPartial({ submitter, deal })
    .instruction();

/**
 * `settle_milestone` for `payout` (from `decideOutcome`), preceded by idempotent
 * ATA creation for each side that receives something. A side that receives
 * nothing gets `null`, so a missing account on that side can never block it.
 */
export async function settleIxs(
  program: EscrowProgram,
  cranker: PublicKey,
  deal: Pick<DealInfo, "address" | "mint" | "worker" | "client">,
  index: number,
  payout: Pick<Payout, "toWorker" | "toClient">,
): Promise<TransactionInstruction[]> {
  const ixs: TransactionInstruction[] = [];
  const workerToken = payout.toWorker > 0n ? ata(deal.mint, deal.worker) : null;
  const clientToken = payout.toClient > 0n ? ata(deal.mint, deal.client) : null;
  if (workerToken) ixs.push(ensureAtaIx(cranker, deal.mint, deal.worker));
  if (clientToken) ixs.push(ensureAtaIx(cranker, deal.mint, deal.client));
  ixs.push(
    await program.methods
      .settleMilestone(index)
      .accountsPartial({
        cranker,
        deal: deal.address,
        mint: deal.mint,
        vault: vaultAddress(program.programId, deal.address),
        workerToken,
        clientToken,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .instruction(),
  );
  return ixs;
}

/** `close_deal`; the client's ATA is passed (and created) only when the vault still holds tokens. */
export async function closeIxs(
  program: EscrowProgram,
  cranker: PublicKey,
  deal: Pick<DealInfo, "address" | "mint" | "client">,
  vaultBalance: bigint,
): Promise<TransactionInstruction[]> {
  const ixs: TransactionInstruction[] = [];
  const clientToken = vaultBalance > 0n ? ata(deal.mint, deal.client) : null;
  if (clientToken) ixs.push(ensureAtaIx(cranker, deal.mint, deal.client));
  ixs.push(
    await program.methods
      .closeDeal()
      .accountsPartial({
        cranker,
        deal: deal.address,
        client: deal.client,
        mint: deal.mint,
        vault: vaultAddress(program.programId, deal.address),
        clientToken,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .instruction(),
  );
  return ixs;
}
