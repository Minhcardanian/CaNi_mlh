# NightPermit Cardano validator

The Cardano Preview component consumes the same Permit V1 bytes and Ed25519 vectors as the TypeScript protocol package. Its spending validator controls a single escrow state UTxO identified by a state-thread token.

For a claim to succeed, the validator requires:

- one state-thread input and one continuing state-thread output at the same script address;
- an unchanged policy, relay key, network/deployment binding, escrow, milestone, beneficiary, and entitlement configuration;
- an accepted relay signature over the exact canonical Permit V1 bytes;
- the beneficiary payment key hash in the transaction's required signers;
- a finite transaction validity range inside the permit's Preview slot window;
- a nullifier absent from the input state and prepended exactly once to the output state;
- the sequence number incremented by one;
- one beneficiary output tagged by the nullifier with the exact permitted asset amount; and
- an escrow-state value decrease equal to exactly that tranche, with unrelated state assets conserved.

Preview slots are converted to POSIX milliseconds from the Preview Shelley genesis (`2022-10-25T00:00:00Z`, one-second slots) before comparison with the Plutus validity interval.

## Build and test

```bash
aiken fmt --check
aiken check -D
aiken build
```

The project pins Aiken `1.1.13`, Plutus V3, and `aiken-lang/stdlib` `2.2.1`. `aiken build` generates `plutus.json` locally; the blueprint is not committed because it is reproducible from pinned source and tool versions.

The validator is testnet-only. It does not make the relay trustless, directly verify a Midnight proof, mint the state-thread token, or provide transaction-building and deployment infrastructure.
