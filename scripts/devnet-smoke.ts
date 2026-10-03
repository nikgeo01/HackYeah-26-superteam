// Runs one full deal on devnet (create → accept → deliver → approve → settle)
// against the deployed program and prints an explorer link for every step.
//   RPC_URL=https://api.devnet.solana.com node scripts/devnet-smoke.ts
// The deployer wallet (~/.config/solana/id.json, or ANCHOR_WALLET) pays fees
// and plays the client; a throwaway keypair plays the freelancer.
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

async function main() {
  const worker = Keypair.generate();
  const judges = [Keypair.generate(), Keypair.generate(), Keypair.generate()];
  const mintKp = Keypair.generate();
  const mint = mintKp.publicKey;
  const ata = (owner: PublicKey) => getAssociatedTokenAddressSync(mint, owner);

  const setup = await provider.sendAndConfirm(
    new Transaction().add(
      SystemProgram.createAccount({
        fromPubkey: payer.publicKey,
        newAccountPubkey: mint,
        lamports: await getMinimumBalanceForRentExemptMint(connection),
        space: MINT_SIZE,
        programId: TOKEN_PROGRAM_ID,
      }),
      createInitializeMint2Instruction(mint, 6, payer.publicKey, null),
      ...[payer.publicKey, worker.publicKey].map((owner) =>
        createAssociatedTokenAccountIdempotentInstruction(
          payer.publicKey,
          ata(owner),
          owner,
          mint,
        ),
      ),
      createMintToInstruction(
        mint,
        ata(payer.publicKey),
        payer.publicKey,
        100_000_000n,
      ),
    ),
    [mintKp],
  );
  console.log("test mint + token accounts:", link(setup));

  const dealId = new BN(Date.now());
  const deal = dealAddress(
    program.programId,
    payer.publicKey,
    BigInt(dealId.toString()),
  );
  const vault = vaultAddress(program.programId, deal);

  const create = await program.methods
    .createDeal({
      dealId,
      worker: worker.publicKey,
      judges: judges.map((j) => j.publicKey) as [
        PublicKey,
        PublicKey,
        PublicKey,
      ],
      acceptWindowSecs: 600,
      reviewWindowSecs: 60,
      voteWindowSecs: 60,
      disputeDeposit: new BN(1_000_000),
      proofAttestor: Array(20).fill(0),
      proofRepo: "",
      milestones: [
        {
          amount: new BN(10_000_000),
          dueSecs: 600,
          proofKind: { off: {} },
          proofRef: 0,
        },
      ],
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
  console.log("create_deal:", link(create));

  // The freelancer signs; the deployer pays the fee.
  const asWorker = async (
    ix: Promise<import("@solana/web3.js").TransactionInstruction>,
  ) => provider.sendAndConfirm(new Transaction().add(await ix), [worker]);

  console.log(
    "accept_deal:",
    link(
      await asWorker(
        program.methods
          .acceptDeal()
          .accountsPartial({ worker: worker.publicKey, deal })
          .instruction(),
      ),
    ),
  );
  console.log(
    "submit_work:",
    link(
      await asWorker(
        program.methods
          .submitWork(0, Array(32).fill(1), "https://github.com/example/pull/1")
          .accountsPartial({ worker: worker.publicKey, deal })
          .instruction(),
      ),
    ),
  );

  const approveAndSettle = await provider.sendAndConfirm(
    new Transaction().add(
      await program.methods
        .approveMilestone(0)
        .accountsPartial({ client: payer.publicKey, deal })
        .instruction(),
      await program.methods
        .settleMilestone(0)
        .accountsPartial({
          cranker: payer.publicKey,
          deal,
          mint,
          vault,
          workerToken: ata(worker.publicKey),
          clientToken: null,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .instruction(),
    ),
  );
  console.log("approve + settle:", link(approveAndSettle));

  const paid = await connection.getTokenAccountBalance(ata(worker.publicKey));
  console.log(`worker received ${paid.value.uiAmountString} test tokens`);
  console.log(
    "deal account:",
    `https://explorer.solana.com/address/${deal}?cluster=devnet`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
