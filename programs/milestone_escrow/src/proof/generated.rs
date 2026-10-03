// Bytes of the attested request parameters around the URL.
//
// PLACEHOLDER until the proof spike pins the exact canonical JSON produced by
// zkFetch; then `scripts/gen-proof-constants.ts` regenerates this file from
// `fixtures/proof-pr-merged.json`. Do not edit by hand after that.
use anchor_lang::prelude::*;

#[constant]
pub const PROOF_PROVIDER: &str = "http";

#[constant]
pub const PROOF_PARAMS_BEFORE_URL: &str = "{\"body\":\"\",\"geoLocation\":\"\",\"headers\":{},\"method\":\"GET\",\"paramValues\":{},\"responseMatches\":[{\"type\":\"contains\",\"value\":\"\\\"merged_at\\\": \\\"2\"}],\"responseRedactions\":[],\"url\":\"";

#[constant]
pub const PROOF_PARAMS_AFTER_URL: &str = "\"}";
