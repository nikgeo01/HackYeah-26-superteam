use anchor_lang::prelude::*;

use crate::{constants::*, error::EscrowError, events::MilestoneApproved, state::*};

#[derive(Accounts)]
pub struct ApproveMilestone<'info> {
    pub client: Signer<'info>,

    #[account(
        mut,
        has_one = client @ EscrowError::NotClient,
        seeds = [DEAL_SEED, deal.client.as_ref(), &deal.deal_id.to_le_bytes()],
        bump = deal.bump,
    )]
    pub deal: Box<Account<'info, Deal>>,
}

/// Client only. Approves delivered work. From a dispute this is a concession:
/// the freelancer is paid and also receives the locked deposit. It is allowed
/// even after the arbiters decided, because it can only favour the freelancer.
/// Payment itself happens in `settle_milestone`.
pub fn handle_approve_milestone(ctx: Context<ApproveMilestone>, index: u8) -> Result<()> {
    let deal = &mut ctx.accounts.deal;
    require!(
        deal.status == DealStatus::Active,
        EscrowError::DealNotActive
    );

    let m = deal.milestone_mut(index)?;
    require!(
        matches!(
            m.status,
            MilestoneStatus::Submitted | MilestoneStatus::Disputed
        ),
        EscrowError::InvalidMilestoneStatus
    );
    m.status = MilestoneStatus::Approved;

    emit!(MilestoneApproved {
        deal: deal.key(),
        index,
    });
    Ok(())
}
