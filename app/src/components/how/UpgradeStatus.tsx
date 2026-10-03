// Live upgrade-authority status of the program (PLAN 0 "honest limits", 4.1 /how).
// Reads the program account (BPF upgradeable loader) -> its programdata account -> the
// upgrade authority option. Same information as `solana program show <id>`.
import { useQuery } from "@tanstack/react-query";
import { useConnection } from "@solana/wallet-adapter-react";
import { PublicKey, type Connection } from "@solana/web3.js";
import { PROGRAM_ID } from "../../lib/idl";
import { explorerAddressUrl, shortAddress } from "../../lib/format";
import { Sheet, Stamp } from "../ui";

export const BPF_UPGRADEABLE_LOADER = new PublicKey(
  "BPFLoaderUpgradeab1e11111111111111111111111",
);
/** UpgradeableLoaderState enum tags (u32 LE). */
const TAG_PROGRAM = 2;
const TAG_PROGRAM_DATA = 3;
/** ProgramData layout: tag u32 (0..4), slot u64 (4..12), option u8 (12), authority (13..45). */
const AUTHORITY_OPTION_OFFSET = 12;
const AUTHORITY_OFFSET = 13;

export type UpgradeState =
  | { kind: "missing" }
  | { kind: "otherLoader"; owner: PublicKey }
  | { kind: "upgradeable"; authority: PublicKey; programData: PublicKey }
  | { kind: "immutable"; programData: PublicKey };

function u32le(data: Uint8Array, offset: number): number {
  return new DataView(data.buffer, data.byteOffset, data.byteLength).getUint32(
    offset,
    true,
  );
}

export async function fetchUpgradeState(
  connection: Connection,
  programId: PublicKey,
): Promise<UpgradeState> {
  const program = await connection.getAccountInfo(programId, "confirmed");
  if (!program) return { kind: "missing" };
  if (!program.owner.equals(BPF_UPGRADEABLE_LOADER))
    // Programs owned by the older loaders cannot be upgraded at all.
    return { kind: "otherLoader", owner: program.owner };
  if (program.data.length < 36 || u32le(program.data, 0) !== TAG_PROGRAM)
    throw new Error("Unexpected program account layout");
  const programData = new PublicKey(program.data.subarray(4, 36));
  const pd = await connection.getAccountInfo(programData, {
    commitment: "confirmed",
    dataSlice: { offset: 0, length: AUTHORITY_OFFSET + 32 },
  });
  if (
    !pd ||
    pd.data.length < AUTHORITY_OPTION_OFFSET + 1 ||
    u32le(pd.data, 0) !== TAG_PROGRAM_DATA
  )
    throw new Error("Unexpected program data layout");
  if (pd.data[AUTHORITY_OPTION_OFFSET] === 0)
    return { kind: "immutable", programData };
  return {
    kind: "upgradeable",
    programData,
    authority: new PublicKey(
      pd.data.subarray(AUTHORITY_OFFSET, AUTHORITY_OFFSET + 32),
    ),
  };
}

const linkClass =
  "font-semibold text-ink underline decoration-ink/35 underline-offset-[3px] hover:decoration-stamp";

function Explorer({ address, text }: { address: PublicKey; text?: string }) {
  return (
    <a
      href={explorerAddressUrl(address)}
      target="_blank"
      rel="noreferrer"
      className={`${linkClass} break-all`}
      title={address.toBase58()}
    >
      {text ?? shortAddress(address)}
    </a>
  );
}

export function UpgradeStatus() {
  const { connection } = useConnection();
  const { data, error, isLoading } = useQuery({
    queryKey: ["upgradeAuthority", PROGRAM_ID.toBase58()],
    queryFn: () => fetchUpgradeState(connection, PROGRAM_ID),
    refetchInterval: 60_000,
  });

  let headline: React.ReactNode;
  let detail: React.ReactNode = null;
  let stamp = false;
  if (isLoading) headline = <span className="text-ink-soft">Checking the program on Solana</span>;
  else if (error || !data)
    headline = <span className="text-ink-soft">The program account could not be read just now. Reload the page to try again.</span>;
  else if (data.kind === "missing") headline = "The program is not deployed on this network.";
  else if (data.kind === "upgradeable") {
    headline = (
      <>
        Upgradeable by <Explorer address={data.authority} /> until finalized
      </>
    );
    detail =
      "Until then, whoever holds that key could replace the rules. This is the main trust assumption today. Finalizing removes the key for good.";
  } else {
    stamp = true;
    headline = "Immutable: nobody can change the rules";
  }

  return (
    <Sheet className="flex flex-wrap items-start justify-between gap-x-6 gap-y-4 px-5 py-4">
      <div className="min-w-0 max-w-[56ch] space-y-1.5">
        <p className="text-body font-semibold" aria-live="polite">
          {headline}
        </p>
        {detail && <p className="text-sm text-ink-soft">{detail}</p>}
        <p className="text-sm text-ink-soft">
          Program <Explorer address={PROGRAM_ID} />, on the public explorer
        </p>
      </div>
      {stamp && <Stamp tone="stamp" tilt={-4}>Immutable</Stamp>}
    </Sheet>
  );
}
