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

The application is split into six bounded components:

- **Web application:** guides the three-stage review, authorization, and claim flow while keeping Midnight and Cardano network state explicit.
- **Midnight contract:** enforces the authorized-reviewer set, two-distinct-reviewer threshold, private witness rules, and authorization nullifier behavior.
- **Attestation relay:** reads only the allowlisted Midnight contract, maps confirmed state to a server-controlled entitlement, emits canonical permit bytes, and signs them with Ed25519.
- **Cardano validator:** verifies the signed permit and transaction shape, then advances a unique state output so a nullifier cannot be paid twice.
- **Deployment coordinator:** derives one immutable public policy binding, deploys Midnight before initializing Cardano, and emits the public browser and relay configuration only after confirmation.
- **Shared protocol package:** defines the versioned permit schema, canonical encoding, golden vectors, identifiers, and error contracts used across TypeScript and Aiken.

## Trust boundary

The relay is an explicit trusted attestor. Cardano verifies the relay's signature and the payout rules; it does not directly verify Midnight consensus or a Compact proof. Permit fields are bound to the expected networks, contract, policy, milestone, beneficiary, entitlement, validity interval, sequence, and nullifier.

Private reviewer witnesses remain on the Midnight side. Public logs and UI state must expose only the minimum identifiers and status needed to operate and demonstrate the flow.

## Networks and technology

- Midnight Preprod with Compact and the Midnight JavaScript SDK
- Cardano Preview with Aiken
- TypeScript web and relay services
- Dockerized local proof service

Pinned compatibility versions are Node `24.11.1`, npm `11.6.2`, Aiken `1.1.13`, Compact compiler `0.31.0`, Compact runtime `0.16.0`, Midnight.js `4.1.1`, Midnight wallet connector API `4.0.1`, Lucid Evolution `0.6.2`, and Kupo `2.12.0`.

## Install and verify

From a clean clone with the pinned Node and Aiken versions:

```bash
npm ci
npm run check
npm test
npm run build
npm audit --omit=dev --audit-level=high
```

These commands compile every TypeScript workspace and the Aiken validator, run protocol, contract, relay, browser, deployment, readiness, and validator tests, enforce the initial browser bundle budget, and audit production dependencies.

## Configure and run

Copy `.env.example` to the ignored `.env` file and provide the public deployment identifiers plus local service paths. Relay signing material stays in a separate mode-`0600` file referenced by `RELAY_PRIVATE_KEY_FILE`; wallet keys, reviewer secrets, and storage passwords are never environment variables or repository files.

Start the local Cardano provider described in [infra/README.md](infra/README.md), ensure the pinned Midnight proof server is listening only on localhost, then verify the provider boundary:

```bash
docker compose --env-file .env -f infra/compose.cardano-providers.yaml up -d
npm run readiness -- --providers
```

For a bounded startup or restart gate, let the verifier poll until every selected dependency recovers or the deadline expires:

```bash
npm run readiness -- --providers --wait-ms=30000 --interval-ms=1000
```

After a wallet-backed deployment has produced public configuration, build and start the relay and browser:

```bash
npm run build --workspace=@nightpermit/relay
npm start --workspace=@nightpermit/relay
npm run dev --workspace=@nightpermit/web
```

The beneficiary flow is at `/`. The operator-only deployment ceremony is at `/deploy.html`; it deploys Midnight first, initializes Cardano second, and emits public runtime configuration only after both confirmations. The full `npm run readiness` check includes the running relay.

One optional fallback Kupo/Ogmios pair can be configured for the browser. It must be a complete Preview-compatible pair and remote URLs must use HTTPS. Failover is limited to provider initialization; NightPermit never retries a wallet signature or transaction submission automatically.

While an operation is active, the product displays its purpose, elapsed time, timeout boundary, and retry behavior. Wallet prompts and chain submissions remain single-shot; a failure cannot create a false completion state.

## Demo flow

1. Pre-warm the proof server and confirm the full readiness report passes.
2. Connect Midnight Preprod and Cardano Preview wallets and verify both network labels.
3. Submit approvals from two separately provisioned reviewer identities.
4. Retrieve the relay-signed permit only after the confirmed 2-of-2 authorization.
5. Claim from the configured beneficiary wallet and wait for Preview confirmation.
6. Show the Midnight transaction, permit hash, relay-signature status, Cardano transaction, and final state from the evidence panel.

Any staged authorization or pre-funded state must be identified as staged. The reviewer secret and encrypted-storage password are entered only in the browser and must not be copied into chat, logs, recordings, or deployment artifacts.

The shared `@nightpermit/permit` package owns the canonical binary codec and Ed25519 envelope. The Cardano component consumes the same golden vectors and enforces the state-thread payout transition. See the [application architecture](docs/architecture.md), [threat model](docs/security/threat-model.md), [verification map](docs/verification.md), and [Permit V1 protocol](docs/protocol/permit-v1.md). Component behavior is documented alongside the [Midnight contract](packages/midnight-contract/README.md), [relay](packages/relay/README.md), [Cardano validator](contracts/cardano/README.md), [Cardano transaction client](packages/cardano-client/README.md), and [web application](packages/web/README.md).

Local Cardano provider topology and startup are documented in [infra/README.md](infra/README.md).

## Project state

The infrastructure baseline, versioned permit protocol, Cardano validator, Midnight authorization contract and client, attestation relay, Cardano transaction client, browser flow, and deployment provider bridge are implemented and locally tested. Testnet deployment and live end-to-end proving remain in progress.

## Known limitations

- The relay is one trusted testnet attestor; Cardano does not verify Midnight consensus or a Compact proof directly.
- The MVP fixes one escrow, milestone, tranche, beneficiary, two reviewers, and relay key per deployment. Rotation or policy changes require a coordinated state transition or redeployment.
- The replay state stores consumed nullifiers linearly and is benchmarked only through 32 entries.
- Provider fallback covers pre-transaction client creation only. It does not make transaction submission multi-provider or automatically retry wallet actions.
- Recovery, availability, timing, accessibility, and complete dual-wallet behavior still require live Preprod/Preview evidence before the prototype can be represented as deployment-complete.
- NightPermit is testnet-only and has not undergone a production security audit.
