// Live upgrade-authority status of the program (PLAN 0 "honest limits", 4.1 /how).
// Reads the program account (BPF upgradeable loader) -> its programdata account -> the
// upgrade authority option. Same information as `solana program show <id>`.
import { useQuery } from "@tanstack/react-query";
import { useConnection } from "@solana/wallet-adapter-react";
import { PublicKey, type Connection } from "@solana/web3.js";
import { PROGRAM_ID } from "../../lib/idl";
import { explorerAddressUrl, shortAddress } from "../../lib/format";

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

export function UpgradeStatus() {
  const { connection } = useConnection();
  const { data, error, isLoading } = useQuery({
    queryKey: ["upgradeAuthority", PROGRAM_ID.toBase58()],
    queryFn: () => fetchUpgradeState(connection, PROGRAM_ID),
    refetchInterval: 60_000,
  });

  const link = (address: PublicKey, text?: string) => (
    <a
      href={explorerAddressUrl(address)}
      target="_blank"
      rel="noreferrer"
      className="font-mono text-indigo-700 underline underline-offset-2"
      title={address.toBase58()}
    >
      {text ?? shortAddress(address)}
    </a>
  );

  let status: React.ReactNode;
  let tone = "border-slate-200 bg-slate-50 text-slate-800";
  if (isLoading) status = "Checking the program on Solana…";
  else if (error || !data)
    status = "Could not read the program account right now. Try again later.";
  else if (data.kind === "missing")
    status = "The program is not deployed on this network.";
  else if (data.kind === "upgradeable") {
    tone = "border-amber-300 bg-amber-50 text-amber-900";
    status = (
      <>
        <strong>Upgradeable by {link(data.authority)} (until finalized).</strong>{" "}
        Until then, whoever holds that key could replace the rules. This is
        the main trust assumption today. Once finalized, the key is removed
        for good.
      </>
    );
  } else {
    tone = "border-emerald-300 bg-emerald-50 text-emerald-900";
    status = (
      <strong>Immutable: no one can change the rules.</strong>
    );
  }

  return (
    <div className={`space-y-2 rounded-lg border px-4 py-3 text-sm ${tone}`}>
      <p>
        Program address: {link(PROGRAM_ID, PROGRAM_ID.toBase58())}
      </p>
      <p>{status}</p>
    </div>
  );
}
