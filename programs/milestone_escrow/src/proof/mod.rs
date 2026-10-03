//! Checks that a signed attestation says "GitHub reports the agreed pull
//! request as merged", for this deal and this milestone.
//!
//! The attestor signs `(identifier, owner, timestamp, epoch)`. The identifier
//! is the keccak hash of the provider, the request parameters and the context.
//! The parameters are rebuilt here from what the deal stores, never taken from
//! the caller, so a proof about any other URL or response rule cannot match.

pub mod generated;
pub mod verify;

use solana_keccak_hasher::hashv;

pub use generated::*;

/// The GitHub endpoint whose response proves the merge. The Issues endpoint
/// always returns JSON (it ignores the `Accept` header), so a hidden header
/// cannot turn the response into worker-controlled raw text.
pub fn expected_url(repo: &str, pr: u32) -> String {
    format!("https://api.github.com/repos/{repo}/issues/{pr}")
}

pub fn expected_parameters(repo: &str, pr: u32) -> String {
    format!(
        "{PROOF_PARAMS_BEFORE_URL}{}{PROOF_PARAMS_AFTER_URL}",
        expected_url(repo, pr)
    )
}

/// The exact substring the signed context must contain. Quotes included, so
/// it cannot be smuggled inside another JSON string value.
pub fn binding_needle(deal: &[u8; 32], index: u8) -> String {
    format!(
        "\"contextMessage\":\"{}{}:{}\"",
        crate::constants::PROOF_CONTEXT_PREFIX,
        to_hex(deal),
        index
    )
}

pub fn claim_identifier(parameters: &str, context: &str) -> [u8; 32] {
    hashv(&[
        PROOF_PROVIDER.as_bytes(),
        b"\n",
        parameters.as_bytes(),
        b"\n",
        context.as_bytes(),
    ])
    .to_bytes()
}

pub fn to_hex(bytes: &[u8]) -> String {
    const DIGITS: &[u8; 16] = b"0123456789abcdef";
    let mut out = String::with_capacity(bytes.len() * 2);
    for b in bytes {
        out.push(DIGITS[usize::from(b >> 4)] as char);
        out.push(DIGITS[usize::from(b & 0x0f)] as char);
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn url_uses_issues_endpoint() {
        assert_eq!(
            expected_url("nikgeo01/kept-demo", 7),
            "https://api.github.com/repos/nikgeo01/kept-demo/issues/7"
        );
    }

    #[test]
    fn needle_is_exact() {
        assert_eq!(
            binding_needle(&[0xab; 32], 2),
            format!("\"contextMessage\":\"kept:v1:{}:2\"", "ab".repeat(32))
        );
    }

    #[test]
    fn identifier_depends_on_pr() {
        let a = claim_identifier(&expected_parameters("a/b", 1), "{}");
        let b = claim_identifier(&expected_parameters("a/b", 12), "{}");
        assert_ne!(a, b);
    }
}
