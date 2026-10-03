use anchor_lang::prelude::*;

use crate::{constants::*, error::EscrowError, events::ProofTargetSet, state::*};

#[derive(Accounts)]
pub struct SetProofTarget<'info> {
    pub client: Signer<'info>,

    #[account(
        mut,
        has_one = client @ EscrowError::NotClient,
        seeds = [DEAL_SEED, deal.client.as_ref(), &deal.deal_id.to_le_bytes()],
        bump = deal.bump,
    )]
    pub deal: Box<Account<'info, Deal>>,
}

/// Client only, once per milestone. Links a pull request whose merge will
/// release the payment. It can only add a release path for the freelancer,
/// never remove one, so the freelancer's consent is not needed.
pub fn handle_set_proof_target(
    ctx: Context<SetProofTarget>,
    index: u8,
    proof_kind: ProofKind,
    proof_ref: u32,
) -> Result<()> {
    let deal = &mut ctx.accounts.deal;
    require!(
        matches!(deal.status, DealStatus::Open | DealStatus::Active),
        EscrowError::DealNotActive
    );
    require!(
        proof_kind == ProofKind::PrMerged
            && proof_ref > 0
            && !deal.proof_repo.is_empty()
            && deal.proofs_enabled(),
        EscrowError::InvalidProofTarget
    );
    require!(
        deal.milestones.iter().all(|m| m.proof_ref != proof_ref),
        EscrowError::DuplicateProofTarget
    );

    let m = deal.milestone_mut(index)?;
    require!(
        matches!(
            m.status,
            MilestoneStatus::Pending | MilestoneStatus::Submitted
        ),
        EscrowError::InvalidMilestoneStatus
    );
    require!(
        m.proof_kind == ProofKind::Off,
        EscrowError::ProofTargetAlreadySet
    );
    m.proof_kind = proof_kind;
    m.proof_ref = proof_ref;

    emit!(ProofTargetSet {
        deal: deal.key(),
        index,
        proof_kind,
        proof_ref,
    });
    Ok(())
}
