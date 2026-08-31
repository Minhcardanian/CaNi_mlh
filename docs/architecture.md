# NightPermit application architecture

NightPermit releases one fixed Cardano Preview milestone tranche after two private Midnight Preprod approvals. The two ledgers do not verify each other directly. A deliberately narrow relay converts confirmed Midnight public state into a canonical Ed25519-signed permit that the Cardano validator can verify.

## Deployment topology

The operator ceremony establishes one immutable cross-chain binding:

1. A Cardano wallet selects a controlled Preview output reference.
2. The deployment coordinator parameterizes the Aiken validator with that reference and derives its hash and address.
3. The Midnight constructor fixes that validator hash, one policy, escrow, milestone, beneficiary, action, asset tranche, and two reviewer commitments.
4. After the Midnight deployment confirms, its contract identifier is inserted into the zero-sequence Cardano state.
5. The Cardano wallet initializes one state-thread token and the fixed escrow inventory.
6. Only after confirmation does the ceremony emit public browser environment values, relay environment values, and the relay policy document.

The prepared plan copies caller-owned values before review, so later mutation cannot change the policy that wallet prompts authorize. Signing keys, reviewer secrets, wallet credentials, and encrypted-storage passwords are not deployment artifacts.

## Runtime components

- The web application owns the user-facing state machine. It connects wallets, submits private approvals, retrieves one permit, builds one claim, and treats submission and confirmation as separate states.
- The Midnight Compact contract owns reviewer eligibility, distinct-reviewer enforcement, the 2-of-2 threshold, and the authorization nullifier. Reviewer secrets enter through local witnesses and are never ledger fields.
- The relay reads an allowlisted contract and exact transaction from the official indexer provider. It validates the full fixed policy, obtains the current Preview slot from Ogmios, signs one canonical permit, and persists only the public verified envelope for idempotent lookup.
- The Permit V1 package owns domain-separated encoding, Blake2b-256 hashing, Ed25519 signing, strict decoding, and cross-language golden vectors.
- The Cardano client discovers the unique state UTxO, decodes its inline datum, validates every permit/state binding, constructs the transaction, and delegates signing to the CIP-30 wallet.
- The Aiken validator verifies the relay signature, required signer, validity range, exact beneficiary and tranche, unique state input/output, state-value conservation, sequence increment, and unused nullifier.

## Provider boundary

The local Preview path uses Kupo for indexed UTxOs and Ogmios for node queries, evaluation, and submission. Browser code depends on a small provider-selection boundary rather than local filesystem or node details. One complete fallback Kupo/Ogmios pair may be configured. NightPermit tries providers only while creating the Preview client; after transaction construction begins, signing and submission are never automatically replayed.

The proof server, Kupo, Ogmios, and relay bind to localhost in the local topology. Remote browser providers require secure transport and cannot contain URL credentials. The readiness verifier checks Midnight RPC/indexer state, proof-server health, Kupo synchronization, Ogmios tip shape, Kupo/Ogmios tip agreement, and relay health without printing provider payloads.

## State and correlation

Midnight public state contains the fixed payout context, approval count, authorization flag, reviewer commitments, reviewer nullifiers, and final authorization nullifier. Cardano state contains the fixed permit policy, unique state-thread token identity, sequence, and consumed nullifiers. The relay envelope binds the Midnight transaction and permit hash; HTTP responses carry a safe correlation identifier. A live end-to-end evidence record must join that correlation identifier to both chain transaction identifiers.

The relay is the explicit trust boundary. Compromise of its signing authority can produce permits that Cardano accepts within the fixed policy. The validator still prevents redirection, amount changes, expiry bypass, configuration mutation, and replay, but it cannot independently prove Midnight finality.
