import { createServer, type RequestListener } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import { createOgmiosSlotSource } from "../src/ogmios.js";

const servers: ReturnType<typeof createServer>[] = [];

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => new Promise<void>((resolve) => server.close(() => resolve()))));
});

async function endpoint(handler: RequestListener): Promise<URL> {
  const server = createServer(handler);
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  return new URL(`http://127.0.0.1:${(server.address() as AddressInfo).port}`);
}

describe("Ogmios slot source", () => {
  it("reads the current Preview slot from the bounded JSON-RPC method", async () => {
    const url = await endpoint((_request, response) => {
      response.setHeader("content-type", "application/json");
      response.end(JSON.stringify({ jsonrpc: "2.0", id: "nightpermit", result: { slot: 121_500_000 } }));
    });
    await expect(createOgmiosSlotSource({ url, timeoutMs: 100, maxAttempts: 1 }).currentSlot()).resolves.toBe(121_500_000n);
  });

  it("bounds retries and returns a typed unavailable error", async () => {
    let calls = 0;
    const url = await endpoint((_request, response) => {
      calls += 1;
      response.statusCode = 503;
      response.end();
    });
    await expect(createOgmiosSlotSource({ url, timeoutMs: 100, maxAttempts: 2 }).currentSlot()).rejects.toMatchObject({
      code: "NP_RELAY_PROVIDER_UNAVAILABLE",
    });
    expect(calls).toBe(2);
  });
});
