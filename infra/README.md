# NightPermit local providers

NightPermit uses a local Cardano Preview node for transaction evaluation and submission. Ogmios provides the node RPC endpoint; Kupo indexes unspent outputs for the Lucid browser client.

The Kupo service is pinned by image digest, binds only to `127.0.0.1:1442`, reads the node socket and configuration through read-only mounts, and writes only to its dedicated database directory. On first start it indexes Shelley-era outputs from the current node tip, which is sufficient when Kupo is started before the NightPermit validator state is initialized.

Set the three `CARDANO_PREVIEW_*_DIR` variables from `.env.example` in a local ignored environment file. Set `CARDANO_PROVIDER_UID` and `CARDANO_PROVIDER_GID` from `id -u` and `id -g`; Kupo runs as that owner while Linux capabilities remain dropped. Then run:

```bash
docker compose --env-file .env -f infra/compose.cardano-providers.yaml up -d
docker compose --env-file .env -f infra/compose.cardano-providers.yaml ps
```

The environment file and Kupo database are local runtime state and must not be committed. A healthy Kupo response must report connection to the configured Preview node before wallet or transaction evidence is collected.

Run the bounded product-provider readiness check after the services start:

```bash
npm run readiness -- --providers
```

This verifies the proof server, Midnight Preprod RPC and indexer, Kupo, Ogmios, and exact Kupo/Ogmios tip agreement. The full check also requires a configured running relay:

```bash
npm run readiness
```

Use bounded polling when measuring startup or recovery. The command exits successfully only when the complete selected scope is ready before the deadline and reports the attempt count plus recovery time:

```bash
npm run readiness -- --providers --wait-ms=30000 --interval-ms=1000
```

Wait deadlines are limited to 120 seconds and polling intervals to 50-5000 milliseconds. Each individual request retains its own bounded timeout, and failed provider payloads are never included in the report.

The browser accepts an optional second Kupo/Ogmios pair through `VITE_CARDANO_FALLBACK_KUPO_URL` and `VITE_CARDANO_FALLBACK_OGMIOS_URL`. Both values are required together. A remote pair must use HTTPS, expose no embedded credential, and implement the same Preview Kupmios interfaces. Failover happens only before wallet transaction construction; NightPermit never automatically retries a signature or submission against another provider.
