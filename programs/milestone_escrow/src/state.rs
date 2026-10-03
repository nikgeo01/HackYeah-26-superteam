use anchor_lang::prelude::*;

use crate::{constants::*, error::EscrowError};

/// Lifecycle of a whole deal.
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug, InitSpace)]
pub enum DealStatus {
    /// Funded by the client, waiting for the freelancer to accept.
    Open,
    /// Accepted; milestones are being delivered.
    Active,
    /// Cancelled; every undecided milestone refunds the client.
    Cancelled,
}

/// Lifecycle of one milestone.
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug, InitSpace)]
pub enum MilestoneStatus {
    Pending,
    Submitted,
    Disputed,
    Approved,
    Settled,
}

/// How a settled milestone was paid out.
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug, InitSpace)]
pub enum Outcome {
    Unset,
    WorkerPaid,
    ClientRefunded,
    Split,
    Cancelled,
}

/// Objective condition that can release a milestone without the client.
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug, InitSpace)]
pub enum ProofKind {
    Off,
    PrMerged,
    /// Reserved; rejected in v1.
    CheckRun,
}

/// Which side an arbiter votes for.
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug, InitSpace)]
pub enum Side {
    Worker,
    Client,
}

impl Side {
    /// Stored vote value. `Side::Worker` is 0 as an enum, which would collide
    /// with `VOTE_NONE`, so the mapping is explicit.
    pub fn as_vote(self) -> u8 {
        match self {
            Side::Worker => VOTE_WORKER,
            Side::Client => VOTE_CLIENT,
        }
    }
}

/// One deal between a client and a freelancer.
///
/// The header fields up to `proof_repo` have fixed offsets (noted on each
/// field) so clients can filter deals by party with `memcmp`. Never put an
/// `Option`, `Vec` or `String` before `proof_repo`.
///
/// The account is also the authority of the vault token account, so escrowed
/// tokens can only move in a transaction this program signs for.
#[account]
#[derive(InitSpace, Debug)]
pub struct Deal {
    /// offset 8
    pub client: Pubkey,
    /// offset 40
    pub worker: Pubkey,
    /// offsets 72, 104, 136: client's pick, worker's pick, mutually agreed.
    pub judges: [Pubkey; 3],
    /// offset 168
    pub mint: Pubkey,
    /// offset 200
    pub deal_id: u64,
    /// offset 208
    pub status: DealStatus,
    /// offset 209
    pub bump: u8,
    /// offset 210
    pub vault_bump: u8,
    /// offset 211: `CANCEL_FLAG_CLIENT | CANCEL_FLAG_WORKER`.
    pub cancel_flags: u8,
    /// offset 212
    pub settled_count: u8,
    /// offset 213
    pub created_at: i64,
    /// offset 221
    pub accept_deadline: i64,
    /// offset 229 (0 until accepted)
    pub accepted_at: i64,
    /// offset 237
    pub review_window_secs: u32,
    /// offset 241
    pub vote_window_secs: u32,
    /// offset 245
    pub dispute_deposit: u64,
    /// offset 253: Ethereum-style address of the attestor both parties accept
    /// for proofs. All zero disables proofs.
    pub proof_attestor: [u8; 20],
    /// offset 273
    pub reserved: [u8; 12],
    /// offset 285: `"owner/name"` or empty.
    #[max_len(80)]
    pub proof_repo: String,
    #[max_len(5)]
    pub milestones: Vec<Milestone>,
}

/// One payable piece of work inside a deal.
#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq, Debug, InitSpace)]
pub struct Milestone {
    pub amount: u64,
    pub status: MilestoneStatus,
    pub outcome: Outcome,
    pub proof_kind: ProofKind,
    /// Index-aligned with `Deal::judges`; `VOTE_NONE`, `VOTE_WORKER`, `VOTE_CLIENT`.
    pub votes: [u8; 3],
    /// Pull request number (0 = none).
    pub proof_ref: u32,
    /// Delivery deadline, relative to acceptance.
    pub due_secs: u32,
    pub submit_deadline: i64,
    pub submitted_at: i64,
    pub review_deadline: i64,
    pub vote_deadline: i64,
    pub deposit_locked: u64,
    pub deliverable_hash: [u8; 32],
}

impl Milestone {
    pub fn worker_votes(&self) -> u8 {
        self.votes.iter().filter(|v| **v == VOTE_WORKER).count() as u8
    }

    pub fn client_votes(&self) -> u8 {
        self.votes.iter().filter(|v| **v == VOTE_CLIENT).count() as u8
    }

    /// Two matching votes decide a dispute.
    pub fn has_majority(&self) -> bool {
        self.worker_votes() >= 2 || self.client_votes() >= 2
    }
}

impl Deal {
    pub fn milestone(&self, index: u8) -> Result<&Milestone> {
        self.milestones
            .get(usize::from(index))
            .ok_or_else(|| error!(EscrowError::InvalidMilestoneIndex))
    }

    pub fn milestone_mut(&mut self, index: u8) -> Result<&mut Milestone> {
        self.milestones
            .get_mut(usize::from(index))
            .ok_or_else(|| error!(EscrowError::InvalidMilestoneIndex))
    }

    pub fn proofs_enabled(&self) -> bool {
        self.proof_attestor != [0u8; 20]
    }
}

/// `now + window`, failing instead of wrapping.
pub fn deadline_after(now: i64, window_secs: u32) -> Result<i64> {
    now.checked_add(i64::from(window_secs))
        .ok_or_else(|| error!(EscrowError::MathOverflow))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample_deal() -> Deal {
        let key = |b: u8| Pubkey::new_from_array([b; 32]);
        Deal {
            client: key(1),
            worker: key(2),
            judges: [key(3), key(4), key(5)],
            mint: key(6),
            deal_id: 0x0102_0304_0506_0708,
            status: DealStatus::Open,
            bump: 0xAA,
            vault_bump: 0xBB,
            cancel_flags: 0,
            settled_count: 0,
            created_at: 7,
            accept_deadline: 8,
            accepted_at: 9,
            review_window_secs: 10,
            vote_window_secs: 11,
            dispute_deposit: 12,
            proof_attestor: [0xCC; 20],
            reserved: [0; 12],
            proof_repo: "a/b".to_string(),
            milestones: vec![],
        }
    }

    #[test]
    fn allocated_size_is_843() {
        assert_eq!(ANCHOR_DISCRIMINATOR + Deal::INIT_SPACE, 843);
        assert_eq!(Milestone::INIT_SPACE, 94);
    }

    /// The frontend filters deals by party with `memcmp` at these offsets.
    #[test]
    fn header_offsets_are_stable() {
        let deal = sample_deal();
        let mut data = vec![0u8; ANCHOR_DISCRIMINATOR];
        deal.serialize(&mut data).unwrap();
        let at = |offset: usize, len: usize| &data[offset..offset + len];

        assert_eq!(at(8, 32), [1u8; 32]);
        assert_eq!(at(40, 32), [2u8; 32]);
        assert_eq!(at(72, 32), [3u8; 32]);
        assert_eq!(at(104, 32), [4u8; 32]);
        assert_eq!(at(136, 32), [5u8; 32]);
        assert_eq!(at(168, 32), [6u8; 32]);
        assert_eq!(at(200, 8), 0x0102_0304_0506_0708u64.to_le_bytes());
        assert_eq!(data[208], 0); // DealStatus::Open
        assert_eq!(data[209], 0xAA);
        assert_eq!(data[210], 0xBB);
        assert_eq!(at(253, 20), [0xCC; 20]);
        assert_eq!(at(285, 4), 3u32.to_le_bytes()); // proof_repo length prefix
    }

    #[test]
    fn side_never_maps_to_vote_none() {
        assert_ne!(Side::Worker.as_vote(), VOTE_NONE);
        assert_ne!(Side::Client.as_vote(), VOTE_NONE);
    }
}
