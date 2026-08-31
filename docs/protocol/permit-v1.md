# Permit V1 binary protocol

NightPermit signs a deterministic binary permit. JSON is presentation-only and is never a signature payload. The relay signs the complete canonical byte sequence with Ed25519; `permitHash` is Blake2b-256 over those same bytes.

## Encoding

All integers are unsigned and big-endian. Hex fields are decoded to bytes before encoding. Option markers are exactly `0x00` for absent or `0x01` for present. A decoder rejects unknown constants, invalid lengths, invalid option markers, truncation, and trailing data.

| Order | Field | Binary representation |
| --- | --- | --- |
| 1 | magic | 4 bytes: ASCII `NP01` |
| 2 | version | `u8`, value `1` |
| 3 | domain | `u8`, value `1` = `nightpermit/cardano-preview/v1` |
| 4 | Midnight network | `u8`, value `1` = `preprod` |
| 5 | Cardano network magic | `u32`, value `2` = Preview |
| 6 | Midnight contract ID | 32 bytes |
| 7 | Midnight transaction ID | 32 bytes |
| 8 | authorization index | option marker, then `u32` when present |
| 9 | policy ID | 32 bytes |
| 10 | escrow ID | 32 bytes |
| 11 | milestone ID | 32 bytes |
| 12 | beneficiary payment key hash | 28 bytes |
| 13 | action ID | 32 bytes |
| 14 | asset policy ID | `u8` length (`0` for lovelace or `28`), then bytes |
| 15 | asset name | `u8` length (`0..32`), then bytes |
| 16 | tranche amount | `u64` |
| 17 | nullifier | 32 bytes |
| 18 | not-before slot | option marker, then `u64` when present |
| 19 | expiry slot | `u64` |
| 20 | Cardano validator hash | 28 bytes |
| 21 | relay key ID | 32 bytes |

The entitlement's policy, escrow, and milestone must equal the corresponding permit fields, so each binding is encoded once. The canonical payload limit is 512 bytes. Version 1 supports lovelace or a single Cardano native asset. A future field or encoding change requires a new version, decoder branch, and golden-vector set.

## Trust and privacy

The permit intentionally contains only public authorization and payout data. Reviewer secrets, reviewer identity linkage, witness values, wallet signing material, and proof-server state are never permit fields. The relay remains a trusted attestor: Cardano verifies its signature and the bound payout rules, not Midnight consensus or a Compact proof directly.

The permit binds the two test networks, Midnight deployment and transaction, authorization index, policy, escrow, milestone, beneficiary, exact entitlement, nullifier, validity window, Cardano validator, and relay key identity. Changing any encoded field invalidates the signature.
