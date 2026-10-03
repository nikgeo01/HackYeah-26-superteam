import { expect } from "chai";
import {
  UNIT,
  accept,
  activeDeal,
  approve,
  balance,
  cancel,
  closeDeal,
  connection,
  createDeal,
  expectError,
  fetchDeal,
  openDispute,
  passDeadline,
  provider,
  settle,
  setupEnv,
  statusOf,
  submit,
  vaultPda,
  vote,
  type Env,
} from "./helpers.ts";
import { createMintToInstruction } from "@solana/spl-token";
import * as anchor from "@anchor-lang/core";

describe("cancel and close", () => {
  let env: Env;
  before(async () => {
    env = await setupEnv();
  });

  it("the client cancels an open deal and gets everything back", async () => {
    const before = await balance(env.ata(env.client.publicKey));
    const { deal } = await createDeal(env, {
      milestones: [{ amount: 30n * UNIT }, { amount: 20n * UNIT }],
    });
    await cancel(deal, env.client);
    await settle(env, deal, 0, { workerToken: null });
    await settle(env, deal, 1, { workerToken: null });
    expect(await balance(env.ata(env.client.publicKey))).to.equal(before);
    await closeDeal(env, deal);
    expect(await connection.getAccountInfo(deal)).to.be.null;
    expect(await connection.getAccountInfo(vaultPda(deal))).to.be.null;
  });

  it("a stranger can cancel an open deal only after the accept deadline", async () => {
    const { deal } = await createDeal(env, { acceptWindowSecs: 20 });
    await expectError(cancel(deal, env.stranger), "NotParty");
    await expectError(cancel(deal, env.client, false), "InvalidCancelArgument");
    await passDeadline((await fetchDeal(deal)).acceptDeadline);
    await cancel(deal, env.stranger);
    expect(statusOf((await fetchDeal(deal)).status)).to.equal("cancelled");
  });

  it("after acceptance, cancelling needs both parties", async () => {
    const { deal } = await activeDeal(env);
    await cancel(deal, env.client);
    expect(statusOf((await fetchDeal(deal)).status)).to.equal("active");
    await expectError(cancel(deal, env.stranger), "NotParty");
    await cancel(deal, env.worker);
    expect(statusOf((await fetchDeal(deal)).status)).to.equal("cancelled");
    await expectError(cancel(deal, env.client), "DealNotCancellable");
  });

  it("a withdrawn request does not count", async () => {
    const { deal } = await activeDeal(env);
    await cancel(deal, env.worker, true);
    await cancel(deal, env.worker, false);
    await cancel(deal, env.client, true);
    expect(statusOf((await fetchDeal(deal)).status)).to.equal("active");
  });

  it("delivering work withdraws the worker's stale cancel request", async () => {
    const { deal } = await activeDeal(env);
    await cancel(deal, env.worker, true);
    await submit(env, deal, 0);
    await cancel(deal, env.client, true);
    expect(statusOf((await fetchDeal(deal)).status)).to.equal("active");
  });

  it("mutual cancel refunds undecided milestones, deposit included", async () => {
    const { deal } = await activeDeal(env, {
      milestones: [
        { amount: 10n * UNIT },
        { amount: 20n * UNIT },
        { amount: 30n * UNIT },
      ],
      disputeDeposit: 5n * UNIT,
    });
    await submit(env, deal, 1);
    await submit(env, deal, 2);
    await openDispute(env, deal, 2);
    const before = await balance(env.ata(env.client.publicKey));
    await cancel(deal, env.client);
    await cancel(deal, env.worker);
    for (const i of [0, 1, 2])
      await settle(env, deal, i, { workerToken: null });
    expect(await balance(env.ata(env.client.publicKey))).to.equal(
      before + 65n * UNIT,
    );
  });

  it("a recorded verdict beats a later cancel", async () => {
    const { deal } = await activeDeal(env, {
      milestones: [{ amount: 10n * UNIT }, { amount: 20n * UNIT }],
      disputeDeposit: 5n * UNIT,
    });
    await submit(env, deal, 0);
    await approve(env, deal, 0);
    await submit(env, deal, 1);
    await openDispute(env, deal, 1);
    await vote(deal, env.judges[0], 1, "worker");
    await vote(deal, env.judges[1], 1, "worker");
    await cancel(deal, env.client);
    await cancel(deal, env.worker);
    const before = await balance(env.ata(env.worker.publicKey));
    await settle(env, deal, 0, { clientToken: null });
    await settle(env, deal, 1, { clientToken: null });
    expect(await balance(env.ata(env.worker.publicKey))).to.equal(
      before + 35n * UNIT,
    );
  });

  it("close fails until everything is settled, then sweeps leftovers", async () => {
    const { deal } = await activeDeal(env, {
      milestones: [{ amount: 10n * UNIT }],
    });
    // Someone sends tokens straight to the vault.
    // (Sent through the Anchor provider: its blockhash handling survives the
    // test clock jumps, unlike spl-token's helper.)
    await provider.sendAndConfirm(
      new anchor.web3.Transaction().add(
        createMintToInstruction(
          env.mint,
          vaultPda(deal),
          env.mintAuthority.publicKey,
          3n * UNIT,
        ),
      ),
      [env.mintAuthority],
    );
    await expectError(closeDeal(env, deal), "DealNotFullySettled");
    await submit(env, deal, 0);
    await approve(env, deal, 0);
    await settle(env, deal, 0, { clientToken: null });
    const before = await balance(env.ata(env.client.publicKey));
    await closeDeal(env, deal);
    expect(await balance(env.ata(env.client.publicKey))).to.equal(
      before + 3n * UNIT,
    );
  });

  it("cannot act on a cancelled deal", async () => {
    const { deal } = await createDeal(env);
    await cancel(deal, env.client);
    await expectError(accept(env, deal), "DealNotOpen");
  });
});
