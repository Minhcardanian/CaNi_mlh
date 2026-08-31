# NightPermit web application

The browser application presents the complete testnet flow in three stages: connect Midnight Preprod and Cardano Preview wallets, collect two private Midnight approvals, then retrieve and claim one relay-signed Cardano permit.

The UI never accepts payout fields from the user. Its state machine advances only from confirmed runtime results, keeps wallet/network context visible, exposes a compact public evidence panel, and maps provider or protocol failures to deterministic messages without serializing raw provider objects.

The deployment uses public Vite configuration for the relay, deployed Midnight contract, proving-artifact base URL, Cardano validator and initialization reference, and Kupo/Ogmios endpoints. Remote HTTP and WebSocket providers require secure transport; plain transport is accepted only on localhost.

At runtime, the provider bridge joins the deployed Compact contract through the connected Midnight wallet, stores reviewer state in encrypted account-and-contract-scoped browser storage, and observes the exact approval transaction before advancing. The claim side discovers the unique Cardano state UTxO, rebuilds the parameterized validator, asks the CIP-30 wallet to sign, submits once, and tracks confirmation separately.

Wallet keys remain in their extensions. The reviewer secret is separately provisioned DApp state, and the storage password is supplied only for the active authorization operation. A second approval requires a distinct reviewer identity and separately recovered state.
