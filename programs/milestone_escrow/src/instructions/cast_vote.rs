use anchor_lang::prelude::*;

use crate::{constants::*, error::EscrowError, events::VoteCast, state::*};

#[derive(Accounts)]
pub struct CastVote<'info> {
    pub judge: Signer<'info>,

    #[account(
        mut,
        seeds = [DEAL_SEED, deal.client.as_ref(), &deal.deal_id.to_le_bytes()],
        bump = deal.bump,
    )]
    pub deal: Box<Account<'info, Deal>>,
}

/// One of the deal's three arbiters, once, before the voting deadline and
/// before a majority exists. Two matching votes decide the milestone; the
/// payout then happens in `settle_milestone`. Arbiters never receive funds.
pub fn handle_cast_vote(ctx: Context<CastVote>, index: u8, side: Side) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let judge = ctx.accounts.judge.key();
    let deal = &mut ctx.accounts.deal;

    let slot = deal
        .judges
        .iter()
        .position(|j| *j == judge)
        .ok_or(EscrowError::NotJudge)?;
    require!(
        deal.status == DealStatus::Active,
        EscrowError::DealNotActive
    );

    let m = deal.milestone_mut(index)?;
    require!(
        m.status == MilestoneStatus::Disputed,
        EscrowError::InvalidMilestoneStatus
    );
    require!(now < m.vote_deadline, EscrowError::VoteWindowClosed);
    require!(!m.has_majority(), EscrowError::AlreadyDecided);
    require!(m.votes[slot] == VOTE_NONE, EscrowError::AlreadyVoted);

    m.votes[slot] = side.as_vote();
    let (worker_votes, client_votes, decided) =
        (m.worker_votes(), m.client_votes(), m.has_majority());

    emit!(VoteCast {
        deal: deal.key(),
        index,
        judge,
        side,
        worker_votes,
        client_votes,
        decided,
    });
    Ok(())
}
