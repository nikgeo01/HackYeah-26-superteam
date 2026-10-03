use anchor_lang::prelude::*;
use anchor_spl::token::{
    close_account, transfer_checked, CloseAccount, Mint, Token, TokenAccount, TransferChecked,
};

use crate::{constants::*, error::EscrowError, events::DealClosed, state::*};

#[derive(Accounts)]
pub struct CloseDeal<'info> {
    /// Anyone. Pays the fee, receives nothing.
    pub cranker: Signer<'info>,

    #[account(
        mut,
        close = client,
        seeds = [DEAL_SEED, deal.client.as_ref(), &deal.deal_id.to_le_bytes()],
        bump = deal.bump,
    )]
    pub deal: Box<Account<'info, Deal>>,

    /// CHECK: only receives the rent of the closed accounts; pinned to the
    /// deal's client by the `address` constraint.
    #[account(mut, address = deal.client)]
    pub client: UncheckedAccount<'info>,

    #[account(address = deal.mint)]
    pub mint: Box<Account<'info, Mint>>,

    #[account(
        mut,
        seeds = [VAULT_SEED, deal.key().as_ref()],
        bump = deal.vault_bump,
    )]
    pub vault: Box<Account<'info, TokenAccount>>,

    /// Receives anything left in the vault (tokens someone sent there
    /// directly). Required only if the vault is not empty.
    #[account(
        mut,
        token::mint = mint,
        token::authority = deal.client,
        token::token_program = token_program,
    )]
    pub client_token: Option<Box<Account<'info, TokenAccount>>>,

    pub token_program: Program<'info, Token>,
}

/// Anyone, once every milestone is settled. Sweeps any leftover tokens to the
/// client, closes the vault and the deal, and returns all rent to the client.
pub fn handle_close_deal(ctx: Context<CloseDeal>) -> Result<()> {
    let deal = &ctx.accounts.deal;
    require!(
        usize::from(deal.settled_count) == deal.milestones.len(),
        EscrowError::DealNotFullySettled
    );

    let client = deal.client;
    let deal_id = deal.deal_id.to_le_bytes();
    let signer_seeds: &[&[&[u8]]] = &[&[DEAL_SEED, client.as_ref(), &deal_id, &[deal.bump]]];

    let remainder = ctx.accounts.vault.amount;
    if remainder > 0 {
        let to = ctx
            .accounts
            .client_token
            .as_ref()
            .ok_or(EscrowError::MissingRecipientAccount)?;
        transfer_checked(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.key(),
                TransferChecked {
                    from: ctx.accounts.vault.to_account_info(),
                    mint: ctx.accounts.mint.to_account_info(),
                    to: to.to_account_info(),
                    authority: ctx.accounts.deal.to_account_info(),
                },
                signer_seeds,
            ),
            remainder,
            ctx.accounts.mint.decimals,
        )?;
    }

    close_account(CpiContext::new_with_signer(
        ctx.accounts.token_program.key(),
        CloseAccount {
            account: ctx.accounts.vault.to_account_info(),
            destination: ctx.accounts.client.to_account_info(),
            authority: ctx.accounts.deal.to_account_info(),
        },
        signer_seeds,
    ))?;

    emit!(DealClosed {
        deal: ctx.accounts.deal.key(),
    });
    Ok(())
}
