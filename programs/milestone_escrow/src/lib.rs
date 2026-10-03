//! Milestone escrow between a client and a freelancer.
//!
//! The client locks the full payment in a vault owned by this program. The
//! freelancer delivers milestone by milestone. A milestone is paid when the
//! client approves it, when the client stays silent past the review window,
//! when a verified proof shows the agreed pull request was merged, or when two
//! of three arbiters side with the freelancer. There is no admin, no fee and
//! no pause: every outcome follows from the rules in `decide_outcome`.

pub mod constants;
pub mod error;
pub mod events;
pub mod instructions;
pub mod proof;
pub mod state;

use anchor_lang::prelude::*;

pub use constants::*;
pub use instructions::*;
pub use proof::generated::*;
pub use state::*;

declare_id!("A8JXDe5Fy9fvBGMZoQhzEbTF8KVpiwtvnQYJHkzM4Qer");

#[program]
pub mod milestone_escrow {
    use super::*;

    pub fn create_deal(ctx: Context<CreateDeal>, args: CreateDealArgs) -> Result<()> {
        instructions::create_deal::handle_create_deal(ctx, args)
    }

    pub fn accept_deal(ctx: Context<AcceptDeal>) -> Result<()> {
        instructions::accept_deal::handle_accept_deal(ctx)
    }

    pub fn submit_work(
        ctx: Context<SubmitWork>,
        index: u8,
        deliverable_hash: [u8; 32],
        uri: String,
    ) -> Result<()> {
        instructions::submit_work::handle_submit_work(ctx, index, deliverable_hash, uri)
    }

    pub fn approve_milestone(ctx: Context<ApproveMilestone>, index: u8) -> Result<()> {
        instructions::approve_milestone::handle_approve_milestone(ctx, index)
    }

    pub fn open_dispute(ctx: Context<OpenDispute>, index: u8) -> Result<()> {
        instructions::open_dispute::handle_open_dispute(ctx, index)
    }

    pub fn cast_vote(ctx: Context<CastVote>, index: u8, side: Side) -> Result<()> {
        instructions::cast_vote::handle_cast_vote(ctx, index, side)
    }

    pub fn set_proof_target(
        ctx: Context<SetProofTarget>,
        index: u8,
        proof_kind: ProofKind,
        proof_ref: u32,
    ) -> Result<()> {
        instructions::set_proof_target::handle_set_proof_target(ctx, index, proof_kind, proof_ref)
    }

    pub fn submit_proof(ctx: Context<SubmitProof>, index: u8, proof: ProofArgs) -> Result<()> {
        instructions::submit_proof::handle_submit_proof(ctx, index, proof)
    }

    pub fn cancel_deal(ctx: Context<CancelDeal>, agree: bool) -> Result<()> {
        instructions::cancel_deal::handle_cancel_deal(ctx, agree)
    }

    pub fn settle_milestone(ctx: Context<SettleMilestone>, index: u8) -> Result<()> {
        instructions::settle_milestone::handle_settle_milestone(ctx, index)
    }

    pub fn close_deal(ctx: Context<CloseDeal>) -> Result<()> {
        instructions::close_deal::handle_close_deal(ctx)
    }
}
