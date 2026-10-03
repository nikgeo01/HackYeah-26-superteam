use anchor_lang::prelude::*;

/// Seed of the `Deal` PDA: `[DEAL_SEED, client, deal_id (u64 LE)]`.
#[constant]
pub const DEAL_SEED: &[u8] = b"deal";

/// Seed of the vault token account PDA: `[VAULT_SEED, deal]`.
#[constant]
pub const VAULT_SEED: &[u8] = b"vault";

/// Every Anchor account is prefixed with an 8-byte discriminator.
pub const ANCHOR_DISCRIMINATOR: usize = 8;

pub const MAX_MILESTONES: usize = 5;

/// Bytes of `"owner/name"` for the proof repository.
pub const MAX_REPO_LEN: usize = 80;

/// Bytes of the deliverable link (only emitted in an event, never stored).
pub const MAX_URI_LEN: usize = 128;

/// Bytes of the signed proof context.
pub const MAX_CONTEXT_LEN: usize = 512;

/// `"0x"` + 40 lowercase hex characters.
pub const PROOF_OWNER_LEN: usize = 42;

/// Lower bound for every timer. Short on purpose so a live demo can use 30-45 s
/// windows; this is a documented limitation, not a production value.
#[constant]
pub const MIN_WINDOW_SECS: u32 = 10;

/// Upper bound for every timer: 365 days.
#[constant]
pub const MAX_WINDOW_SECS: u32 = 31_536_000;

pub const VOTE_NONE: u8 = 0;
pub const VOTE_WORKER: u8 = 1;
pub const VOTE_CLIENT: u8 = 2;

pub const CANCEL_FLAG_CLIENT: u8 = 0b01;
pub const CANCEL_FLAG_WORKER: u8 = 0b10;

/// Prefix of the string that binds a proof to one deal and one milestone.
pub const PROOF_CONTEXT_PREFIX: &str = "kept:v1:";
