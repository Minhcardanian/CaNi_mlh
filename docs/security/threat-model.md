# NightPermit threat model

## Protected data

| Data | Location | Public? | Control |
| --- | --- | --- | --- |
| Reviewer secret and witness | Browser encrypted private-state provider | No | Validated locally, never logged or serialized, cleared from UI memory after use |
| Wallet signing keys and mnemonics | Wallet extensions | No | DApp receives only connector APIs and transaction signatures |
| Relay signing seed | Mode-`0600` file outside Git | No | File-only loading; derived public key must match separately configured expected key |
| Midnight approval count and authorization nullifier | Midnight ledger | Yes | Contains no raw reviewer secret or selected identity |
| Permit, hash, signature, and relay public key | Relay transport and idempotency store | Yes | Canonical, integrity-checked, policy-bound record |
| Beneficiary, tranche, state sequence, and consumed nullifiers | Cardano ledger | Yes | Required for public payout enforcement and replay prevention |

## Trusted components

- Wallet extensions are trusted to protect keys, identify the selected test network, and sign only after user approval.
- The local proof server is trusted to execute the expected proving workload and remains localhost-only in the demo topology.
- Midnight Preprod and Cardano Preview providers are trusted for availability and accurate chain views. Conflicting or malformed views fail closed.
- The relay is trusted to attest only to confirmed allowlisted Midnight state. This is the primary residual trust assumption.
- The browser host is trusted to serve the reviewed application and proving artifacts without modification.

## Threats and controls

| Threat | Control | Residual risk |
| --- | --- | --- |
| Unauthorized or duplicate reviewer | Compact commitment check plus deployment-scoped reviewer nullifier | Compromised reviewer secret can approve as that reviewer |
| Context substitution | Constructor-fixed policy and Permit V1 bindings for both networks, deployments, action, beneficiary, asset, amount, validity, and key ID | A new authorized deployment can intentionally choose different policy values |
| Forged permit | Ed25519 verification in TypeScript planning and Aiken; relay seed/public-key consistency check | Compromised relay seed can sign within the fixed policy |
| Replay or competing claims | Unique state-thread token, one state input/output, monotonically increasing sequence, consumed-nullifier set | State grows linearly and is benchmarked only through 32 nullifiers |
| Redirected or enlarged payout | Required beneficiary signer, exact payout output, exact tranche subtraction, and state-value conservation | Wallet may decline or provider may become unavailable |
| Provider injection or downgrade | HTTPS for remote endpoints, localhost-only plain HTTP, no URL credentials, strict response decoding, bounded timeout/retry | A trusted provider can still censor or delay requests |
| Duplicate submission during failover | Fallback is limited to client initialization; signing/submission are never automatically retried | Operator must resolve ambiguous external wallet/provider outcomes manually |
| Secret leakage through Git or logs | Ignored secret/environment paths, file-only relay seed, allowlisted structured logs, stable public errors, local hygiene scan | Host compromise or unsafe screen recording remains outside application control |
| False success | UI state advances only from exact runtime results and separate confirmation promises | Provider confirmation semantics remain a live-test dependency |
| Dependency or image drift | Exact package lock, pinned toolchain, digest-pinned Kupo image, CI install/check/test/build/audit | Upstream network changes can still require a reviewed upgrade |

## Security invariants

NightPermit must fail before signing or submission when a network, contract, policy, state datum, signer, validity range, relay key, or provider response cannot be established exactly. Provider errors are reduced to typed public codes; raw payloads are not returned to the UI or logs. No caller-controlled bypass flag, payout field, or relay key is accepted by the permit endpoint.

This is a testnet prototype, not a trustless bridge. A production design requires independent security review, stronger attestation decentralization or direct proof verification, managed key custody and rotation, durable service supervision, and live disaster-recovery evidence.
