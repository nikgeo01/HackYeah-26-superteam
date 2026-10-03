// Chain time (PLAN 4.5): the Clock sysvar's unix_timestamp, read every 10 s, kept as an
// offset against the local clock. This is exactly the `now` the program sees.
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useConnection } from "@solana/wallet-adapter-react";
import { SYSVAR_CLOCK_PUBKEY, type Connection } from "@solana/web3.js";

export const CHAIN_TIME_REFRESH_MS = 10_000;
/** Byte offset of `unix_timestamp` (i64 LE) in the Clock sysvar. */
const CLOCK_UNIX_TIMESTAMP_OFFSET = 32;

/** Reads the cluster's unix time (seconds) from the Clock sysvar. */
export async function fetchChainTime(connection: Connection): Promise<number> {
  const info = await connection.getAccountInfo(
    SYSVAR_CLOCK_PUBKEY,
    "confirmed",
  );
  if (!info) throw new Error("Clock sysvar not found");
  const data = info.data;
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  return Number(view.getBigInt64(CLOCK_UNIX_TIMESTAMP_OFFSET, true));
}

export interface ChainTime {
  /** Current chain time in unix seconds (fractional), estimated from the last sample. */
  now: () => number;
  /** chainTime - Date.now()/1000 from the last sample (0 before the first). */
  offset: number;
  /** True once at least one sample was read. */
  ready: boolean;
}

const ChainTimeContext = createContext<ChainTime | null>(null);

export function ChainTimeProvider({ children }: { children: ReactNode }) {
  const { connection } = useConnection();
  const [offset, setOffset] = useState(0);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const sample = async () => {
      try {
        const before = Date.now();
        const chain = await fetchChainTime(connection);
        const local = (before + Date.now()) / 2 / 1000;
        if (cancelled) return;
        setOffset(chain - local);
        setReady(true);
      } catch (err) {
        console.warn("Could not read chain time", err);
      }
    };
    void sample();
    const timer = setInterval(sample, CHAIN_TIME_REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [connection]);

  const now = useCallback(() => Date.now() / 1000 + offset, [offset]);
  const value = useMemo(() => ({ now, offset, ready }), [now, offset, ready]);
  return (
    <ChainTimeContext.Provider value={value}>
      {children}
    </ChainTimeContext.Provider>
  );
}

export function useChainTime(): ChainTime {
  const ctx = useContext(ChainTimeContext);
  if (!ctx)
    throw new Error("useChainTime must be used inside <ChainTimeProvider>");
  return ctx;
}

/** Re-renders every `intervalMs` and returns the current chain time (whole seconds). For countdowns. */
export function useChainNow(intervalMs = 1000): number {
  const { now } = useChainTime();
  const [value, setValue] = useState(() => Math.floor(now()));
  useEffect(() => {
    setValue(Math.floor(now()));
    const timer = setInterval(() => setValue(Math.floor(now())), intervalMs);
    return () => clearInterval(timer);
  }, [now, intervalMs]);
  return value;
}
