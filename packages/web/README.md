# NightPermit web application

The browser application presents the complete testnet flow in three stages: connect Midnight Preprod and Cardano Preview wallets, collect two private Midnight approvals, then retrieve and claim one relay-signed Cardano permit.

The UI never accepts payout fields from the user. Its state machine advances only from confirmed runtime results, keeps wallet/network context visible, exposes a compact public evidence panel, and maps provider or protocol failures to deterministic messages without serializing raw provider objects.

The application expects `VITE_RELAY_URL` to identify the relay. HTTPS is required except for localhost development. Wallet keys and Midnight reviewer witnesses remain in their respective extensions. The deployed page also supplies a `nightPermitBridge` that binds the generated Midnight contract client and Cardano transaction client to the public deployment configuration.
