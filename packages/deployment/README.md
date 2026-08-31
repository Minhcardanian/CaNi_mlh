# NightPermit deployment plan

This package derives the public configuration shared by the one Midnight contract, Cardano validator state, attestation relay, and browser application. It contains no wallet keys, reviewer secrets, relay signing seed, or environment file writer.

The deployment order is fixed:

1. Reserve one wallet-controlled Cardano Preview output reference.
2. Parameterize the Aiken validator and derive its hash and address.
3. Deploy the Midnight contract with that validator hash and the fixed milestone policy.
4. Bind the returned Midnight contract identifier into the initial Cardano state.
5. Initialize the Cardano state token and escrow inventory.
6. Derive the public relay policy and browser environment from the same finalized plan.

`prepareDeployment` validates every fixed-width field and constructor policy before a wallet transaction. `finalizeDeployment` produces the zero-sequence Cardano datum only after a canonical Midnight contract identifier is available. Generated public values may be copied into local ignored configuration; secret locations and values remain separately provisioned.
