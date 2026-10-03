// The typed Anchor client for scripts: Dev A's `client/program.ts`, except that
// `PROGRAM_ID` from the environment may point it at another deployment.
import { AnchorProvider, Program } from "@anchor-lang/core";
import { Connection, Keypair } from "@solana/web3.js";
import idl from "../../idl/milestone_escrow.json" with { type: "json" };
import { escrowProgram, type MilestoneEscrow } from "../../client/program.ts";
import { env } from "./env.ts";
import { keypairWallet } from "./keys.ts";

export type EscrowProgram = Program<MilestoneEscrow>;

export function connect(): Connection {
  return new Connection(env.rpcUrl(), "confirmed");
}

/**
 * `signer` only matters for `.rpc()`, which the scripts do not use: they build
 * instructions and send them through `lib/tx.ts`. Pass nothing for read-only use.
 */
export function loadProgram(
  connection: Connection,
  signer: Keypair = Keypair.generate(),
): EscrowProgram {
  const wallet = keypairWallet(signer);
  const programId = env.programId();
  if (programId.toBase58() === idl.address)
    return escrowProgram(connection, wallet);
  const provider = new AnchorProvider(connection, wallet, {
    commitment: "confirmed",
  });
  return new Program(
    { ...idl, address: programId.toBase58() } as MilestoneEscrow,
    provider,
  );
}
