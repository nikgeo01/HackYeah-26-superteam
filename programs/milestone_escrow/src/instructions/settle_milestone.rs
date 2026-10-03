use anchor_lang::prelude::*;
use anchor_spl::token::{transfer_checked, Mint, Token, TokenAccount, TransferChecked};

use crate::{constants::*, error::EscrowError, events::MilestoneSettled, state::*};

/// How much of a milestone (amount plus any locked deposit) goes to each side.
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub struct Payout {
    pub to_worker: u64,
    pub to_client: u64,
    pub outcome: Outcome,
}

/// The rule that replaces the intermediary.
///
/// A pure function of the stored state and the clock: no one's opinion is an
/// input. First match wins. Recorded verdicts (an approval, a verified proof,
/// two matching votes) come before cancellation, so cancelling can only refund
/// milestones nobody has decided yet.
///
/// | # | Condition                                   | worker gets          | client gets              |
/// |---|---------------------------------------------|----------------------|--------------------------|
/// | 1 | Settled                                     | error AlreadySettled |                          |
/// | 2 | Approved                                    | amount + deposit     | 0                        |
/// | 3a| Disputed, 2 votes for the worker            | amount + deposit     | 0                        |
/// | 3b| Disputed, 2 votes for the client            | 0                    | amount + deposit         |
/// | 4 | deal Cancelled                              | 0                    | amount + deposit         |
/// | 5 | Disputed, voting deadline passed            | amount - amount/2    | amount/2 + deposit       |
/// | 6 | Submitted, review deadline passed (silence) | amount               | 0                        |
/// | 7 | Pending, deal Active, delivery deadline gone| 0                    | amount                   |
pub fn decide_outcome(deal_status: DealStatus, m: &Milestone, now: i64) -> Result<Payout> {
    let with_deposit = m
        .amount
        .checked_add(m.deposit_locked)
        .ok_or(EscrowError::MathOverflow)?;
    let to_worker = |outcome| Payout {
        to_worker: with_deposit,
        to_client: 0,
        outcome,
    };
    let to_client = |outcome| Payout {
        to_worker: 0,
        to_client: with_deposit,
        outcome,
    };

    let payout = match m.status {
        MilestoneStatus::Settled => return err!(EscrowError::AlreadySettled),
        MilestoneStatus::Approved => to_worker(Outcome::WorkerPaid),
        MilestoneStatus::Disputed if m.worker_votes() >= 2 => to_worker(Outcome::WorkerPaid),
        MilestoneStatus::Disputed if m.client_votes() >= 2 => to_client(Outcome::ClientRefunded),
        _ if deal_status == DealStatus::Cancelled => to_client(Outcome::Cancelled),
        MilestoneStatus::Disputed if now >= m.vote_deadline => {
            let client_half = m.amount / 2;
            Payout {
                // An odd base unit goes to the worker.
                to_worker: m
                    .amount
                    .checked_sub(client_half)
                    .ok_or(EscrowError::MathOverflow)?,
                to_client: client_half
                    .checked_add(m.deposit_locked)
                    .ok_or(EscrowError::MathOverflow)?,
                outcome: Outcome::Split,
            }
        }
        MilestoneStatus::Submitted if now >= m.review_deadline => Payout {
            to_worker: m.amount,
            to_client: 0,
            outcome: Outcome::WorkerPaid,
        },
        MilestoneStatus::Pending
            if deal_status == DealStatus::Active && now >= m.submit_deadline =>
        {
            Payout {
                to_worker: 0,
                to_client: m.amount,
                outcome: Outcome::ClientRefunded,
            }
        }
        _ => return err!(EscrowError::NothingToSettle),
    };

    // Every unit of the milestone is accounted for, exactly once.
    let paid = payout
        .to_worker
        .checked_add(payout.to_client)
        .ok_or(EscrowError::MathOverflow)?;
    require_eq!(paid, with_deposit, EscrowError::MathOverflow);
    Ok(payout)
}

#[derive(Accounts)]
pub struct SettleMilestone<'info> {
    /// Anyone. Pays the fee, receives nothing.
    pub cranker: Signer<'info>,

    #[account(
        mut,
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

    /// Any token account of the deal's mint owned by the worker. Required only
    /// when the worker receives something.
    #[account(
        mut,
        token::mint = mint,
        token::authority = deal.worker,
        token::token_program = token_program,
    )]
    pub worker_token: Option<Box<Account<'info, TokenAccount>>>,

    /// Any token account of the deal's mint owned by the client. Required only
    /// when the client receives something.
    #[account(
        mut,
        token::mint = mint,
        token::authority = deal.client,
        token::token_program = token_program,
    )]
    pub client_token: Option<Box<Account<'info, TokenAccount>>>,

    pub token_program: Program<'info, Token>,
}

/// Anyone. The only instruction that pays a milestone out of the vault, and it
/// can only pay the deal's worker and client, as `decide_outcome` dictates.
pub fn handle_settle_milestone(ctx: Context<SettleMilestone>, index: u8) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let deal = &mut ctx.accounts.deal;
    let deal_status = deal.status;

    // Effects before interactions: the milestone is terminal before any CPI.
    let payout = {
        let m = deal.milestone_mut(index)?;
        let payout = decide_outcome(deal_status, m, now)?;
        m.status = MilestoneStatus::Settled;
        m.outcome = payout.outcome;
        m.deposit_locked = 0;
        payout
    };
    deal.settled_count = deal
        .settled_count
        .checked_add(1)
        .ok_or(EscrowError::MathOverflow)?;

    let client = deal.client;
    let deal_id = deal.deal_id.to_le_bytes();
    let bump = deal.bump;
    let deal_key = deal.key();
    let signer_seeds: &[&[&[u8]]] = &[&[DEAL_SEED, client.as_ref(), &deal_id, &[bump]]];

    let accounts = &ctx.accounts;

    if payout.to_worker > 0 {
        let to = accounts
            .worker_token
            .as_ref()
            .ok_or(EscrowError::MissingRecipientAccount)?;
        vault_transfer(
            accounts,
            to.to_account_info(),
            payout.to_worker,
            signer_seeds,
        )?;
    }
    if payout.to_client > 0 {
        let to = accounts
            .client_token
            .as_ref()
            .ok_or(EscrowError::MissingRecipientAccount)?;
        vault_transfer(
            accounts,
            to.to_account_info(),
            payout.to_client,
            signer_seeds,
        )?;
    }

    emit!(MilestoneSettled {
        deal: deal_key,
        index,
        outcome: payout.outcome,
        to_worker: payout.to_worker,
        to_client: payout.to_client,
        cranker: accounts.cranker.key(),
    });
    Ok(())
}

fn vault_transfer<'info>(
    accounts: &SettleMilestone<'info>,
    to: AccountInfo<'info>,
    amount: u64,
    signer_seeds: &[&[&[u8]]],
) -> Result<()> {
    transfer_checked(
        CpiContext::new_with_signer(
            accounts.token_program.key(),
            TransferChecked {
                from: accounts.vault.to_account_info(),
                mint: accounts.mint.to_account_info(),
                to,
                authority: accounts.deal.to_account_info(),
            },
            signer_seeds,
        ),
        amount,
        accounts.mint.decimals,
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    const AMOUNT: u64 = 101;
    const DEPOSIT: u64 = 20;

    fn milestone(status: MilestoneStatus) -> Milestone {
        Milestone {
            amount: AMOUNT,
            status,
            outcome: Outcome::Unset,
            proof_kind: ProofKind::Off,
            votes: [VOTE_NONE; 3],
            proof_ref: 0,
            due_secs: 60,
            submit_deadline: 100,
            submitted_at: 50,
            review_deadline: 200,
            vote_deadline: 300,
            deposit_locked: 0,
            deliverable_hash: [0; 32],
        }
    }

    fn disputed(votes: [u8; 3]) -> Milestone {
        Milestone {
            votes,
            deposit_locked: DEPOSIT,
            ..milestone(MilestoneStatus::Disputed)
        }
    }

    fn decide(status: DealStatus, m: &Milestone, now: i64) -> Payout {
        decide_outcome(status, m, now).unwrap()
    }

    #[test]
    fn row1_settled_is_rejected() {
        assert!(
            decide_outcome(DealStatus::Active, &milestone(MilestoneStatus::Settled), 0).is_err()
        );
    }

    #[test]
    fn row2_approved_pays_worker_with_deposit() {
        let m = Milestone {
            deposit_locked: DEPOSIT,
            ..milestone(MilestoneStatus::Approved)
        };
        let p = decide(DealStatus::Active, &m, 0);
        assert_eq!((p.to_worker, p.to_client), (AMOUNT + DEPOSIT, 0));
        // A later cancellation does not undo an approval.
        assert_eq!(decide(DealStatus::Cancelled, &m, 0), p);
    }

    #[test]
    fn row3_majority_decides_even_after_cancel() {
        let w = disputed([VOTE_WORKER, VOTE_NONE, VOTE_WORKER]);
        let c = disputed([VOTE_CLIENT, VOTE_CLIENT, VOTE_NONE]);
        for status in [DealStatus::Active, DealStatus::Cancelled] {
            let p = decide(status, &w, 0);
            assert_eq!(
                (p.to_worker, p.to_client, p.outcome),
                (AMOUNT + DEPOSIT, 0, Outcome::WorkerPaid)
            );
            let p = decide(status, &c, 0);
            assert_eq!(
                (p.to_worker, p.to_client, p.outcome),
                (0, AMOUNT + DEPOSIT, Outcome::ClientRefunded)
            );
        }
    }

    #[test]
    fn row4_cancel_refunds_undecided() {
        for m in [
            milestone(MilestoneStatus::Pending),
            milestone(MilestoneStatus::Submitted),
            disputed([VOTE_WORKER, VOTE_CLIENT, VOTE_NONE]),
        ] {
            let p = decide(DealStatus::Cancelled, &m, 0);
            assert_eq!((p.to_worker, p.to_client), (0, m.amount + m.deposit_locked));
            assert_eq!(p.outcome, Outcome::Cancelled);
        }
    }

    #[test]
    fn row5_no_majority_splits_after_deadline() {
        let m = disputed([VOTE_WORKER, VOTE_CLIENT, VOTE_NONE]);
        assert!(decide_outcome(DealStatus::Active, &m, 299).is_err());
        let p = decide(DealStatus::Active, &m, 300);
        assert_eq!(
            (p.to_worker, p.to_client, p.outcome),
            (51, 50 + DEPOSIT, Outcome::Split)
        );
    }

    #[test]
    fn row6_silence_pays_worker() {
        let m = milestone(MilestoneStatus::Submitted);
        assert!(decide_outcome(DealStatus::Active, &m, 199).is_err());
        let p = decide(DealStatus::Active, &m, 200);
        assert_eq!(
            (p.to_worker, p.to_client, p.outcome),
            (AMOUNT, 0, Outcome::WorkerPaid)
        );
    }

    #[test]
    fn row7_missed_delivery_refunds_client() {
        let m = milestone(MilestoneStatus::Pending);
        assert!(decide_outcome(DealStatus::Active, &m, 99).is_err());
        let p = decide(DealStatus::Active, &m, 100);
        assert_eq!(
            (p.to_worker, p.to_client, p.outcome),
            (0, AMOUNT, Outcome::ClientRefunded)
        );
        // Before acceptance nothing is settleable without a cancel.
        assert!(decide_outcome(DealStatus::Open, &m, 1_000).is_err());
    }
}
