use anchor_lang::prelude::*;

use crate::{constants::*, error::EscrowError, events::DealAccepted, state::*};

#[derive(Accounts)]
pub struct AcceptDeal<'info> {
    pub worker: Signer<'info>,

    #[account(
        mut,
        has_one = worker @ EscrowError::NotWorker,
        seeds = [DEAL_SEED, deal.client.as_ref(), &deal.deal_id.to_le_bytes()],
        bump = deal.bump,
    )]
    pub deal: Box<Account<'info, Deal>>,
}

/// Freelancer only, before `accept_deadline`. Accepting means agreeing to
/// every term, including the arbiters. Each milestone's delivery deadline
/// starts counting from now.
pub fn handle_accept_deal(ctx: Context<AcceptDeal>) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let deal = &mut ctx.accounts.deal;

    require!(deal.status == DealStatus::Open, EscrowError::DealNotOpen);
    require!(now < deal.accept_deadline, EscrowError::AcceptWindowClosed);

    deal.status = DealStatus::Active;
    deal.accepted_at = now;
    for m in deal.milestones.iter_mut() {
        m.submit_deadline = deadline_after(now, m.due_secs)?;
    }

    emit!(DealAccepted {
        deal: deal.key(),
        accepted_at: now,
    });
    Ok(())
}
