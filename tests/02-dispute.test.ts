import { expect } from "chai";
import {
  UNIT,
  activeDeal,
  approve,
  assertVaultInvariant,
  balance,
  expectError,
  fetchDeal,
  openDispute,
  passDeadline,
  settle,
  setupEnv,
  statusOf,
  submit,
  vote,
  type Env,
} from "./helpers.ts";

const AMOUNT = 101n; // odd, to check who gets the indivisible unit
const DEPOSIT = 20n;

describe("disputes: objection deposit and three arbiters", () => {
  let env: Env;
  before(async () => {
    env = await setupEnv();
  });

  async function disputedDeal() {
    const { deal } = await activeDeal(env, {
      milestones: [{ amount: AMOUNT }],
      disputeDeposit: DEPOSIT,
    });
    await submit(env, deal, 0);
    await openDispute(env, deal, 0);
    return deal;
  }

  it("objecting locks the deposit in the vault", async () => {
    const before = await balance(env.ata(env.client.publicKey));
    const deal = await disputedDeal();
    const m = (await fetchDeal(deal)).milestones[0];
    expect(statusOf(m.status)).to.equal("disputed");
    expect(BigInt(m.depositLocked.toString())).to.equal(DEPOSIT);
    expect(await balance(env.ata(env.client.publicKey))).to.equal(
      before - AMOUNT - DEPOSIT,
    );
    await assertVaultInvariant(deal);
  });

  it("two votes for the worker pay amount and deposit to the worker", async () => {
    const deal = await disputedDeal();
    await vote(deal, env.judges[0], 0, "worker");
    await expectError(settle(env, deal, 0), "NothingToSettle");
    await vote(deal, env.judges[2], 0, "worker");
    const before = await balance(env.ata(env.worker.publicKey));
    await settle(env, deal, 0, { clientToken: null });
    expect(await balance(env.ata(env.worker.publicKey))).to.equal(
      before + AMOUNT + DEPOSIT,
    );
  });

  it("two votes for the client refund amount and deposit", async () => {
    const deal = await disputedDeal();
    await vote(deal, env.judges[0], 0, "client");
    await vote(deal, env.judges[1], 0, "client");
    const before = await balance(env.ata(env.client.publicKey));
    await settle(env, deal, 0, { workerToken: null });
    expect(await balance(env.ata(env.client.publicKey))).to.equal(
      before + AMOUNT + DEPOSIT,
    );
    const m = (await fetchDeal(deal)).milestones[0];
    expect(statusOf(m.outcome)).to.equal("clientRefunded");
  });

  it("no majority by the deadline splits 50/50 and returns the deposit", async () => {
    const deal = await disputedDeal();
    await vote(deal, env.judges[0], 0, "worker");
    await vote(deal, env.judges[1], 0, "client");
    const m = (await fetchDeal(deal)).milestones[0];
    await passDeadline(m.voteDeadline);
    await expectError(
      vote(deal, env.judges[2], 0, "worker"),
      "VoteWindowClosed",
    );
    const w = await balance(env.ata(env.worker.publicKey));
    const c = await balance(env.ata(env.client.publicKey));
    await settle(env, deal, 0);
    expect(await balance(env.ata(env.worker.publicKey))).to.equal(w + 51n);
    expect(await balance(env.ata(env.client.publicKey))).to.equal(
      c + 50n + DEPOSIT,
    );
  });

  it("zero votes by the deadline also split", async () => {
    const deal = await disputedDeal();
    const m = (await fetchDeal(deal)).milestones[0];
    await passDeadline(m.voteDeadline);
    await settle(env, deal, 0);
    const after = (await fetchDeal(deal)).milestones[0];
    expect(statusOf(after.outcome)).to.equal("split");
  });

  it("rejects a double vote, a third vote after a majority, and outsiders", async () => {
    const deal = await disputedDeal();
    await vote(deal, env.judges[0], 0, "worker");
    await expectError(vote(deal, env.judges[0], 0, "client"), "AlreadyVoted");
    await expectError(vote(deal, env.stranger, 0, "worker"), "NotJudge");
    await expectError(vote(deal, env.worker, 0, "worker"), "NotJudge");
    await vote(deal, env.judges[1], 0, "worker");
    await expectError(vote(deal, env.judges[2], 0, "client"), "AlreadyDecided");
  });

  it("the client can concede a dispute; the deposit goes to the worker", async () => {
    const deal = await disputedDeal();
    await approve(env, deal, 0);
    const before = await balance(env.ata(env.worker.publicKey));
    await settle(env, deal, 0, { clientToken: null });
    expect(await balance(env.ata(env.worker.publicKey))).to.equal(
      before + AMOUNT + DEPOSIT,
    );
  });

  it("no objection after the review window", async () => {
    const { deal } = await activeDeal(env);
    await submit(env, deal, 0);
    const m = (await fetchDeal(deal)).milestones[0];
    await passDeadline(m.reviewDeadline);
    await expectError(openDispute(env, deal, 0), "ReviewWindowClosed");
  });

  it("a zero-deposit deal can still be disputed", async () => {
    const { deal } = await activeDeal(env, { disputeDeposit: 0n });
    await submit(env, deal, 0);
    await openDispute(env, deal, 0);
    const m = (await fetchDeal(deal)).milestones[0];
    expect(statusOf(m.status)).to.equal("disputed");
    expect(m.depositLocked.toString()).to.equal("0");
  });

  it("only the client can object", async () => {
    const { deal } = await activeDeal(env, {
      milestones: [{ amount: 5n * UNIT }],
    });
    await submit(env, deal, 0);
    // A worker-signed objection fails the client constraint.
    const { program, vaultPda } = await import("./helpers.ts");
    const { TOKEN_PROGRAM_ID } = await import("@solana/spl-token");
    await expectError(
      program.methods
        .openDispute(0)
        .accountsPartial({
          client: env.worker.publicKey,
          deal,
          mint: env.mint,
          vault: vaultPda(deal),
          clientToken: env.ata(env.worker.publicKey),
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([env.worker])
        .rpc(),
      "NotClient",
    );
  });
});
