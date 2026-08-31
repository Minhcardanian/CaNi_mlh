# Attestation relay

The relay converts one confirmed NightPermit authorization on Midnight Preprod into one canonical, signed Cardano Preview permit. It is an explicit trusted attestor, not a bridge verifier.

The only permit request field is `midnightTxId`. The relay resolves that contract-action identifier through the official Midnight indexer provider, decodes the allowlisted contract state, and requires exactly two approvals plus the expected authorization flag. Every policy, escrow, milestone, beneficiary, action, asset, amount, validator, contract, network, and nullifier binding is matched against server-controlled configuration before signing.

The relay reads its Ed25519 seed from a mode-`0600` file. It binds permit validity to the current Cardano slot returned by Ogmios, applies bounded timeouts/retries, coalesces concurrent requests, and stores issued public envelopes atomically so restarts return identical bytes. The stored state contains no signing seed or private reviewer input.

The MVP has one relay key. Rotation is a coordinated deployment change: create a new key ID, update the Cardano state/validator configuration through an explicitly authorized transition or new deployment, then switch the relay policy. Existing permits remain bound to their original key ID; changing a key file alone must never silently change the accepted Cardano authority.

## API

- `GET /health` reports process readiness.
- `POST /v1/permits` accepts `{ "midnightTxId": "<32-byte hex>" }`.
- `GET /v1/permits/<midnightTxId>` returns a previously issued envelope.

The envelope contains canonical permit bytes, Blake2b-256 hash, Ed25519 signature, and relay public key. The permit JSON is not duplicated in transport; clients decode the canonical bytes with `@nightpermit/permit`. Responses and allowlisted JSON logs carry a correlation ID but never include provider payloads, keys, or private state.

Copy `config/relay-policy.example.json` to the ignored `config/relay-policy.json`, supply the values in `.env.example`, build, and run:

```bash
npm run build --workspace=@nightpermit/relay
npm start --workspace=@nightpermit/relay
```
