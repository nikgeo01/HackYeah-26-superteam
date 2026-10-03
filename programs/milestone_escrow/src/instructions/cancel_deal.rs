use anchor_lang::prelude::*;

use crate::{
    constants::*,
    error::EscrowError,
    events::{CancelRequested, DealCancelled},
    state::*,
};

#[derive(Accounts)]
pub struct CancelDeal<'info> {
    pub signer: Signer<'info>,

    #[account(
        mut,
        seeds = [DEAL_SEED, deal.client.as_ref(), &deal.deal_id.to_le_bytes()],
        bump = deal.bump,
    )]
    pub deal: Box<Account<'info, Deal>>,
}

/// Before acceptance: the client may cancel at any time, and anyone may once
/// the acceptance window is over. After acceptance: both parties must agree;
/// each sets (`agree = true`) or withdraws (`agree = false`) their own
/// request, and the deal is cancelled the moment both requests stand.
/// Cancelling never overrides a recorded verdict (see `decide_outcome`).
pub fn handle_cancel_deal(ctx: Context<CancelDeal>, agree: bool) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let signer = ctx.accounts.signer.key();
    let deal = &mut ctx.accounts.deal;
    let deal_key = deal.key();

    match deal.status {
        DealStatus::Open => {
            require!(agree, EscrowError::InvalidCancelArgument);
            require!(
                signer == deal.client || now >= deal.accept_deadline,
                EscrowError::NotParty
            );
            deal.status = DealStatus::Cancelled;
            emit!(DealCancelled { deal: deal_key });
        }
        DealStatus::Active => {
            let flag = if signer == deal.client {
                CANCEL_FLAG_CLIENT
            } else if signer == deal.worker {
                CANCEL_FLAG_WORKER
            } else {
                return err!(EscrowError::NotParty);
            };
            if agree {
                deal.cancel_flags |= flag;
            } else {
                deal.cancel_flags &= !flag;
            }
            emit!(CancelRequested {
                deal: deal_key,
                by: signer,
                agree,
            });
            if deal.cancel_flags == CANCEL_FLAG_CLIENT | CANCEL_FLAG_WORKER {
                deal.status = DealStatus::Cancelled;
                emit!(DealCancelled { deal: deal_key });
            }
        }
        DealStatus::Cancelled => return err!(EscrowError::DealNotCancellable),
    }
    Ok(())
}
