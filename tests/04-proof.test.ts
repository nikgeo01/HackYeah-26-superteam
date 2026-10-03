// Proof-based release, tested end to end on localnet: claims are signed with a
// throwaway secp256k1 key that the deal names as its attestor, in exactly the
// format the real attestor uses.
import { expect } from "chai";
import { secp256k1 } from "@noble/curves/secp256k1.js";
import { keccak_256 } from "@noble/hashes/sha3.js";
import * as anchor from "@anchor-lang/core";
import {
  UNIT,
  activeDeal,
  balance,
  expectError,
  fetchDeal,
  openDispute,
  program,
  settle,
  setupEnv,
  statusOf,
  submit,
  vote,
  type Env,
} from "./helpers.ts";

type PublicKey = anchor.web3.PublicKey;

const REPO = "nikgeo01/kept-demo";
const enc = new TextEncoder();

/// Constants are read from the IDL, so the test always matches the program.
function idlString(name: string): string {
  // The TS client camel-cases IDL names, so compare without case or underscores.
  const norm = (s: string) => s.replace(/_/g, "").toLowerCase();
  const c = program.idl.constants?.find((k) => norm(k.name) === norm(name));
  if (!c) throw new Error(`missing IDL constant ${name}`);
  return JSON.parse(c.value) as string;
}
const PROVIDER = idlString("PROOF_PROVIDER");
const BEFORE_URL = idlString("PROOF_PARAMS_BEFORE_URL");
const AFTER_URL = idlString("PROOF_PARAMS_AFTER_URL");

const toHex = (b: Uint8Array) => Buffer.from(b).toString("hex");

function parameters(repo: string, pr: number) {
  return `${BEFORE_URL}https://api.github.com/repos/${repo}/issues/${pr}${AFTER_URL}`;
}

function context(deal: PublicKey, index: number) {
  return JSON.stringify({
    contextAddress: "0x0",
    contextMessage: `kept:v1:${toHex(deal.toBytes())}:${index}`,
  });
}

class Attestor {
  readonly secret = secp256k1.utils.randomPrivateKey();
  readonly address = Array.from(
    keccak_256(secp256k1.getPublicKey(this.secret, false).slice(1)).slice(12),
  );

  /// Signs a claim the way the attestor does: EIP-191 over
  /// "0x<identifier>\n<owner>\n<timestamp>\n<epoch>".
  sign(params: string, ctx: string) {
    const identifier = keccak_256(enc.encode(`${PROVIDER}\n${params}\n${ctx}`));
    const owner = "0x" + "ab".repeat(20);
    const timestampS = 1_759_000_000;
    const epoch = 1;
    const message = `0x${toHex(identifier)}\n${owner}\n${timestampS}\n${epoch}`;
    const digest = keccak_256(
      enc.encode(`\x19Ethereum Signed Message:\n${message.length}${message}`),
    );
    const sig = secp256k1.sign(digest, this.secret, { lowS: true });
    const signature = [...sig.toCompactRawBytes(), 27 + sig.recovery];
    return {
      context: ctx,
      identifier: Array.from(identifier),
      owner,
      timestampS,
      epoch,
      signature,
    };
  }
}

describe("proof release: the client's merge is the payment", () => {
  let env: Env;
  const attestor = new Attestor();

  before(async () => {
    env = await setupEnv();
  });

  function proofDeal(prs: number[] = [7], disputeDeposit = 5n * UNIT) {
    return activeDeal(env, {
      milestones: prs.map((pr) => ({ amount: 40n * UNIT, proofRef: pr })),
      proofAttestor: attestor.address,
      proofRepo: REPO,
      disputeDeposit,
    });
  }

  function submitProof(
    deal: PublicKey,
    index: number,
    proof: ReturnType<Attestor["sign"]>,
  ) {
    return program.methods
      .submitProof(index, proof)
      .accountsPartial({ submitter: env.stranger.publicKey, deal })
      .signers([env.stranger])
      .rpc();
  }

  it("a valid proof approves the milestone without the client", async () => {
    const { deal } = await proofDeal();
    await submitProof(
      deal,
      0,
      attestor.sign(parameters(REPO, 7), context(deal, 0)),
    );
    expect(statusOf((await fetchDeal(deal)).milestones[0].status)).to.equal(
      "approved",
    );
    const before = await balance(env.ata(env.worker.publicKey));
    await settle(env, deal, 0, { clientToken: null });
    expect(await balance(env.ata(env.worker.publicKey))).to.equal(
      before + 40n * UNIT,
    );
  });

  it("a proof during an undecided dispute pays amount and deposit", async () => {
    const { deal } = await proofDeal();
    await submit(env, deal, 0);
    await openDispute(env, deal, 0);
    await submitProof(
      deal,
      0,
      attestor.sign(parameters(REPO, 7), context(deal, 0)),
    );
    const before = await balance(env.ata(env.worker.publicKey));
    await settle(env, deal, 0, { clientToken: null });
    expect(await balance(env.ata(env.worker.publicKey))).to.equal(
      before + 45n * UNIT,
    );
  });

  it("is rejected after the arbiters decided", async () => {
    const { deal } = await proofDeal();
    await submit(env, deal, 0);
    await openDispute(env, deal, 0);
    await vote(deal, env.judges[0], 0, "client");
    await vote(deal, env.judges[1], 0, "client");
    await expectError(
      submitProof(
        deal,
        0,
        attestor.sign(parameters(REPO, 7), context(deal, 0)),
      ),
      "AlreadyDecided",
    );
  });

  it("cannot be replayed on another deal or milestone", async () => {
    const a = await proofDeal([7, 8]);
    const b = await proofDeal([7]);
    const forA0 = attestor.sign(parameters(REPO, 7), context(a.deal, 0));
    await expectError(submitProof(b.deal, 0, forA0), "ProofContextMismatch");
    const forA1Wrong = attestor.sign(parameters(REPO, 8), context(a.deal, 0));
    await expectError(
      submitProof(a.deal, 1, forA1Wrong),
      "ProofContextMismatch",
    );
  });

  it("must be about the agreed repository and pull request", async () => {
    const { deal } = await proofDeal();
    await expectError(
      submitProof(
        deal,
        0,
        attestor.sign(parameters(REPO, 8), context(deal, 0)),
      ),
      "ProofIdentifierMismatch",
    );
    await expectError(
      submitProof(
        deal,
        0,
        attestor.sign(parameters("someone/else", 7), context(deal, 0)),
      ),
      "ProofIdentifierMismatch",
    );
  });

  it("a tampered context breaks the identifier", async () => {
    const { deal } = await proofDeal();
    const proof = attestor.sign(parameters(REPO, 7), context(deal, 0));
    await expectError(
      submitProof(deal, 0, { ...proof, context: proof.context + " " }),
      "ProofIdentifierMismatch",
    );
  });

  it("must be signed by the deal's attestor", async () => {
    const { deal } = await proofDeal();
    const other = new Attestor();
    await expectError(
      submitProof(deal, 0, other.sign(parameters(REPO, 7), context(deal, 0))),
      "ProofAttestorMismatch",
    );
  });

  it("rejects a malformed owner", async () => {
    const { deal } = await proofDeal();
    const proof = attestor.sign(parameters(REPO, 7), context(deal, 0));
    await expectError(
      submitProof(deal, 0, { ...proof, owner: proof.owner.toUpperCase() }),
      "ProofMalformed",
    );
  });

  it("needs a proof condition on the milestone", async () => {
    const { deal } = await activeDeal(env, {
      proofAttestor: attestor.address,
      proofRepo: REPO,
    });
    await expectError(
      submitProof(
        deal,
        0,
        attestor.sign(parameters(REPO, 7), context(deal, 0)),
      ),
      "NoProofTarget",
    );
  });

  it("the client can link a pull request once", async () => {
    const { deal } = await activeDeal(env, {
      milestones: [{ amount: 10n * UNIT }, { amount: 10n * UNIT, proofRef: 3 }],
      proofAttestor: attestor.address,
      proofRepo: REPO,
    });
    const link = (index: number, pr: number) =>
      program.methods
        .setProofTarget(index, { prMerged: {} }, pr)
        .accountsPartial({ client: env.client.publicKey, deal })
        .signers([env.client])
        .rpc();
    await expectError(link(0, 3), "DuplicateProofTarget");
    await link(0, 4);
    await expectError(link(0, 5), "ProofTargetAlreadySet");
    await submitProof(
      deal,
      0,
      attestor.sign(parameters(REPO, 4), context(deal, 0)),
    );
  });
});
