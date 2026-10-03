use anchor_lang::prelude::*;

#[error_code]
pub enum EscrowError {
    #[msg("A deal needs between 1 and 5 milestones")]
    InvalidMilestoneCount,
    #[msg("Every milestone amount must be greater than zero")]
    ZeroAmount,
    #[msg("A time window is shorter than the minimum or longer than one year")]
    WindowOutOfBounds,
    #[msg("Client, worker and arbiters must all be different people")]
    DuplicateParty,
    #[msg("The repository must look like owner/name")]
    InvalidRepo,
    #[msg("The proof settings for this milestone are not valid")]
    InvalidProofTarget,
    #[msg("This pull request is already linked to another milestone")]
    DuplicateProofTarget,
    #[msg("Arithmetic overflow")]
    MathOverflow,
    #[msg("Only the client can do this")]
    NotClient,
    #[msg("Only the freelancer can do this")]
    NotWorker,
    #[msg("Only one of the deal's arbiters can vote")]
    NotJudge,
    #[msg("Only the client or the freelancer can do this")]
    NotParty,
    #[msg("The deal is not waiting for acceptance")]
    DealNotOpen,
    #[msg("The deal is not active")]
    DealNotActive,
    #[msg("The deal can no longer be cancelled")]
    DealNotCancellable,
    #[msg("A deal that was never accepted can only be cancelled, not un-cancelled")]
    InvalidCancelArgument,
    #[msg("The time to accept this deal is over")]
    AcceptWindowClosed,
    #[msg("There is no milestone with this number")]
    InvalidMilestoneIndex,
    #[msg("The milestone is not in the right state for this")]
    InvalidMilestoneStatus,
    #[msg("The delivery deadline for this milestone has passed")]
    SubmitWindowClosed,
    #[msg("The review time is over. You can no longer object")]
    ReviewWindowClosed,
    #[msg("The voting time is over")]
    VoteWindowClosed,
    #[msg("This arbiter has already voted")]
    AlreadyVoted,
    #[msg("The arbiters have already decided this milestone")]
    AlreadyDecided,
    #[msg("The deliverable link is too long")]
    UriTooLong,
    #[msg("A pull request is already linked to this milestone")]
    ProofTargetAlreadySet,
    #[msg("This milestone has no proof condition")]
    NoProofTarget,
    #[msg("The proof is malformed")]
    ProofMalformed,
    #[msg("The proof is not about the agreed pull request")]
    ProofIdentifierMismatch,
    #[msg("The proof was made for a different deal or milestone")]
    ProofContextMismatch,
    #[msg("The proof signature is invalid")]
    ProofSignatureInvalid,
    #[msg("The proof was not signed by the agreed attestor")]
    ProofAttestorMismatch,
    #[msg("This milestone has already been paid out")]
    AlreadySettled,
    #[msg("Nothing to pay out yet")]
    NothingToSettle,
    #[msg("A token account for the recipient is required")]
    MissingRecipientAccount,
    #[msg("Every milestone must be paid out before the deal can be closed")]
    DealNotFullySettled,
}
