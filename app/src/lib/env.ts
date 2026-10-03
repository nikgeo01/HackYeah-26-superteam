// The single place the app reads its build-time configuration (PLAN 4.7).
// Never put secrets here; values come from app/.env.local or the hosting provider.

const env = import.meta.env;

function str(value: string | undefined): string {
  return (value ?? "").trim();
}

export const RPC_URL = str(env.VITE_RPC_URL) || "https://api.devnet.solana.com";
export const CLUSTER = str(env.VITE_CLUSTER) || "devnet";
/** Empty when unset; `lib/idl.ts` then uses the address from the IDL. */
export const PROGRAM_ID_OVERRIDE = str(env.VITE_PROGRAM_ID);
/** Empty when unset; the faucet is then disabled. */
export const TUSDC_MINT = str(env.VITE_TUSDC_MINT);
export const FAUCET_SECRET = str(env.VITE_FAUCET_SECRET);
export const PROVER_URL = str(env.VITE_PROVER_URL) || "http://localhost:8787";
export const DEFAULT_ATTESTOR =
  str(env.VITE_DEFAULT_ATTESTOR) ||
  "0x244897572368eadf65bfbc5aec98d8e5443a9072";
export const DEMO_MODE = str(env.VITE_DEMO_MODE).toLowerCase() === "true";
export const DEMO_ACTORS_RAW = DEMO_MODE ? str(env.VITE_DEMO_ACTORS) : "";
