//! Recovers the Ethereum-style address that signed a claim.

use solana_keccak_hasher::hashv;
use solana_secp256k1_recover::secp256k1_recover;

use super::to_hex;

/// The text the attestor signs, one field per line.
pub fn signed_message(identifier: &[u8; 32], owner: &str, timestamp_s: u32, epoch: u32) -> String {
    format!("0x{}\n{owner}\n{timestamp_s}\n{epoch}", to_hex(identifier))
}

/// EIP-191 "personal sign" digest of `message`.
pub fn personal_sign_digest(message: &str) -> [u8; 32] {
    let prefix = format!("\x19Ethereum Signed Message:\n{}", message.len());
    hashv(&[prefix.as_bytes(), message.as_bytes()]).to_bytes()
}

/// Returns the 20-byte address that produced `signature` (r || s || v) over
/// `digest`, or `None` if the signature is malformed.
pub fn recover_address(digest: &[u8; 32], signature: &[u8; 65]) -> Option<[u8; 20]> {
    let v = signature[64];
    let recovery_id = match v {
        27 | 28 => v - 27,
        0 | 1 => v,
        _ => return None,
    };
    let pubkey = secp256k1_recover(digest, recovery_id, &signature[..64]).ok()?;
    let hash = hashv(&[&pubkey.to_bytes()]).to_bytes();
    let mut address = [0u8; 20];
    address.copy_from_slice(&hash[12..]);
    Some(address)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn message_format() {
        let m = signed_message(&[0x11; 32], "0xabc", 5, 2);
        assert_eq!(m, format!("0x{}\n0xabc\n5\n2", "11".repeat(32)));
    }

    /// Sign like an Ethereum wallet would and check we recover the same address.
    #[test]
    fn recovers_signer_address() {
        use k256::ecdsa::SigningKey;

        let key = SigningKey::from_slice(&[0x42; 32]).unwrap();
        let uncompressed = key.verifying_key().to_encoded_point(false);
        let expected = &hashv(&[&uncompressed.as_bytes()[1..]]).to_bytes()[12..];

        let digest = personal_sign_digest(&signed_message(&[7; 32], "0xabc", 1, 1));
        let (sig, recid) = key.sign_prehash_recoverable(&digest).unwrap();
        let mut signature = [0u8; 65];
        signature[..64].copy_from_slice(&sig.to_bytes());
        signature[64] = 27 + recid.to_byte();

        assert_eq!(recover_address(&digest, &signature).unwrap(), expected);
    }

    #[test]
    fn rejects_bad_recovery_byte() {
        assert!(recover_address(&[1; 32], &[0; 65].map(|_| 7)).is_none());
    }
}
