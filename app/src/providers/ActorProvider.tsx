// The active signer (ADR-10): the connected wallet, or a demo keypair in demo mode.
// Everything that signs goes through `useActor().actor`, so both sources share one code path.
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import type { PublicKey } from "@solana/web3.js";
import {
  DEMO_ACTORS,
  WALLET_BADGE,
  keypairSigner,
  type DemoActor,
  type DemoRoleId,
} from "../lib/actors";
import { DEMO_MODE } from "../lib/env";
import type { TxSigner } from "../lib/tx";

export type ActorId = "wallet" | DemoRoleId;

/** The active signer. Same shape as Anchor's `Wallet`, plus a label and badge colour. */
export interface Actor extends TxSigner {
  id: ActorId;
  label: string;
  /** Tailwind classes for the coloured role badge. */
  badge: string;
  kind: "wallet" | "demo";
}

export interface ActorContextValue {
  /** The active signer, or null when the wallet is selected but not connected. */
  actor: Actor | null;
  /** Convenience: `actor?.publicKey ?? null`. */
  publicKey: PublicKey | null;
  /** Which source is selected (even if the wallet is not connected yet). */
  activeId: ActorId;
  /** Switch between "wallet" and a demo role. No-op for unknown roles. */
  select: (id: ActorId) => void;
  demoMode: boolean;
  /** Demo actors available in this build (empty unless demo mode). */
  demoActors: readonly DemoActor[];
}

const ActorContext = createContext<ActorContextValue | null>(null);
const STORAGE_KEY = "kept.activeActor";

function readStoredId(): ActorId {
  if (!DEMO_MODE) return "wallet";
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && DEMO_ACTORS.some((a) => a.id === stored))
      return stored as ActorId;
  } catch {
    // Storage may be unavailable (private mode); fall back to the wallet.
  }
  return "wallet";
}

export function ActorProvider({ children }: { children: ReactNode }) {
  const wallet = useWallet();
  const [activeId, setActiveId] = useState<ActorId>(readStoredId);

  const select = useCallback((id: ActorId) => {
    if (id !== "wallet" && !DEMO_ACTORS.some((a) => a.id === id)) return;
    setActiveId(id);
    try {
      localStorage.setItem(STORAGE_KEY, id);
    } catch {
      // Not critical.
    }
  }, []);

  const { publicKey: walletKey, signTransaction, signAllTransactions } = wallet;

  const actor = useMemo<Actor | null>(() => {
    if (activeId !== "wallet") {
      const demo = DEMO_ACTORS.find((a) => a.id === activeId);
      if (!demo) return null;
      return {
        ...keypairSigner(demo.keypair),
        id: demo.id,
        label: demo.label,
        badge: demo.badge,
        kind: "demo",
      };
    }
    if (!walletKey || !signTransaction || !signAllTransactions) return null;
    return {
      id: "wallet",
      label: "Your wallet",
      badge: WALLET_BADGE,
      kind: "wallet",
      publicKey: walletKey,
      signTransaction,
      signAllTransactions,
    };
  }, [activeId, walletKey, signTransaction, signAllTransactions]);

  const value = useMemo<ActorContextValue>(
    () => ({
      actor,
      publicKey: actor?.publicKey ?? null,
      activeId,
      select,
      demoMode: DEMO_MODE,
      demoActors: DEMO_ACTORS,
    }),
    [actor, activeId, select],
  );

  return (
    <ActorContext.Provider value={value}>{children}</ActorContext.Provider>
  );
}

export function useActor(): ActorContextValue {
  const ctx = useContext(ActorContext);
  if (!ctx) throw new Error("useActor must be used inside <ActorProvider>");
  return ctx;
}
