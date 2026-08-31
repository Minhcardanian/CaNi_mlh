import { loadConfig } from "./config.js";
import { createMidnightAuthorizationSource } from "./midnight.js";
import { createOgmiosSlotSource } from "./ogmios.js";
import { createRelayServer } from "./server.js";
import { PermitService } from "./service.js";
import { FilePermitStore } from "./store.js";

const config = await loadConfig();
const service = new PermitService(
  config,
  createMidnightAuthorizationSource({
    indexerUrl: config.midnightIndexerUrl,
    indexerWsUrl: config.midnightIndexerWsUrl,
    contractId: config.midnightContractId,
    timeoutMs: config.providerTimeoutMs,
    maxAttempts: config.providerMaxAttempts,
  }),
  createOgmiosSlotSource({
    url: config.ogmiosUrl,
    timeoutMs: config.providerTimeoutMs,
    maxAttempts: config.providerMaxAttempts,
  }),
  new FilePermitStore(config.relayStateFile),
);
const server = createRelayServer(service);
server.listen(config.port, config.host, () => {
  process.stdout.write(
    `${JSON.stringify({ level: "info", event: "relay_started", host: config.host, port: config.port })}\n`,
  );
});
