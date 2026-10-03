/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_RPC_URL?: string;
  readonly VITE_CLUSTER?: string;
  readonly VITE_PROGRAM_ID?: string;
  readonly VITE_TUSDC_MINT?: string;
  readonly VITE_FAUCET_SECRET?: string;
  readonly VITE_PROVER_URL?: string;
  readonly VITE_DEFAULT_ATTESTOR?: string;
  readonly VITE_DEMO_MODE?: string;
  readonly VITE_DEMO_ACTORS?: string;
  readonly VITE_DEMO_DEALS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
