# NightPermit Cardano client

This package constructs the two Cardano Preview transactions used by NightPermit: one-shot validator-state initialization and replay-safe milestone claim.

The client parameterizes the Aiken Plutus V3 validator with a unique initialization output reference. Before a claim is built it verifies the relay envelope hash and Ed25519 signature, every permit-to-state binding, the connected beneficiary key, validity slots, the inline state datum, the state-thread token, available inventory, and nullifier freshness.

The claim transaction spends exactly one state UTxO, prepends the nullifier, increments the sequence, preserves the state token and unrelated inventory, pays the signed tranche to the beneficiary with a nullifier datum, requires the beneficiary signature, and constrains the Preview validity interval. Wallet key access remains inside the CIP-30 wallet; this package only prepares the transaction.

For a live wallet path, `createWalletClaimPlan` discovers the unique state-token UTxO through the configured Lucid provider and strictly decodes its inline datum before applying the same checks. `submitWalletClaim` then requests the CIP-30 signature, submits canonical transaction bytes, and exposes confirmation as a separate terminal step so the UI cannot report success early.
