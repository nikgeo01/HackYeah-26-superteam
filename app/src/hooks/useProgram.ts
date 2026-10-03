// Typed Anchor program bound to the active actor (ADR-10 wiring). Without an actor it is
// read-only: fetching works, signing throws.
import { useMemo } from "react";
import { AnchorProvider, Program } from "@anchor-lang/core";
import { useConnection } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { useActor } from "../providers/ActorProvider";
import { IDL, type MilestoneEscrow } from "../lib/idl";
import { COPY } from "../lib/errors";

/** The wallet shape AnchorProvider accepts: publicKey + signTransaction + signAllTransactions. */
type AnchorWallet = ConstructorParameters<typeof AnchorProvider>[1];

const READ_ONLY_WALLET: AnchorWallet = {
  publicKey: PublicKey.default,
  signTransaction: () => Promise.reject(new Error(COPY.noWallet)),
  signAllTransactions: () => Promise.reject(new Error(COPY.noWallet)),
};

export function useProgram(): Program<MilestoneEscrow> {
  const { connection } = useConnection();
  const { actor } = useActor();
  return useMemo(() => {
    const wallet: AnchorWallet = actor
      ? {
          publicKey: actor.publicKey,
          signTransaction: actor.signTransaction,
          signAllTransactions: actor.signAllTransactions,
        }
      : READ_ONLY_WALLET;
    const provider = new AnchorProvider(connection, wallet, {
      commitment: "confirmed",
    });
    return new Program<MilestoneEscrow>(IDL, provider);
  }, [connection, actor]);
}
