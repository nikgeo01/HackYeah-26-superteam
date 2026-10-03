use anchor_lang::prelude::*;
use anchor_spl::token::{transfer_checked, Mint, Token, TokenAccount, TransferChecked};

use crate::{constants::*, error::EscrowError, events::DealCreated, state::*};

/// Terms of one milestone as proposed by the client.
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct MilestoneInput {
    pub amount: u64,
    pub due_secs: u32,
    pub proof_kind: ProofKind,
    pub proof_ref: u32,
}

/// Everything the client fixes when creating a deal. None of it can change
/// afterwards, except a one-time pull request binding (`set_proof_target`).
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct CreateDealArgs {
    pub deal_id: u64,
    pub worker: Pubkey,
    pub judges: [Pubkey; 3],
    pub accept_window_secs: u32,
    pub review_window_secs: u32,
    pub vote_window_secs: u32,
    pub dispute_deposit: u64,
    pub proof_attestor: [u8; 20],
    pub proof_repo: String,
    pub milestones: Vec<MilestoneInput>,
}

#[derive(Accounts)]
#[instruction(args: CreateDealArgs)]
pub struct CreateDeal<'info> {
    #[account(mut)]
    pub client: Signer<'info>,

    #[account(
        init,
        payer = client,
        space = ANCHOR_DISCRIMINATOR + Deal::INIT_SPACE,
        seeds = [DEAL_SEED, client.key().as_ref(), &args.deal_id.to_le_bytes()],
        bump,
    )]
    pub deal: Box<Account<'info, Deal>>,

    pub mint: Box<Account<'info, Mint>>,

    /// Owned by the deal PDA, so only this program can move the escrow out.
    #[account(
        init,
        payer = client,
        seeds = [VAULT_SEED, deal.key().as_ref()],
        bump,
        token::mint = mint,
        token::authority = deal,
        token::token_program = token_program,
    )]
    pub vault: Box<Account<'info, TokenAccount>>,

    /// Where the escrow comes from; must belong to the signing client.
    #[account(
        mut,
        token::mint = mint,
        token::authority = client,
        token::token_program = token_program,
    )]
    pub client_token: Box<Account<'info, TokenAccount>>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

/// Client only. Creates the deal and moves the full escrow (the sum of all
/// milestones) into the vault. The deal waits for the freelancer to accept
/// until `accept_deadline`.
pub fn handle_create_deal(ctx: Context<CreateDeal>, args: CreateDealArgs) -> Result<()> {
    let client = ctx.accounts.client.key();
    let total = validate(&args, client)?;
    let now = Clock::get()?.unix_timestamp;

    let milestones = args
        .milestones
        .iter()
        .map(|m| Milestone {
            amount: m.amount,
            status: MilestoneStatus::Pending,
            outcome: Outcome::Unset,
            proof_kind: m.proof_kind,
            votes: [VOTE_NONE; 3],
            proof_ref: m.proof_ref,
            due_secs: m.due_secs,
            submit_deadline: 0,
            submitted_at: 0,
            review_deadline: 0,
            vote_deadline: 0,
            deposit_locked: 0,
            deliverable_hash: [0u8; 32],
        })
        .collect();

    ctx.accounts.deal.set_inner(Deal {
        client,
        worker: args.worker,
        judges: args.judges,
        mint: ctx.accounts.mint.key(),
        deal_id: args.deal_id,
        status: DealStatus::Open,
        bump: ctx.bumps.deal,
        vault_bump: ctx.bumps.vault,
        cancel_flags: 0,
        settled_count: 0,
        created_at: now,
        accept_deadline: deadline_after(now, args.accept_window_secs)?,
        accepted_at: 0,
        review_window_secs: args.review_window_secs,
        vote_window_secs: args.vote_window_secs,
        dispute_deposit: args.dispute_deposit,
        proof_attestor: args.proof_attestor,
        reserved: [0u8; 12],
        proof_repo: args.proof_repo.clone(),
        milestones,
    });

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
        total,
        ctx.accounts.mint.decimals,
    )?;

    emit!(DealCreated {
        deal: ctx.accounts.deal.key(),
        client,
        worker: args.worker,
        mint: ctx.accounts.mint.key(),
        total,
        milestone_count: args.milestones.len() as u8,
    });
    Ok(())
}

/// Checks every term and returns the total escrow amount.
fn validate(args: &CreateDealArgs, client: Pubkey) -> Result<u64> {
    require!(
        (1..=MAX_MILESTONES).contains(&args.milestones.len()),
        EscrowError::InvalidMilestoneCount
    );

    let mut total: u64 = 0;
    for m in &args.milestones {
        require!(m.amount > 0, EscrowError::ZeroAmount);
        total = total
            .checked_add(m.amount)
            .ok_or(EscrowError::MathOverflow)?;
    }

    let windows = [
        args.accept_window_secs,
        args.review_window_secs,
        args.vote_window_secs,
    ];
    let in_bounds = |w: &u32| (MIN_WINDOW_SECS..=MAX_WINDOW_SECS).contains(w);
    require!(
        windows.iter().all(in_bounds) && args.milestones.iter().all(|m| in_bounds(&m.due_secs)),
        EscrowError::WindowOutOfBounds
    );

    // Nobody may hold two roles: a party who is also an arbiter controls a vote.
    let people = [
        client,
        args.worker,
        args.judges[0],
        args.judges[1],
        args.judges[2],
    ];
    for i in 0..people.len() {
        for j in (i + 1)..people.len() {
            require_keys_neq!(people[i], people[j], EscrowError::DuplicateParty);
        }
    }

    require!(is_valid_repo(&args.proof_repo), EscrowError::InvalidRepo);

    let proofs_enabled = args.proof_attestor != [0u8; 20];
    for m in &args.milestones {
        match m.proof_kind {
            ProofKind::Off => require!(m.proof_ref == 0, EscrowError::InvalidProofTarget),
            ProofKind::PrMerged => require!(
                m.proof_ref > 0 && !args.proof_repo.is_empty() && proofs_enabled,
                EscrowError::InvalidProofTarget
            ),
            ProofKind::CheckRun => return err!(EscrowError::InvalidProofTarget),
        }
    }

    let refs: Vec<u32> = args
        .milestones
        .iter()
        .map(|m| m.proof_ref)
        .filter(|r| *r != 0)
        .collect();
    for i in 0..refs.len() {
        for j in (i + 1)..refs.len() {
            require!(refs[i] != refs[j], EscrowError::DuplicateProofTarget);
        }
    }

    Ok(total)
}

/// Empty, or `owner/name` with exactly one slash and only `[A-Za-z0-9._-]`.
pub fn is_valid_repo(repo: &str) -> bool {
    if repo.is_empty() {
        return true;
    }
    if repo.len() > MAX_REPO_LEN {
        return false;
    }
    let mut parts = repo.split('/');
    let (Some(owner), Some(name), None) = (parts.next(), parts.next(), parts.next()) else {
        return false;
    };
    let ok = |s: &str| {
        !s.is_empty()
            && s.bytes()
                .all(|b| b.is_ascii_alphanumeric() || matches!(b, b'.' | b'_' | b'-'))
    };
    ok(owner) && ok(name)
}

#[cfg(test)]
mod tests {
    use super::is_valid_repo;

    #[test]
    fn repo_validation() {
        assert!(is_valid_repo(""));
        assert!(is_valid_repo("nikgeo01/kept-demo"));
        assert!(is_valid_repo("a.b/c_d-e"));
        assert!(!is_valid_repo("no-slash"));
        assert!(!is_valid_repo("a/b/c"));
        assert!(!is_valid_repo("/b"));
        assert!(!is_valid_repo("a/"));
        assert!(!is_valid_repo("a/b\"c"));
        assert!(!is_valid_repo(&format!("a/{}", "x".repeat(80))));
    }
}
