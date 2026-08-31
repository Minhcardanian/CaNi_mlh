import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import type { RelayLogger } from "../src/logger.js";
import { createRelayServer } from "../src/server.js";
import { PermitService } from "../src/service.js";
import { config, sources, transactionId } from "./fixtures.js";

const servers: ReturnType<typeof createRelayServer>[] = [];

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => new Promise<void>((resolve) => server.close(() => resolve()))));
});

async function start(service: PermitService, logger?: RelayLogger): Promise<string> {
  const server = createRelayServer(service, logger);
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address() as AddressInfo;
  return `http://127.0.0.1:${address.port}`;
}

describe("relay HTTP API", () => {
  it("serves health, issues a permit, and supports idempotent lookup", async () => {
    const source = sources();
    const baseUrl = await start(new PermitService(config, source.authorizationSource, source.slotSource));
    const health = await fetch(`${baseUrl}/health`);
    expect(await health.json()).toEqual({ status: "ok", service: "nightpermit-relay", version: 1 });

    const issued = await fetch(`${baseUrl}/v1/permits`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-correlation-id": "test-correlation-01" },
      body: JSON.stringify({ midnightTxId: transactionId }),
    });
    expect(issued.status).toBe(200);
    expect(issued.headers.get("x-correlation-id")).toBe("test-correlation-01");
    const issuedBody = (await issued.json()) as { permit: unknown };

    const fetched = await fetch(`${baseUrl}/v1/permits/${transactionId}`);
    expect(fetched.status).toBe(200);
    const fetchedBody = (await fetched.json()) as { permit: unknown };
    expect(fetchedBody.permit).toEqual(issuedBody.permit);
  });

  it("does not expose provider errors or secret canaries in responses or logs", async () => {
    const canary = "NP_SECRET_CANARY_DO_NOT_LOG";
    const events: unknown[] = [];
    const baseUrl = await start(
      new PermitService(
        config,
        { async readAtTransaction() { throw new Error(canary); } },
        sources().slotSource,
      ),
      { write(event) { events.push(event); } },
    );
    const response = await fetch(`${baseUrl}/v1/permits`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ midnightTxId: transactionId }),
    });
    const serialized = JSON.stringify({ body: await response.json(), events });
    expect(response.status).toBe(500);
    expect(serialized).not.toContain(canary);
    expect(serialized).not.toContain(config.relaySigningSeed);
  });

  it("rejects oversized and malformed requests", async () => {
    const source = sources();
    const baseUrl = await start(new PermitService(config, source.authorizationSource, source.slotSource));
    const oversized = await fetch(`${baseUrl}/v1/permits`, {
      method: "POST",
      body: JSON.stringify({ midnightTxId: transactionId, padding: "x".repeat(2_100) }),
    });
    expect(oversized.status).toBe(413);

    const malformed = await fetch(`${baseUrl}/v1/permits`, { method: "POST", body: "{" });
    expect(malformed.status).toBe(400);
  });
});
