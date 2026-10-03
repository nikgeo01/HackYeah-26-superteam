// Deal queries (PLAN 4.5): one deal live (account subscription + 5 s poll), all my deals every 15 s.
import { useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { PublicKey } from "@solana/web3.js";
import { useProgram } from "./useProgram";
import { useActor } from "../providers/ActorProvider";
import {
  fetchAllDeals,
  fetchDeal,
  splitByRole,
  type DealView,
  type DealsByRole,
} from "../lib/deals";
import { toPublicKey } from "../lib/pdas";

export const dealQueryKey = (address: string) => ["deal", address] as const;
export const DEALS_QUERY_KEY = ["deals"] as const;

/**
 * One deal by address (base58 string or PublicKey). `data` is null when the account does not
 * exist (for example after close_deal) and undefined while loading.
 */
export function useDeal(address: string | PublicKey | null | undefined) {
  const program = useProgram();
  const queryClient = useQueryClient();
  const key = useMemo(() => toPublicKey(address ?? null), [address]);
  const keyText = key?.toBase58() ?? "";

  const query = useQuery<DealView | null>({
    queryKey: dealQueryKey(keyText),
    queryFn: () => fetchDeal(program, key!),
    enabled: key !== null,
    refetchInterval: 5000,
  });

  useEffect(() => {
    if (!key) return;
    const connection = program.provider.connection;
    const id = connection.onAccountChange(
      key,
      () =>
        void queryClient.invalidateQueries({ queryKey: dealQueryKey(keyText) }),
      { commitment: "confirmed" },
    );
    return () => {
      void connection.removeAccountChangeListener(id);
    };
  }, [key, keyText, program, queryClient]);

  return {
    ...query,
    invalidAddress: address != null && address !== "" && key === null,
  };
}

/** Every deal of the program (dataSize filter), refreshed every 15 s. */
export function useAllDeals() {
  const program = useProgram();
  return useQuery<DealView[]>({
    queryKey: DEALS_QUERY_KEY,
    queryFn: () => fetchAllDeals(program),
    refetchInterval: 15_000,
  });
}

/** The active actor's deals, split into the three tabs of /deals. */
export function useMyDeals(): ReturnType<typeof useAllDeals> & DealsByRole {
  const { publicKey } = useActor();
  const all = useAllDeals();
  const split = useMemo(
    () => splitByRole(all.data ?? [], publicKey),
    [all.data, publicKey],
  );
  return { ...all, ...split };
}
