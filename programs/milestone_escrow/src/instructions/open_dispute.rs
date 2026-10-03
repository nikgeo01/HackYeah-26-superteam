use anchor_lang::prelude::*;
use anchor_spl::token::{transfer_checked, Mint, Token, TokenAccount, TransferChecked};

use crate::{constants::*, error::EscrowError, events::DisputeOpened, state::*};

#[derive(Accounts)]
pub struct OpenDispute<'info> {
    pub client: Signer<'info>,

    #[account(
        mut,
        has_one = client @ EscrowError::NotClient,
        seeds = [DEAL_SEED, deal.client.as_ref(), &deal.deal_id.to_le_bytes()],
        bump = deal.bump,
    )]
    pub deal: Box<Account<'info, Deal>>,

    #[account(address = deal.mint)]
    pub mint: Box<Account<'info, Mint>>,

    #[account(
        mut,
        seeds = [VAULT_SEED, deal.key().as_ref()],
        bump = deal.vault_bump,
    )]
    pub vault: Box<Account<'info, TokenAccount>>,

    #[account(
        mut,
        token::mint = mint,
        token::authority = client,
        token::token_program = token_program,
    )]
    pub client_token: Box<Account<'info, TokenAccount>>,

    pub token_program: Program<'info, Token>,
}

/// Client only, while the review window is open. Objecting costs the deal's
/// dispute deposit, which is locked in the vault: it goes to the freelancer if
/// the arbiters side with them, and back to the client otherwise. Starts the
/// arbiters' voting window.
pub fn handle_open_dispute(ctx: Context<OpenDispute>, index: u8) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let deposit = ctx.accounts.deal.dispute_deposit;
    let vote_window = ctx.accounts.deal.vote_window_secs;

    let deal = &mut ctx.accounts.deal;
    require!(
        deal.status == DealStatus::Active,
        EscrowError::DealNotActive
    );
    let m = deal.milestone_mut(index)?;
    require!(
        m.status == MilestoneStatus::Submitted,
        EscrowError::InvalidMilestoneStatus
    );
    require!(now < m.review_deadline, EscrowError::ReviewWindowClosed);

    m.status = MilestoneStatus::Disputed;
    m.vote_deadline = deadline_after(now, vote_window)?;
    m.deposit_locked = deposit;
    let vote_deadline = m.vote_deadline;

    if deposit > 0 {
        transfer_checked(
            CpiContext::new(
                ctx.accounts.token_program.key(),
                TransferChecked {
                    from: ctx.accounts.client_token.to_account_info(),
                    mint: ctx.accounts.mint.to_account_info(),
                    to: ctx.accounts.vault.to_account_info(),
                    authority: ctx.accounts.client.to_account_info(),
                },
            ),
            deposit,
            ctx.accounts.mint.decimals,
        )?;
    }

    emit!(DisputeOpened {
        deal: ctx.accounts.deal.key(),
        index,
        deposit,
        vote_deadline,
    });
    Ok(())
}
