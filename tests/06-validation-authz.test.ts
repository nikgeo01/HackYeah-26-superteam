// Create-deal validation (group V) and authorization (group G): every rule in
// docs/PERMISSIONS.md has a test that a wrong caller or bad input is refused.
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import {
  UNIT,
  activeDeal,
  approve,
  createDeal,
  createDealArgs,
  dealPda,
  expectError,
  openDispute,
  program,
  settle,
  setupEnv,
  submit,
  vaultPda,
  type DealOptions,
  type Env,
} from "./helpers.ts";

describe("validation and authorization", () => {
  let env: Env;
  let other: Env; // a second mint and set of people
  before(async () => {
    env = await setupEnv();
    other = await setupEnv();
  });

  describe("create_deal validation", () => {
    const rejects = (name: string, opts: DealOptions, code: string) =>
      it(name, () => expectError(createDeal(env, opts), code));

    rejects("zero milestones", { milestones: [] }, "InvalidMilestoneCount");
    rejects(
      "six milestones",
      { milestones: Array(6).fill({ amount: UNIT }) },
      "InvalidMilestoneCount",
    );
    rejects("a zero amount", { milestones: [{ amount: 0n }] }, "ZeroAmount");
    rejects(
      "a review window under 10 s",
      { reviewWindowSecs: 9 },
      "WindowOutOfBounds",
    );
    rejects(
      "a vote window over a year",
      { voteWindowSecs: 31_536_001 },
      "WindowOutOfBounds",
    );
    rejects(
      "a due time under 10 s",
      { milestones: [{ amount: UNIT, dueSecs: 5 }] },
      "WindowOutOfBounds",
    );
    rejects(
      "a repository without a slash",
      { proofRepo: "nope" },
      "InvalidRepo",
    );
    rejects(
      "a proof milestone without a repository",
      {
        milestones: [{ amount: UNIT, proofRef: 1 }],
        proofAttestor: Array(20).fill(1),
      },
      "InvalidProofTarget",
    );
    rejects(
      "a proof milestone without an attestor",
      { milestones: [{ amount: UNIT, proofRef: 1 }], proofRepo: "a/b" },
      "InvalidProofTarget",
    );
    rejects(
      "the same pull request twice",
      {
        milestones: [
          { amount: UNIT, proofRef: 3 },
          { amount: UNIT, proofRef: 3 },
        ],
        proofRepo: "a/b",
        proofAttestor: Array(20).fill(1),
      },
      "DuplicateProofTarget",
    );

    it("the client as worker", async () => {
      await expectError(
        createDeal(env, { worker: env.client.publicKey }),
        "DuplicateParty",
      );
    });
    it("the same arbiter twice", async () => {
      const j = env.judges[0].publicKey;
      await expectError(
        createDeal(env, { judges: [j, j, env.judges[2].publicKey] }),
        "DuplicateParty",
      );
    });
    it("a party as arbiter", async () => {
      await expectError(
        createDeal(env, {
          judges: [
            env.worker.publicKey,
            env.judges[1].publicKey,
            env.judges[2].publicKey,
          ],
        }),
        "DuplicateParty",
      );
    });
    it("funding from someone else's token account", async () => {
      const args = createDealArgs(env);
      const deal = dealPda(env.client.publicKey, args.dealId);
      await expectError(
        program.methods
          .createDeal(args)
          .accountsPartial({
            client: env.client.publicKey,
            deal,
            mint: env.mint,
            vault: vaultPda(deal),
            clientToken: env.ata(env.worker.publicKey),
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .signers([env.client])
          .rpc(),
        "ConstraintTokenOwner",
      );
    });
  });

  describe("only the right person can act", () => {
    it("submit_work: only the worker", async () => {
      const { deal } = await activeDeal(env);
      await expectError(
        program.methods
          .submitWork(0, Array(32).fill(0), "")
          .accountsPartial({ worker: env.stranger.publicKey, deal })
          .signers([env.stranger])
          .rpc(),
        "NotWorker",
      );
    });

    it("set_proof_target: only the client", async () => {
      const { deal } = await activeDeal(env, {
        proofRepo: "a/b",
        proofAttestor: Array(20).fill(1),
      });
      await expectError(
        program.methods
          .setProofTarget(0, { prMerged: {} }, 9)
          .accountsPartial({ client: env.worker.publicKey, deal })
          .signers([env.worker])
          .rpc(),
        "NotClient",
      );
    });

    it("an index that does not exist", async () => {
      const { deal } = await activeDeal(env);
      await expectError(submit(env, deal, 3), "InvalidMilestoneIndex");
    });

    it("approve before delivery", async () => {
      const { deal } = await activeDeal(env);
      await expectError(approve(env, deal, 0), "InvalidMilestoneStatus");
    });

    it("object before delivery", async () => {
      const { deal } = await activeDeal(env);
      await expectError(openDispute(env, deal, 0), "InvalidMilestoneStatus");
    });
  });

  describe("settle and close accounts", () => {
    async function approvedDeal() {
      const { deal } = await activeDeal(env);
      await submit(env, deal, 0);
      await approve(env, deal, 0);
      return deal;
    }

    it("rejects a mint other than the deal's", async () => {
      const deal = await approvedDeal();
      await expectError(
        program.methods
          .settleMilestone(0)
          .accountsPartial({
            cranker: env.stranger.publicKey,
            deal,
            mint: other.mint,
            vault: vaultPda(deal),
            workerToken: env.ata(env.worker.publicKey),
            clientToken: null,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .signers([env.stranger])
          .rpc(),
        "ConstraintAddress",
      );
    });

    it("rejects a recipient account of another mint", async () => {
      const deal = await approvedDeal();
      await expectError(
        settle(env, deal, 0, {
          workerToken: other.ata(other.worker.publicKey),
          clientToken: null,
        }),
        "Constraint",
      );
    });

    it("rejects a vault that is not the deal's", async () => {
      const a = await approvedDeal();
      const b = await approvedDeal();
      await expectError(
        program.methods
          .settleMilestone(0)
          .accountsPartial({
            cranker: env.stranger.publicKey,
            deal: a,
            mint: env.mint,
            vault: vaultPda(b),
            workerToken: env.ata(env.worker.publicKey),
            clientToken: null,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .signers([env.stranger])
          .rpc(),
        "ConstraintSeeds",
      );
    });

    it("close sends rent only to the deal's client", async () => {
      const { deal } = await createDeal(env, {
        milestones: [{ amount: UNIT }],
      });
      await expectError(
        program.methods
          .closeDeal()
          .accountsPartial({
            cranker: env.stranger.publicKey,
            deal,
            client: env.stranger.publicKey,
            mint: env.mint,
            vault: vaultPda(deal),
            clientToken: env.ata(env.client.publicKey),
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .signers([env.stranger])
          .rpc(),
        "ConstraintAddress",
      );
    });
  });
});
