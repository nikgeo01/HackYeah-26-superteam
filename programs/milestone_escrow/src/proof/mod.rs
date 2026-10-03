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

    /// A real proof from the Reclaim attestor (fixtures/proof-pr-merged.json):
    /// the program's rebuilt parameters reproduce its identifier, and its
    /// signature recovers the Reclaim attestor address.
    #[test]
    fn real_attestor_proof_verifies() {
        let context = r#"{"contextAddress":"ZwRX6t8jT4wSamrXnJS616ZDi5UnESfc8D7x4aTitfW","contextMessage":"kept:v1:533c40623b2162fcd5b70dcd274a6e891ddc368fa9dbd2adce7fa0894f191a01:0","providerHash":"0x08f151bb0213f306a871a1c50703b04b2b4fe12b138f63785de94511efec5135"}"#;
        let identifier = claim_identifier(&expected_parameters("nikgeo01/kept-demo", 1), context);
        assert_eq!(
            to_hex(&identifier),
            "c8d546f3d0058c2ed996ad0cc24ec7ac549ffdadc4ba00ed9e38f03703e9dd0c"
        );

        let deal =
            from_hex::<32>("533c40623b2162fcd5b70dcd274a6e891ddc368fa9dbd2adce7fa0894f191a01");
        assert!(context.contains(&binding_needle(&deal, 0)));

        let signature = from_hex::<65>("eec29bad1e95a36dce62c642223dac6e859b53b84e74fdacc9dfb4846c6c285876a061e0dfd5ee80d40dbc48b1e5eabb34bd5238b7bc7f022165eaed8091127a1c");
        let message = verify::signed_message(
            &identifier,
            "0x27ea5052b677288a6bd3fba26c9d2a61c11dd2fc",
            1_791_036_295,
            1,
        );
        let signer = verify::recover_address(&verify::personal_sign_digest(&message), &signature);
        assert_eq!(
            to_hex(&signer.unwrap()),
            "244897572368eadf65bfbc5aec98d8e5443a9072"
        );
    }

    fn from_hex<const N: usize>(s: &str) -> [u8; N] {
        let mut out = [0u8; N];
        for (i, byte) in out.iter_mut().enumerate() {
            *byte = u8::from_str_radix(&s[2 * i..2 * i + 2], 16).unwrap();
        }
        out
    }

    #[test]
    fn identifier_depends_on_pr() {
        let a = claim_identifier(&expected_parameters("a/b", 1), "{}");
        let b = claim_identifier(&expected_parameters("a/b", 12), "{}");
        assert_ne!(a, b);
    }
}
