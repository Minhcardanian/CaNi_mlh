# NightPermit

NightPermit is a testnet-only milestone approval and payout prototype. Two authorized reviewers approve a milestone privately on Midnight Preprod; an attested permit then authorizes one exact, replay-safe payout on Cardano Preview.

The MVP demonstrates privacy-aware approval, explicit cross-chain trust, deterministic authorization, and strict payout enforcement. It is not a trustless bridge, a production escrow, or a regulated financial product.

## Product flow

1. A beneficiary connects a Cardano Preview wallet and requests milestone review.
2. Two distinct authorized reviewers submit private approvals through Midnight wallets.
3. The Midnight Compact contract validates reviewer eligibility, prevents duplicate participation, and exposes only the minimum authorization state.
4. A relay observes the confirmed authorization, resolves the configured entitlement, encodes a canonical permit, and signs it.
5. The beneficiary submits the permit and transaction to Cardano Preview.
6. The Aiken validator verifies the relay signature, subject, validity window, state transition, exact payout, and unused nullifier.
7. A repeated or modified claim is rejected.

## Application architecture

```text
Reviewer wallets
      |
      v
Web application -----> Midnight Compact contract (Preprod)
      |                              |
      |                              v
      |                    confirmed authorization
      |                              |
      |                              v
      +------------------------ Attestation relay
                                     |
                              canonical signed permit
                                     |
                                     v
Beneficiary wallet -----> Cardano Aiken validator (Preview)
                                     |
                              exact milestone payout
```

The planned application is split into five bounded components:

- **Web application:** guides the three-stage review, authorization, and claim flow while keeping Midnight and Cardano network state explicit.
- **Midnight contract:** enforces the authorized-reviewer set, two-distinct-reviewer threshold, private witness rules, and authorization nullifier behavior.
- **Attestation relay:** reads only the allowlisted Midnight contract, maps confirmed state to a server-controlled entitlement, emits canonical permit bytes, and signs them with Ed25519.
- **Cardano validator:** verifies the signed permit and transaction shape, then advances a unique state output so a nullifier cannot be paid twice.
- **Shared protocol package:** defines the versioned permit schema, canonical encoding, golden vectors, identifiers, and error contracts used across TypeScript and Aiken.

## Trust boundary

The relay is an explicit trusted attestor. Cardano verifies the relay's signature and the payout rules; it does not directly verify Midnight consensus or a Compact proof. Permit fields are bound to the expected networks, contract, policy, milestone, beneficiary, entitlement, validity interval, sequence, and nullifier.

Private reviewer witnesses remain on the Midnight side. Public logs and UI state must expose only the minimum identifiers and status needed to operate and demonstrate the flow.

## Networks and technology

- Midnight Preprod with Compact and the Midnight JavaScript SDK
- Cardano Preview with Aiken
- TypeScript web and relay services
- Dockerized local proof service

## Development

Node `24.11.1` is the pinned JavaScript runtime. From the repository root:

```bash
npm ci
npm run check
npm test
npm run build
```

The first implemented component is `@nightpermit/permit`, the shared canonical binary codec and Ed25519 envelope used by the relay and Cardano validator. Its binary layout and trust boundary are documented in [docs/protocol/permit-v1.md](docs/protocol/permit-v1.md).

## Project state

The infrastructure baseline and versioned permit protocol are implemented. Midnight contract, relay, Cardano validator, and web application work remain in progress.
