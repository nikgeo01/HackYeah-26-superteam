// SOL and tUSDC balances of any address (header, /demo, faucet).
import { useQuery } from "@tanstack/react-query";
import { useConnection } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { ata } from "../lib/pdas";
import { TUSDC_MINT } from "../lib/env";

export interface Balances {
  lamports: number;
  /** Raw tUSDC base units; 0n when the token account does not exist. */
  tusdc: bigint;
}

export const balancesQueryKey = (owner: string) => ["balances", owner] as const;

export function useBalances(owner: PublicKey | null | undefined) {
  const { connection } = useConnection();
  const ownerText = owner?.toBase58() ?? "";
  return useQuery<Balances>({
    queryKey: balancesQueryKey(ownerText),
    enabled: !!owner,
    refetchInterval: 15_000,
    queryFn: async () => {
      const lamports = await connection.getBalance(owner!, "confirmed");
      let tusdc = 0n;
      if (TUSDC_MINT) {
        try {
          const res = await connection.getTokenAccountBalance(
            ata(new PublicKey(TUSDC_MINT), owner!),
            "confirmed",
          );
          tusdc = BigInt(res.value.amount);
        } catch {
          // No token account yet.
        }
      }
      return { lamports, tusdc };
    },
  });
}
