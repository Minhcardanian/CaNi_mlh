# NightPermit local providers

NightPermit uses a local Cardano Preview node for transaction evaluation and submission. Ogmios provides the node RPC endpoint; Kupo indexes unspent outputs for the Lucid browser client.

The Kupo service is pinned by image digest, binds only to `127.0.0.1:1442`, reads the node socket and configuration through read-only mounts, and writes only to its dedicated database directory. On first start it indexes Shelley-era outputs from the current node tip, which is sufficient when Kupo is started before the NightPermit validator state is initialized.

Set the three `CARDANO_PREVIEW_*_DIR` variables from `.env.example` in a local ignored environment file. Set `CARDANO_PROVIDER_UID` and `CARDANO_PROVIDER_GID` from `id -u` and `id -g`; Kupo runs as that owner while Linux capabilities remain dropped. Then run:

```bash
docker compose --env-file .env -f infra/compose.cardano-providers.yaml up -d
docker compose --env-file .env -f infra/compose.cardano-providers.yaml ps
```

The environment file and Kupo database are local runtime state and must not be committed. A healthy Kupo response must report connection to the configured Preview node before wallet or transaction evidence is collected.
