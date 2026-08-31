# NightPermit web application

The browser application presents the complete testnet flow in three stages: connect Midnight Preprod and Cardano Preview wallets, collect two private Midnight approvals, then retrieve and claim one relay-signed Cardano permit.

The UI never accepts payout fields from the user. Its state machine advances only from confirmed runtime results, keeps wallet identity/network context visible, exposes a compact public evidence panel, and maps provider or protocol failures to deterministic messages without serializing raw provider objects. Before a claim, it names the beneficiary, asset, amount, nullifier, and transaction data that become public on Cardano Preview. Permit retrieval checks the canonical hash and Ed25519 signature against the deployment-fixed public key before showing the public nullifier, correlation ID, or verified status.

The deployment uses public Vite configuration for the relay, deployed Midnight contract, proving-artifact base URL, Cardano validator and initialization reference, and Kupo/Ogmios endpoints. Remote HTTP and WebSocket providers require secure transport; plain transport is accepted only on localhost.

The primary Kupo/Ogmios pair may be accompanied by one complete fallback pair. Provider selection is attempted only while creating the Preview client, before a transaction exists. A signing or submission failure is never replayed through the fallback. Remote fallback endpoints must use HTTPS and cannot contain embedded credentials.

`deploy.html` is the operator-facing deployment ceremony. It connects Preprod and Preview wallets, validates a public policy, derives the validator binding from a wallet-controlled initialization output, deploys Midnight first, initializes Cardano second, and emits only public browser/relay configuration after both transactions confirm. Reviewer credentials stay in component memory and are cleared immediately after the Midnight wallet request.

Both entrypoints expose active-operation purpose, elapsed time, and the exact timeout or single-shot boundary. The 1280x720 compact-height layout keeps the complete initial product evidence panel and deployment connection step inside the recording viewport without horizontal overflow.

At runtime, the provider bridge joins the deployed Compact contract through the connected Midnight wallet, stores reviewer state in encrypted account-and-contract-scoped browser storage, and observes the exact approval transaction before advancing. The claim side discovers the unique Cardano state UTxO, rebuilds the parameterized validator, asks the CIP-30 wallet to sign, submits once, and tracks confirmation separately.

Midnight and Cardano SDKs load only when their flow stage needs them. The production build independently enforces the 500 KiB initial compressed-JavaScript budget for both application entrypoints from the Vite manifest while leaving proving and ledger WASM as separate lazy assets.

Wallet keys remain in their extensions. The reviewer secret is separately provisioned DApp state, and the storage password is supplied only for the active authorization operation. A second approval requires a distinct reviewer identity and separately recovered state.
