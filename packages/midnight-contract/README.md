# Midnight authorization contract

This Compact contract is the private approval side of NightPermit. One deployment fixes a single policy, escrow, milestone, beneficiary, action, Cardano asset tranche, Cardano validator, and two distinct reviewer commitments.

Each reviewer supplies a 32-byte secret through a local witness. The circuit reveals only whether the derived reviewer commitment is eligible; it does not write the secret or the selected reviewer commitment to ledger state. A domain-separated reviewer nullifier prevents the same reviewer from approving twice. The second distinct approval publishes one authorization nullifier bound to the entire payout context.

The generated bindings and proving/verifying material under `src/managed/nightpermit` are produced by Compact compiler `0.31.0` for Compact runtime `0.16.0`:

```bash
npm run compile --workspace=@nightpermit/midnight-contract
npm run check --workspace=@nightpermit/midnight-contract
npm test --workspace=@nightpermit/midnight-contract
```

Deployment and real proving require the configured Midnight Preprod wallet and local proof server. Reviewer secrets remain wallet-local private state and must never be passed to the relay.
