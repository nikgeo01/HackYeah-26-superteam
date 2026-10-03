use anchor_lang::prelude::*;

use crate::{
    constants::*,
    error::EscrowError,
    events::ProofVerified,
    proof::{self, verify},
    state::*,
};

/// A signed attestation, exactly as produced by the attestor.
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct ProofArgs {
    /// The signed context JSON, byte for byte. At most 512 bytes.
    pub context: String,
    pub identifier: [u8; 32],
    /// `"0x"` + 40 lowercase hex characters, as signed.
    pub owner: String,
    pub timestamp_s: u32,
    pub epoch: u32,
    /// r || s || v
    pub signature: [u8; 65],
}

#[derive(Accounts)]
pub struct SubmitProof<'info> {
    /// Anyone. Pays the fee, receives nothing.
    pub submitter: Signer<'info>,

    #[account(
        mut,
        seeds = [DEAL_SEED, deal.client.as_ref(), &deal.deal_id.to_le_bytes()],
        bump = deal.bump,
    )]
    pub deal: Box<Account<'info, Deal>>,
}

/// Anyone. Approves a milestone when the attestor both parties accepted signed
/// that GitHub reports the agreed pull request as merged, for this deal and
/// milestone. Not allowed once the arbiters reached a majority. Payment then
/// happens in `settle_milestone`.
pub fn handle_submit_proof(ctx: Context<SubmitProof>, index: u8, proof: ProofArgs) -> Result<()> {
    let deal_key = ctx.accounts.deal.key();
    let deal = &mut ctx.accounts.deal;
    require!(
        deal.status == DealStatus::Active,
        EscrowError::DealNotActive
    );

    let attestor = deal.proof_attestor;
    let repo = deal.proof_repo.clone();
    let m = deal.milestone_mut(index)?;
    require!(
        matches!(
            m.status,
            MilestoneStatus::Pending | MilestoneStatus::Submitted | MilestoneStatus::Disputed
        ),
        EscrowError::InvalidMilestoneStatus
    );
    require!(!m.has_majority(), EscrowError::AlreadyDecided);
    require!(
        m.proof_kind == ProofKind::PrMerged && attestor != [0u8; 20],
        EscrowError::NoProofTarget
    );

    require!(
        proof.context.len() <= MAX_CONTEXT_LEN
            && proof.owner.len() == PROOF_OWNER_LEN
            && proof.owner.starts_with("0x")
            && !proof.owner.bytes().any(|b| b.is_ascii_uppercase()),
        EscrowError::ProofMalformed
    );

    // The claim must be about exactly the agreed repository and pull request.
    let parameters = proof::expected_parameters(&repo, m.proof_ref);
    require!(
        proof::claim_identifier(&parameters, &proof.context) == proof.identifier,
        EscrowError::ProofIdentifierMismatch
    );

    // ...made for this deal and this milestone, so it cannot be replayed.
    require!(
        proof
            .context
            .contains(&proof::binding_needle(&deal_key.to_bytes(), index)),
        EscrowError::ProofContextMismatch
    );

    // ...and signed by the attestor fixed in the deal.
    let message = verify::signed_message(
        &proof.identifier,
        &proof.owner,
        proof.timestamp_s,
        proof.epoch,
    );
    let signer = verify::recover_address(&verify::personal_sign_digest(&message), &proof.signature)
        .ok_or(EscrowError::ProofSignatureInvalid)?;
    require!(signer == attestor, EscrowError::ProofAttestorMismatch);

    m.status = MilestoneStatus::Approved;

    emit!(ProofVerified {
        deal: deal_key,
        index,
        identifier: proof.identifier,
        submitter: ctx.accounts.submitter.key(),
    });
    Ok(())
}
