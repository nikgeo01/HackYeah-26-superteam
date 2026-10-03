use anchor_lang::prelude::*;

use crate::state::{Outcome, ProofKind, Side};

#[event]
pub struct DealCreated {
    pub deal: Pubkey,
    pub client: Pubkey,
    pub worker: Pubkey,
    pub mint: Pubkey,
    pub total: u64,
    pub milestone_count: u8,
}

#[event]
pub struct DealAccepted {
    pub deal: Pubkey,
    pub accepted_at: i64,
}

#[event]
pub struct WorkSubmitted {
    pub deal: Pubkey,
    pub index: u8,
    pub deliverable_hash: [u8; 32],
    pub uri: String,
    pub review_deadline: i64,
}

#[event]
pub struct MilestoneApproved {
    pub deal: Pubkey,
    pub index: u8,
}

#[event]
pub struct DisputeOpened {
    pub deal: Pubkey,
    pub index: u8,
    pub deposit: u64,
    pub vote_deadline: i64,
}

#[event]
pub struct VoteCast {
    pub deal: Pubkey,
    pub index: u8,
    pub judge: Pubkey,
    pub side: Side,
    pub worker_votes: u8,
    pub client_votes: u8,
    pub decided: bool,
}

#[event]
pub struct ProofTargetSet {
    pub deal: Pubkey,
    pub index: u8,
    pub proof_kind: ProofKind,
    pub proof_ref: u32,
}

#[event]
pub struct ProofVerified {
    pub deal: Pubkey,
    pub index: u8,
    pub identifier: [u8; 32],
    pub submitter: Pubkey,
}

#[event]
pub struct CancelRequested {
    pub deal: Pubkey,
    pub by: Pubkey,
    pub agree: bool,
}

#[event]
pub struct DealCancelled {
    pub deal: Pubkey,
}

#[event]
pub struct MilestoneSettled {
    pub deal: Pubkey,
    pub index: u8,
    pub outcome: Outcome,
    pub to_worker: u64,
    pub to_client: u64,
    pub cranker: Pubkey,
}

#[event]
pub struct DealClosed {
    pub deal: Pubkey,
}
