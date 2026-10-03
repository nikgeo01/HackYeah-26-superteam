// The TypeScript mirror of `decide_outcome` must agree with the program. These
// cases are the same rows as the Rust unit tests in settle_milestone.rs.
import { expect } from "chai";
import {
  VOTE_CLIENT,
  VOTE_NONE,
  VOTE_WORKER,
  decideOutcome,
  type MilestoneView,
} from "../client/rules.ts";

const base: MilestoneView = {
  amount: 101n,
  depositLocked: 0n,
  status: "submitted",
  votes: [VOTE_NONE, VOTE_NONE, VOTE_NONE],
  submitDeadline: 100,
  reviewDeadline: 200,
  voteDeadline: 300,
};
const disputed = (votes: number[]): MilestoneView => ({
  ...base,
  status: "disputed",
  depositLocked: 20n,
  votes,
});

describe("client/rules.ts mirrors decide_outcome", () => {
  it("row 1: settled", () => {
    expect(decideOutcome("active", { ...base, status: "settled" }, 0)).to.equal(
      null,
    );
  });
  it("row 2: approved beats cancel", () => {
    const m: MilestoneView = {
      ...base,
      status: "approved",
      depositLocked: 20n,
    };
    expect(decideOutcome("cancelled", m, 0)).to.deep.equal({
      toWorker: 121n,
      toClient: 0n,
      outcome: "workerPaid",
    });
  });
  it("rows 3a/3b: majority beats cancel", () => {
    expect(
      decideOutcome("cancelled", disputed([VOTE_WORKER, 0, VOTE_WORKER]), 0)
        ?.outcome,
    ).to.equal("workerPaid");
    expect(
      decideOutcome("active", disputed([VOTE_CLIENT, VOTE_CLIENT, 0]), 0)
        ?.toClient,
    ).to.equal(121n);
  });
  it("row 4: cancel refunds undecided", () => {
    expect(decideOutcome("cancelled", base, 0)?.outcome).to.equal("cancelled");
  });
  it("row 5: split after the vote deadline", () => {
    const m = disputed([VOTE_WORKER, VOTE_CLIENT, 0]);
    expect(decideOutcome("active", m, 299)).to.equal(null);
    expect(decideOutcome("active", m, 300)).to.deep.equal({
      toWorker: 51n,
      toClient: 70n,
      outcome: "split",
    });
  });
  it("row 6: silence pays", () => {
    expect(decideOutcome("active", base, 199)).to.equal(null);
    expect(decideOutcome("active", base, 200)?.toWorker).to.equal(101n);
  });
  it("row 7: missed delivery refunds", () => {
    const m: MilestoneView = { ...base, status: "pending" };
    expect(decideOutcome("open", m, 1_000)).to.equal(null);
    expect(decideOutcome("active", m, 100)?.outcome).to.equal("clientRefunded");
  });
});
