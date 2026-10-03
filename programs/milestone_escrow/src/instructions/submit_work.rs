use anchor_lang::prelude::*;

use crate::{constants::*, error::EscrowError, events::WorkSubmitted, state::*};

#[derive(Accounts)]
pub struct SubmitWork<'info> {
    pub worker: Signer<'info>,

    #[account(
        mut,
        has_one = worker @ EscrowError::NotWorker,
        seeds = [DEAL_SEED, deal.client.as_ref(), &deal.deal_id.to_le_bytes()],
        bump = deal.bump,
    )]
    pub deal: Box<Account<'info, Deal>>,
}

/// Freelancer only, before the milestone's delivery deadline. Records a hash
/// of the deliverable and starts the client's review window. If the client
/// stays silent until it ends, anyone can release the payment.
pub fn handle_submit_work(
    ctx: Context<SubmitWork>,
    index: u8,
    deliverable_hash: [u8; 32],
    uri: String,
) -> Result<()> {
    require!(uri.len() <= MAX_URI_LEN, EscrowError::UriTooLong);
    let now = Clock::get()?.unix_timestamp;
    let deal = &mut ctx.accounts.deal;
    require!(
        deal.status == DealStatus::Active,
        EscrowError::DealNotActive
    );

    let review_window = deal.review_window_secs;
    let m = deal.milestone_mut(index)?;
    require!(
        m.status == MilestoneStatus::Pending,
        EscrowError::InvalidMilestoneStatus
    );
    require!(now < m.submit_deadline, EscrowError::SubmitWindowClosed);

    m.status = MilestoneStatus::Submitted;
    m.deliverable_hash = deliverable_hash;
    m.submitted_at = now;
    m.review_deadline = deadline_after(now, review_window)?;
    let review_deadline = m.review_deadline;

    // Delivering work withdraws a pending cancel request, so an old request
    // cannot later be used to refund work that was delivered.
    deal.cancel_flags &= !CANCEL_FLAG_WORKER;

    emit!(WorkSubmitted {
        deal: deal.key(),
        index,
        deliverable_hash,
        uri,
        review_deadline,
    });
    Ok(())
}
