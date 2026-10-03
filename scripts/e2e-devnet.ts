// Runs every scenario of the plan (S1–S8) against the deployed program on
// devnet with short timers, one after another, and prints a pass/fail table with
// explorer links. Used as a release gate before the final deploy.
//   RPC_URL=<devnet rpc> node scripts/e2e-devnet.ts
//
// The deployer wallet pays every fee and plays the client. Worker, arbiters
// and the passer-by are throwaway keypairs that only sign. Deals are closed at
// the end, so almost all rent comes back. S7 (proof release) uses a locally
// generated attestor key named in the deal, exercising the same on-chain
// verification a real attestor proof goes through.
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { AnchorProvider, Wallet } from "@anchor-lang/core";
import BN from "bn.js";
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  type TransactionInstruction,
} from "@solana/web3.js";
import {
  MINT_SIZE,
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountIdempotentInstruction,
  createInitializeMint2Instruction,
  createMintToInstruction,
  getAssociatedTokenAddressSync,
  getMinimumBalanceForRentExemptMint,
} from "@solana/spl-token";
import { secp256k1 } from "@noble/curves/secp256k1.js";
import { keccak_256 } from "@noble/hashes/sha3.js";
import { escrowProgram } from "../client/program.ts";
import { dealAddress, vaultAddress } from "../client/pdas.ts";

const rpc = process.env.RPC_URL ?? "https://api.devnet.solana.com";
const walletPath = (
  process.env.ANCHOR_WALLET ?? "~/.config/solana/id.json"
).replace("~", homedir());
const payer = Keypair.fromSecretKey(
  Uint8Array.from(JSON.parse(readFileSync(walletPath, "utf8")) as number[]),
);
const connection = new Connection(rpc, "confirmed");
const provider = new AnchorProvider(connection, new Wallet(payer), {
  commitment: "confirmed",
});
const program = escrowProgram(connection, new Wallet(payer));
const link = (sig: string) =>
  `https://explorer.solana.com/tx/${sig}?cluster=devnet`;

const WINDOW = 12; // seconds; devnet timers are real time
const UNIT = 1_000_000n;
const REPO = "e2e/devnet";
const worker = Keypair.generate();
const judges = [Keypair.generate(), Keypair.generate(), Keypair.generate()];
const stranger = Keypair.generate();
const mintKp = Keypair.generate();
const mint = mintKp.publicKey;
const ata = (owner: PublicKey) => getAssociatedTokenAddressSync(mint, owner);
const attestorSecret = secp256k1.utils.randomPrivateKey();
const attestorAddress = Array.from(
  keccak_256(secp256k1.getPublicKey(attestorSecret, false).slice(1)).slice(12),
);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/// Sends instructions with the deployer as fee payer plus extra signers.
async function send(
  ixs: Promise<TransactionInstruction>[],
  signers: Keypair[] = [],
) {
  const tx = new Transaction();
  for (const ix of ixs) tx.add(await ix);
  return provider.sendAndConfirm(tx, signers);
}

/// Waits until the cluster clock passes `deadline`.
async function waitPast(deadline: BN | number) {
  for (;;) {
    const slot = await connection.getSlot();
    const time = (await connection.getBlockTime(slot)) ?? 0;
    if (time > Number(deadline)) return;
    await sleep(3_000);
  }
}

type Spec = {
  amounts?: bigint[];
  dueSecs?: number;
  proofRefs?: number[];
};

async function newDeal(spec: Spec = {}) {
  const amounts = spec.amounts ?? [10n * UNIT];
  const dealId = new BN(Date.now() + Math.floor(Math.random() * 1e6));
  const deal = dealAddress(
    program.programId,
    payer.publicKey,
    BigInt(dealId.toString()),
  );
  const vault = vaultAddress(program.programId, deal);
  const sig = await program.methods
    .createDeal({
      dealId,
      worker: worker.publicKey,
      judges: judges.map((j) => j.publicKey) as [
        PublicKey,
        PublicKey,
        PublicKey,
      ],
      acceptWindowSecs: 600,
      reviewWindowSecs: WINDOW,
      voteWindowSecs: WINDOW,
      disputeDeposit: new BN((2n * UNIT).toString()),
      proofAttestor: spec.proofRefs ? attestorAddress : Array(20).fill(0),
      proofRepo: spec.proofRefs ? REPO : "",
      milestones: amounts.map((a, i) => ({
        amount: new BN(a.toString()),
        dueSecs: spec.dueSecs ?? 600,
        proofKind: spec.proofRefs ? { prMerged: {} } : { off: {} },
        proofRef: spec.proofRefs?.[i] ?? 0,
      })),
    })
    .accountsPartial({
      client: payer.publicKey,
      deal,
      mint,
      vault,
      clientToken: ata(payer.publicKey),
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .rpc();
  return { deal, vault, links: [link(sig)] };
}

const m = program.methods;
const ix = {
  accept: (deal: PublicKey) =>
    m
      .acceptDeal()
      .accountsPartial({ worker: worker.publicKey, deal })
      .instruction(),
  submit: (deal: PublicKey, i: number) =>
    m
      .submitWork(i, Array(32).fill(i + 1), "https://example.com/pr")
      .accountsPartial({ worker: worker.publicKey, deal })
      .instruction(),
  approve: (deal: PublicKey, i: number) =>
    m
      .approveMilestone(i)
      .accountsPartial({ client: payer.publicKey, deal })
      .instruction(),
  dispute: (deal: PublicKey, i: number) =>
    m
      .openDispute(i)
      .accountsPartial({
        client: payer.publicKey,
        deal,
        mint,
        vault: vaultAddress(program.programId, deal),
        clientToken: ata(payer.publicKey),
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .instruction(),
  vote: (deal: PublicKey, j: number, i: number, side: "worker" | "client") =>
    m
      .castVote(i, side === "worker" ? { worker: {} } : { client: {} })
      .accountsPartial({ judge: judges[j].publicKey, deal })
      .instruction(),
  cancel: (deal: PublicKey, signer: PublicKey, agree = true) =>
    m.cancelDeal(agree).accountsPartial({ signer, deal }).instruction(),
  settle: (deal: PublicKey, i: number) =>
    m
      .settleMilestone(i)
      .accountsPartial({
        cranker: stranger.publicKey,
        deal,
        mint,
        vault: vaultAddress(program.programId, deal),
        workerToken: ata(worker.publicKey),
        clientToken: ata(payer.publicKey),
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .instruction(),
  close: (deal: PublicKey) =>
    m
      .closeDeal()
      .accountsPartial({
        cranker: payer.publicKey,
        deal,
        client: payer.publicKey,
        mint,
        vault: vaultAddress(program.programId, deal),
        clientToken: ata(payer.publicKey),
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .instruction(),
};

const outcomeOf = async (deal: PublicKey, i: number) =>
  Object.keys(
    (await program.account.deal.fetch(deal)).milestones[i].outcome,
  )[0];

function expectEq(actual: unknown, expected: unknown, what: string) {
  if (actual !== expected)
    throw new Error(
      `${what}: expected ${String(expected)}, got ${String(actual)}`,
    );
}

function signProof(deal: PublicKey, index: number, pr: number) {
  const enc = new TextEncoder();
  const constant = (name: string) => {
    const norm = (s: string) => s.replace(/_/g, "").toLowerCase();
    const c = program.idl.constants?.find((k) => norm(k.name) === norm(name));
    return JSON.parse(c!.value) as string;
  };
  const params = `${constant("PROOF_PARAMS_BEFORE_URL")}https://api.github.com/repos/${REPO}/issues/${pr}${constant("PROOF_PARAMS_AFTER_URL")}`;
  const context = JSON.stringify({
    contextAddress: "0x0",
    contextMessage: `kept:v1:${Buffer.from(deal.toBytes()).toString("hex")}:${index}`,
  });
  const identifier = keccak_256(
    enc.encode(`${constant("PROOF_PROVIDER")}\n${params}\n${context}`),
  );
  const owner = "0x" + "ab".repeat(20);
  const message = `0x${Buffer.from(identifier).toString("hex")}\n${owner}\n1759000000\n1`;
  const digest = keccak_256(
    enc.encode(`\x19Ethereum Signed Message:\n${message.length}${message}`),
  );
  const sig = secp256k1.sign(digest, attestorSecret, { lowS: true });
  return {
    context,
    identifier: Array.from(identifier),
    owner,
    timestampS: 1759000000,
    epoch: 1,
    signature: [...sig.toCompactRawBytes(), 27 + sig.recovery],
  };
}

const scenarios: Record<string, () => Promise<string[]>> = {
  "S1 approve and pay": async () => {
    const { deal, links } = await newDeal();
    links.push(
      link(await send([ix.accept(deal), ix.submit(deal, 0)], [worker])),
    );
    links.push(
      link(await send([ix.approve(deal, 0), ix.settle(deal, 0)], [stranger])),
    );
    expectEq(await outcomeOf(deal, 0), "workerPaid", "outcome");
    links.push(link(await send([ix.close(deal)])));
    return links;
  },
  "S2 silence pays (stranger releases)": async () => {
    const { deal, links } = await newDeal();
    links.push(
      link(await send([ix.accept(deal), ix.submit(deal, 0)], [worker])),
    );
    const d = await program.account.deal.fetch(deal);
    await waitPast(d.milestones[0].reviewDeadline);
    links.push(link(await send([ix.settle(deal, 0)], [stranger])));
    expectEq(await outcomeOf(deal, 0), "workerPaid", "outcome");
    links.push(link(await send([ix.close(deal)])));
    return links;
  },
  "S3 dispute, arbiters side with worker": async () => {
    const { deal, links } = await newDeal();
    links.push(
      link(await send([ix.accept(deal), ix.submit(deal, 0)], [worker])),
    );
    links.push(link(await send([ix.dispute(deal, 0)])));
    links.push(
      link(
        await send(
          [
            ix.vote(deal, 0, 0, "worker"),
            ix.vote(deal, 1, 0, "worker"),
            ix.settle(deal, 0),
          ],
          [judges[0], judges[1], stranger],
        ),
      ),
    );
    expectEq(await outcomeOf(deal, 0), "workerPaid", "outcome");
    links.push(link(await send([ix.close(deal)])));
    return links;
  },
  "S4 no majority, 50/50 split": async () => {
    const { deal, links } = await newDeal();
    links.push(
      link(await send([ix.accept(deal), ix.submit(deal, 0)], [worker])),
    );
    links.push(link(await send([ix.dispute(deal, 0)])));
    links.push(
      link(
        await send(
          [ix.vote(deal, 0, 0, "worker"), ix.vote(deal, 1, 0, "client")],
          [judges[0], judges[1]],
        ),
      ),
    );
    const d = await program.account.deal.fetch(deal);
    await waitPast(d.milestones[0].voteDeadline);
    links.push(link(await send([ix.settle(deal, 0)], [stranger])));
    expectEq(await outcomeOf(deal, 0), "split", "outcome");
    links.push(link(await send([ix.close(deal)])));
    return links;
  },
  "S5 no delivery, client refunded": async () => {
    const { deal, links } = await newDeal({ dueSecs: WINDOW });
    links.push(link(await send([ix.accept(deal)], [worker])));
    const d = await program.account.deal.fetch(deal);
    await waitPast(d.milestones[0].submitDeadline);
    links.push(link(await send([ix.settle(deal, 0)], [stranger])));
    expectEq(await outcomeOf(deal, 0), "clientRefunded", "outcome");
    links.push(link(await send([ix.close(deal)])));
    return links;
  },
  "S6 mutual cancel refunds the client": async () => {
    const { deal, links } = await newDeal({ amounts: [5n * UNIT, 5n * UNIT] });
    links.push(link(await send([ix.accept(deal)], [worker])));
    links.push(
      link(
        await send(
          [ix.cancel(deal, payer.publicKey), ix.cancel(deal, worker.publicKey)],
          [worker],
        ),
      ),
    );
    links.push(
      link(await send([ix.settle(deal, 0), ix.settle(deal, 1)], [stranger])),
    );
    expectEq(await outcomeOf(deal, 1), "cancelled", "outcome");
    links.push(link(await send([ix.close(deal)])));
    return links;
  },
  "S7 proof release (test attestor)": async () => {
    const { deal, links } = await newDeal({ proofRefs: [7] });
    links.push(link(await send([ix.accept(deal)], [worker])));
    links.push(
      link(
        await send(
          [
            m
              .submitProof(0, signProof(deal, 0, 7))
              .accountsPartial({ submitter: stranger.publicKey, deal })
              .instruction(),
            ix.settle(deal, 0),
          ],
          [stranger],
        ),
      ),
    );
    expectEq(await outcomeOf(deal, 0), "workerPaid", "outcome");
    links.push(link(await send([ix.close(deal)])));
    return links;
  },
};

async function main() {
  console.log(`program ${program.programId.toBase58()} on ${rpc}`);
  const before = await connection.getBalance(payer.publicKey);
  await send(
    [
      Promise.resolve(
        SystemProgram.createAccount({
          fromPubkey: payer.publicKey,
          newAccountPubkey: mint,
          lamports: await getMinimumBalanceForRentExemptMint(connection),
          space: MINT_SIZE,
          programId: TOKEN_PROGRAM_ID,
        }),
      ),
      Promise.resolve(
        createInitializeMint2Instruction(mint, 6, payer.publicKey, null),
      ),
      ...[payer.publicKey, worker.publicKey].map((owner) =>
        Promise.resolve(
          createAssociatedTokenAccountIdempotentInstruction(
            payer.publicKey,
            ata(owner),
            owner,
            mint,
          ),
        ),
      ),
      Promise.resolve(
        createMintToInstruction(
          mint,
          ata(payer.publicKey),
          payer.publicKey,
          1_000n * UNIT,
        ),
      ),
    ],
    [mintKp],
  );

  // Sequential: the public devnet RPC rate-limits parallel confirmation polling.
  let failed = 0;
  for (const [name, run] of Object.entries(scenarios)) {
    try {
      const links = await run();
      console.log(`PASS  ${name}`);
      for (const l of links) console.log(`        ${l}`);
    } catch (error) {
      failed++;
      console.log(`FAIL  ${name}: ${(error as Error).message}`);
    }
  }
  const spent = (before - (await connection.getBalance(payer.publicKey))) / 1e9;
  console.log(
    `\n${Object.keys(scenarios).length - failed} passed, ${failed} failed; spent ${spent.toFixed(4)} SOL`,
  );
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
