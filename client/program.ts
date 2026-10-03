// Typed Anchor client for the escrow program, built from the committed IDL.
import { AnchorProvider, Program } from "@anchor-lang/core";
import type { Wallet } from "@anchor-lang/core";
import { Connection } from "@solana/web3.js";
import idl from "../idl/milestone_escrow.json" with { type: "json" };
import type { MilestoneEscrow } from "../idl/milestone_escrow.ts";

export type { MilestoneEscrow };

/// `wallet` is anything with `publicKey`, `signTransaction` and
/// `signAllTransactions`: a wallet-adapter wallet or a keypair wrapper.
export function escrowProgram(
  connection: Connection,
  wallet: Wallet,
): Program<MilestoneEscrow> {
  const provider = new AnchorProvider(connection, wallet, {
    commitment: "confirmed",
  });
  return new Program(idl as MilestoneEscrow, provider);
}
