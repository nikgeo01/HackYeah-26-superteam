// Proof helpers (PLAN / INTERFACE 3.9): build the request the attestor witnesses,
// turn its signed claim into `ProofArgs` for `submit_proof`, and the pure claim
// functions the program re-checks on-chain.
//
// Nothing here is trusted by the program: it rebuilds the parameters from the
// Deal, checks the context, recomputes the identifier and recovers the signer.
// The pure helpers use only TextEncoder and @noble, so they also run in a browser;
// zkFetch is loaded lazily and only by `zkFetchClaim` / `proveMilestone` (Node).
import { secp256k1 } from "@noble/curves/secp256k1.js";
import { keccak_256 } from "@noble/hashes/sha3.js";
import type { PublicKey } from "@solana/web3.js";
import idl from "../idl/milestone_escrow.json" with { type: "json" };
import type { MilestoneEscrow } from "../idl/milestone_escrow.ts";
import type { Program } from "@anchor-lang/core";

/** Mirrors the program's `ProofArgs` (camelCase, as the Anchor TS client expects). */
export interface ProofArgs {
  /** Exactly as signed (canonical JSON), at most 512 bytes. */
  context: string;
  /** 32 bytes. */
  identifier: number[];
  /** "0x" + 40 lowercase hex, exactly as signed. */
  owner: string;
  timestampS: number;
  epoch: number;
  /** 65 bytes: r || s || v, with v = 27 or 28. */
  signature: number[];
}

/** The parts of a Reclaim / zkFetch proof that are used (the SDK's `Proof` type). */
export interface ReclaimProofLike {
  claimData: {
    provider: string;
    parameters: string;
    owner: string;
    timestampS: number;
    context: string;
    identifier: string;
    epoch: number;
  };
  signatures: string[];
  witnesses?: { id: string; url: string }[];
}

export const RECLAIM_ATTESTOR = "0x244897572368eadf65bfbc5aec98d8e5443a9072";
export const PROOF_CONTEXT_PREFIX = "kept:v1:";
export const MAX_CONTEXT_LEN = 512;
/** Address placed in `contextAddress`; informational only (the program ignores it). */
export const DEFAULT_CONTEXT_ADDRESS = "0x0";

const enc = new TextEncoder();

// ---------------------------------------------------------------------------
// Constants come from the IDL, so they always match the deployed program.

function idlString(name: string): string {
  const constant = idl.constants.find((c) => c.name === name);
  if (!constant)
    throw new Error(`IDL constant ${name} is missing; re-sync the IDL`);
  return JSON.parse(constant.value) as string;
}

export const proofConstants = () => ({
  provider: idlString("PROOF_PROVIDER"),
  paramsBeforeUrl: idlString("PROOF_PARAMS_BEFORE_URL"),
  paramsAfterUrl: idlString("PROOF_PARAMS_AFTER_URL"),
});

// ---------------------------------------------------------------------------
// Byte helpers (no Buffer, so this file also works in the browser).

export function toHex(bytes: Uint8Array | number[]): string {
  let out = "";
  for (const b of bytes) out += b.toString(16).padStart(2, "0");
  return out;
}

export function fromHex(hex: string): Uint8Array {
  const clean =
    hex.startsWith("0x") || hex.startsWith("0X") ? hex.slice(2) : hex;
  if (clean.length % 2 !== 0 || /[^0-9a-fA-F]/.test(clean))
    throw new Error(`not hex: ${hex}`);
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++)
    out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  return out;
}

const keccak = (text: string): Uint8Array => keccak_256(enc.encode(text));

// ---------------------------------------------------------------------------
// What the attestor is asked to witness.

/** `https://api.github.com/repos/{repo}/issues/{pr}` (the Issues endpoint, never /pulls). */
export function expectedUrl(repo: string, pr: number): string {
  return `https://api.github.com/repos/${repo}/issues/${pr}`;
}

/** The parameters string the program rebuilds: BEFORE_URL + url + AFTER_URL. */
export function expectedParameters(repo: string, pr: number): string {
  const c = proofConstants();
  return `${c.paramsBeforeUrl}${expectedUrl(repo, pr)}${c.paramsAfterUrl}`;
}

/** The response match list, taken from the pinned parameters so it cannot drift. */
export function expectedResponseMatches(): {
  type: "contains" | "regex";
  value: string;
}[] {
  const parsed = JSON.parse(expectedParameters("o/r", 1)) as {
    responseMatches?: { type: "contains" | "regex"; value: string }[];
  };
  if (!parsed.responseMatches?.length)
    throw new Error("IDL proof parameters carry no responseMatches");
  return parsed.responseMatches.map((m) => ({ type: m.type, value: m.value }));
}

/** `kept:v1:<64 lowercase hex of the Deal PDA>:<index>`. */
export function bindingMessage(
  deal: PublicKey | Uint8Array,
  index: number,
): string {
  const bytes = deal instanceof Uint8Array ? deal : deal.toBytes();
  if (bytes.length !== 32) throw new Error("a deal address is 32 bytes");
  return `${PROOF_CONTEXT_PREFIX}${toHex(bytes)}:${index}`;
}

/** The exact substring the program looks for in the signed context. */
export function bindingNeedle(
  deal: PublicKey | Uint8Array,
  index: number,
): string {
  return `"contextMessage":"${bindingMessage(deal, index)}"`;
}

/** Canonical context JSON (sorted keys, no spaces), as the attestor signs it. */
export function contextJson(
  contextAddress: string,
  contextMessage: string,
): string {
  return JSON.stringify({ contextAddress, contextMessage });
}

// ---------------------------------------------------------------------------
// The claim format.

/** keccak256(provider + "\n" + parameters + "\n" + context). */
export function claimIdentifier(
  provider: string,
  parameters: string,
  context: string,
): Uint8Array {
  return keccak(`${provider}\n${parameters}\n${context}`);
}

/** "0x<identifier hex>\n<owner>\n<timestamp>\n<epoch>" (what the attestor signs). */
export function signedMessage(
  identifier: Uint8Array | number[],
  owner: string,
  timestampS: number,
  epoch: number,
): string {
  return `0x${toHex(identifier)}\n${owner}\n${timestampS}\n${epoch}`;
}

/** EIP-191 personal-message digest of `message`. */
export function ethMessageDigest(message: string): Uint8Array {
  const body = enc.encode(message);
  return keccak_256(
    new Uint8Array([
      ...enc.encode(`\x19Ethereum Signed Message:\n${body.length}`),
      ...body,
    ]),
  );
}

/** Ethereum-style address ("0x" + 40 lowercase hex) of an uncompressed secp256k1 public key. */
export function addressOfPublicKey(uncompressed: Uint8Array): string {
  const raw = uncompressed.length === 65 ? uncompressed.slice(1) : uncompressed;
  return `0x${toHex(keccak_256(raw).slice(12))}`;
}

export function addressOfSecretKey(secretKey: Uint8Array): string {
  return addressOfPublicKey(secp256k1.getPublicKey(secretKey, false));
}

/** 20-byte form of an address, for `CreateDealArgs.proof_attestor`. */
export function attestorBytes(address: string): number[] {
  const bytes = fromHex(address);
  if (bytes.length !== 20) throw new Error(`not a 20-byte address: ${address}`);
  return Array.from(bytes);
}

/** Recovers the signer's address from `ProofArgs` the way the program does (v - 27). */
export function recoverSigner(proof: ProofArgs): string {
  if (proof.signature.length !== 65)
    throw new Error("signature must be 65 bytes");
  const recovery = proof.signature[64] - 27;
  if (recovery !== 0 && recovery !== 1)
    throw new Error(`unexpected signature v ${proof.signature[64]}`);
  const digest = ethMessageDigest(
    signedMessage(proof.identifier, proof.owner, proof.timestampS, proof.epoch),
  );
  const sig = secp256k1.Signature.fromCompact(
    Uint8Array.from(proof.signature.slice(0, 64)),
  ).addRecoveryBit(recovery);
  return addressOfPublicKey(sig.recoverPublicKey(digest).toRawBytes(false));
}

/**
 * Signs a claim in exactly the attestor's format with a secp256k1 key we hold.
 * Used by the trusted checker (the no-go path) and for local testing. A deal
 * accepts these only if its `proof_attestor` is this key's address.
 */
export function signClaimWithKey(input: {
  secretKey: Uint8Array;
  parameters: string;
  context: string;
  provider?: string;
  owner?: string;
  timestampS?: number;
  epoch?: number;
}): ProofArgs {
  const provider = input.provider ?? proofConstants().provider;
  const owner = (
    input.owner ?? addressOfSecretKey(input.secretKey)
  ).toLowerCase();
  const timestampS = input.timestampS ?? Math.floor(Date.now() / 1000);
  const epoch = input.epoch ?? 1;
  const identifier = claimIdentifier(provider, input.parameters, input.context);
  const digest = ethMessageDigest(
    signedMessage(identifier, owner, timestampS, epoch),
  );
  const sig = secp256k1.sign(digest, input.secretKey, { lowS: true });
  return {
    context: input.context,
    identifier: Array.from(identifier),
    owner,
    timestampS,
    epoch,
    signature: [...sig.toCompactRawBytes(), 27 + sig.recovery],
  };
}

/** Maps a zkFetch / Reclaim proof to `ProofArgs` (owner lowercased, v normalised to 27/28). */
export function proofArgsFromReclaim(proof: ReclaimProofLike): ProofArgs {
  const c = proof.claimData;
  const sigHex = proof.signatures[0];
  if (!sigHex) throw new Error("the proof carries no signature");
  const signature = Array.from(fromHex(sigHex));
  if (signature.length !== 65)
    throw new Error(`expected a 65-byte signature, got ${signature.length}`);
  if (signature[64] === 0 || signature[64] === 1) signature[64] += 27;
  const identifier = Array.from(fromHex(c.identifier));
  if (identifier.length !== 32)
    throw new Error("expected a 32-byte identifier");
  const args: ProofArgs = {
    context: c.context,
    identifier,
    owner: c.owner.toLowerCase(),
    timestampS: c.timestampS,
    epoch: c.epoch,
    signature,
  };
  const problems = shapeProblems(args);
  if (problems.length)
    throw new Error(`proof is malformed: ${problems.join("; ")}`);
  return args;
}

function shapeProblems(p: ProofArgs): string[] {
  const problems: string[] = [];
  if (enc.encode(p.context).length > MAX_CONTEXT_LEN)
    problems.push(`context is longer than ${MAX_CONTEXT_LEN} bytes`);
  if (!/^0x[0-9a-f]{40}$/.test(p.owner))
    problems.push("owner is not 0x + 40 lowercase hex");
  if (p.identifier.length !== 32) problems.push("identifier is not 32 bytes");
  if (p.signature.length !== 65) problems.push("signature is not 65 bytes");
  return problems;
}

/**
 * The program's checks (3.9 steps 2 to 6), run locally so a bad proof is caught
 * before paying a fee. Returns the problems found; empty means it should verify.
 */
export function checkProofArgs(
  proof: ProofArgs,
  target: {
    repo: string;
    pr: number;
    deal: PublicKey | Uint8Array;
    index: number;
    attestor: string;
  },
): string[] {
  const problems = shapeProblems(proof);
  const c = proofConstants();
  const identifier = claimIdentifier(
    c.provider,
    expectedParameters(target.repo, target.pr),
    proof.context,
  );
  if (toHex(identifier) !== toHex(proof.identifier)) {
    problems.push(
      "identifier does not match this deal's repository / pull request",
    );
  }
  if (!proof.context.includes(bindingNeedle(target.deal, target.index))) {
    problems.push("context is not bound to this deal and milestone");
  }
  try {
    const signer = recoverSigner(proof);
    if (signer !== target.attestor.toLowerCase()) {
      problems.push(
        `signed by ${signer}, but the deal's attestor is ${target.attestor.toLowerCase()}`,
      );
    }
  } catch (error) {
    problems.push(
      `signature: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  return problems;
}

/** Validates an untrusted JSON value (a saved proof file, a prover response) as `ProofArgs`. */
export function parseProofArgs(value: unknown): ProofArgs {
  const v = value as Partial<Record<keyof ProofArgs, unknown>>;
  const bytes = (x: unknown, n: number, name: string): number[] => {
    if (
      !Array.isArray(x) ||
      x.length !== n ||
      !x.every((b) => Number.isInteger(b) && b >= 0 && b <= 255)
    ) {
      throw new Error(`${name} must be an array of ${n} bytes`);
    }
    return x as number[];
  };
  const u32 = (x: unknown, name: string): number => {
    if (
      typeof x !== "number" ||
      !Number.isInteger(x) ||
      x < 0 ||
      x > 0xffffffff
    )
      throw new Error(`${name} must be a u32`);
    return x;
  };
  if (typeof v?.context !== "string")
    throw new Error("context must be a string");
  if (typeof v.owner !== "string") throw new Error("owner must be a string");
  return {
    context: v.context,
    identifier: bytes(v.identifier, 32, "identifier"),
    owner: v.owner,
    timestampS: u32(v.timestampS, "timestampS"),
    epoch: u32(v.epoch, "epoch"),
    signature: bytes(v.signature, 65, "signature"),
  };
}

// ---------------------------------------------------------------------------
// Producing a real proof (Node only).

export interface ZkFetchCredentials {
  appId: string;
  appSecret: string;
  /** Read-only GitHub token; sent only as a private header, never signed or returned. */
  githubToken?: string;
}

/** One zkFetch call for `url`, bound to `contextMessage`. Returns the raw Reclaim proof. */
export async function zkFetchClaim(
  creds: ZkFetchCredentials,
  url: string,
  contextMessage: string,
  opts: {
    contextAddress?: string;
    responseMatches?: { type: "contains" | "regex"; value: string }[];
    /** Extra private headers (the spike's attack tests use this). */
    privateHeaders?: Record<string, string>;
    logs?: boolean;
  } = {},
): Promise<ReclaimProofLike> {
  const { ReclaimClient } = await import("@reclaimprotocol/zk-fetch");
  const client = new ReclaimClient(
    creds.appId,
    creds.appSecret,
    opts.logs ?? false,
  );
  const headers: Record<string, string> = {
    "User-Agent": "kept-prover",
    ...(opts.privateHeaders ?? {}),
  };
  if (creds.githubToken) headers.Authorization = `Bearer ${creds.githubToken}`;
  const proof = await client.zkFetch(
    url,
    {
      method: "GET",
      context: {
        contextAddress: opts.contextAddress ?? DEFAULT_CONTEXT_ADDRESS,
        contextMessage,
      },
    },
    {
      headers,
      responseMatches: opts.responseMatches ?? expectedResponseMatches(),
    },
  );
  if (!proof) throw new Error("the attestor returned no proof");
  return proof;
}

/** What a milestone's proof must be about, read from its Deal. */
export interface ProofTarget {
  repo: string;
  pr: number;
  url: string;
  contextMessage: string;
}

export function proofTarget(
  deal: PublicKey,
  account: {
    proofRepo: string;
    milestones: { proofKind: object; proofRef: number }[];
  },
  index: number,
): ProofTarget {
  const m = account.milestones[index];
  if (!m) throw new Error(`deal has no milestone ${index}`);
  if (
    !("prMerged" in m.proofKind) ||
    m.proofRef === 0 ||
    account.proofRepo === ""
  ) {
    throw new Error(`milestone ${index} has no pull request bound to it`);
  }
  return {
    repo: account.proofRepo,
    pr: m.proofRef,
    url: expectedUrl(account.proofRepo, m.proofRef),
    contextMessage: bindingMessage(deal, index),
  };
}

/** Reads the Deal, asks the attestor to witness its PR, and returns `ProofArgs`. */
export async function proveMilestone(
  program: Program<MilestoneEscrow>,
  deal: PublicKey,
  index: number,
  creds: ZkFetchCredentials,
  opts: { contextAddress?: string; logs?: boolean } = {},
): Promise<{ proof: ProofArgs; target: ProofTarget; raw: ReclaimProofLike }> {
  const account = await program.account.deal.fetch(deal);
  const target = proofTarget(deal, account, index);
  const raw = await zkFetchClaim(
    creds,
    target.url,
    target.contextMessage,
    opts,
  );
  return { proof: proofArgsFromReclaim(raw), target, raw };
}
