import { expect } from "chai";
import * as anchor from "@anchor-lang/core";
import {
  UNIT,
  accept,
  activeDeal,
  approve,
  assertVaultInvariant,
  balance,
  chainNow,
  createDeal,
  expectError,
  fetchDeal,
  passDeadline,
  program,
  settle,
  setupEnv,
  statusOf,
  submit,
  timeTravelTo,
  vaultPda,
  type Env,
} from "./helpers.ts";

describe("core: create, accept, deliver, approve, silence pays", () => {
  let env: Env;
  before(async () => {
    env = await setupEnv();
  });

  it("locks the full escrow in the vault", async () => {
    const before = await balance(env.ata(env.client.publicKey));
    const { deal, vault } = await createDeal(env, {
      milestones: [{ amount: 60n * UNIT }, { amount: 40n * UNIT }],
    });
    expect(await balance(vault)).to.equal(100n * UNIT);
    expect(await balance(env.ata(env.client.publicKey))).to.equal(
      before - 100n * UNIT,
    );
    const account = await fetchDeal(deal);
    expect(statusOf(account.status)).to.equal("open");
    expect(account.milestones).to.have.length(2);
  });

  it("happy path: approve then settle pays the worker", async () => {
    const { deal } = await activeDeal(env);
    await submit(env, deal, 0);
    await approve(env, deal, 0);
    const before = await balance(env.ata(env.worker.publicKey));
    await settle(env, deal, 0, { clientToken: null });
    expect(await balance(env.ata(env.worker.publicKey))).to.equal(
      before + 100n * UNIT,
    );
    const m = (await fetchDeal(deal)).milestones[0];
    expect(statusOf(m.status)).to.equal("settled");
    expect(statusOf(m.outcome)).to.equal("workerPaid");
    await assertVaultInvariant(deal);
  });

  it("milestones are independent", async () => {
    const { deal } = await activeDeal(env, {
      milestones: [{ amount: 10n * UNIT }, { amount: 20n * UNIT }],
    });
    await submit(env, deal, 1);
    await approve(env, deal, 1);
    await settle(env, deal, 1);
    const account = await fetchDeal(deal);
    expect(statusOf(account.milestones[0].status)).to.equal("pending");
    expect(account.settledCount).to.equal(1);
    expect(await balance(vaultPda(deal))).to.equal(10n * UNIT);
  });

  it("silence pays: a stranger releases after the review window", async () => {
    const { deal } = await activeDeal(env);
    await submit(env, deal, 0);
    await expectError(settle(env, deal, 0), "NothingToSettle");

    const m = (await fetchDeal(deal)).milestones[0];
    await passDeadline(m.reviewDeadline);
    const before = await balance(env.ata(env.worker.publicKey));
    await settle(env, deal, 0, { clientToken: null });
    expect(await balance(env.ata(env.worker.publicKey))).to.equal(
      before + 100n * UNIT,
    );
  });

  it("no delivery: the client is refunded after the delivery deadline", async () => {
    const { deal } = await activeDeal(env, {
      milestones: [{ amount: 50n * UNIT, dueSecs: 20 }],
    });
    await expectError(settle(env, deal, 0), "NothingToSettle");
    const m = (await fetchDeal(deal)).milestones[0];
    await passDeadline(m.submitDeadline);
    await expectError(submit(env, deal, 0), "SubmitWindowClosed");
    const before = await balance(env.ata(env.client.publicKey));
    await settle(env, deal, 0, { workerToken: null });
    expect(await balance(env.ata(env.client.publicKey))).to.equal(
      before + 50n * UNIT,
    );
  });

  it("acceptance closes at the accept deadline", async () => {
    const { deal } = await createDeal(env, { acceptWindowSecs: 20 });
    const account = await fetchDeal(deal);
    await timeTravelTo(Number(account.acceptDeadline));
    await expectError(accept(env, deal), "AcceptWindowClosed");
  });

  it("a milestone is paid exactly once", async () => {
    const { deal } = await activeDeal(env);
    await submit(env, deal, 0);
    await approve(env, deal, 0);
    await settle(env, deal, 0);
    await expectError(settle(env, deal, 0), "AlreadySettled");
    await expectError(approve(env, deal, 0), "InvalidMilestoneStatus");
    await expectError(submit(env, deal, 0), "InvalidMilestoneStatus");
  });

  it("requires the recipient's token account only when it is paid", async () => {
    const { deal } = await activeDeal(env);
    await submit(env, deal, 0);
    await approve(env, deal, 0);
    await expectError(
      settle(env, deal, 0, { workerToken: null }),
      "MissingRecipientAccount",
    );
  });

  it("rejects a recipient account that belongs to someone else", async () => {
    const { deal } = await activeDeal(env);
    await submit(env, deal, 0);
    await approve(env, deal, 0);
    await expectError(
      settle(env, deal, 0, {
        workerToken: env.ata(env.client.publicKey),
        clientToken: null,
      }),
      "ConstraintTokenOwner",
    );
  });

  it("only the right party can act", async () => {
    const { deal } = await createDeal(env);
    await expectError(acceptAs(deal, env.stranger), "NotWorker");
    await accept(env, deal);
    await submit(env, deal, 0);
    await expectError(approveAs(deal, env.worker), "NotClient");
  });

  it("chain time moves forward with time travel", async () => {
    const now = await chainNow();
    await timeTravelTo(now + 5);
    expect(await chainNow()).to.be.at.least(now + 5);
  });
});

function acceptAs(deal: anchor.web3.PublicKey, kp: anchor.web3.Keypair) {
  return program.methods
    .acceptDeal()
    .accountsPartial({ worker: kp.publicKey, deal })
    .signers([kp])
    .rpc();
}
function approveAs(deal: anchor.web3.PublicKey, kp: anchor.web3.Keypair) {
  return program.methods
    .approveMilestone(0)
    .accountsPartial({ client: kp.publicKey, deal })
    .signers([kp])
    .rpc();
}
