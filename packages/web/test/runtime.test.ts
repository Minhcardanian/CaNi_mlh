// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { createBrowserRuntime, relayUrl } from "../src/runtime.js";

afterEach(() => {
  vi.restoreAllMocks();
  delete window.midnight;
  window.cardano = {} as never;
  delete window.nightPermitBridge;
});

describe("browser runtime", () => {
  it("accepts HTTPS or local HTTP relay URLs and rejects unsafe transport metadata", () => {
    expect(relayUrl("https://relay.example.test").origin).toBe("https://relay.example.test");
    expect(relayUrl("http://127.0.0.1:8787").port).toBe("8787");
    expect(() => relayUrl("http://relay.example.test")).toThrowError(expect.objectContaining({
      code: "NP_WEB_RUNTIME_NOT_CONFIGURED",
    }));
    expect(() => relayUrl("https://user:pass@relay.example.test")).toThrow();
  });

  it("connects compatible Midnight and Cardano Preview wallets", async () => {
    window.midnight = {
      lace: {
        apiVersion: "4.0.1",
        name: "Lace",
        connect: vi.fn(async () => ({ getConnectionStatus: async () => ({ status: "connected" }) })),
      },
    };
    const address = "addr_test1vq6rgdp5xs6rgdp5xs6rgdp5xs6rgdp5xs6rgdp5xs6rgdq6smfkn";
    const addressHex = `60${"34".repeat(28)}`;
    window.cardano = {
      eternl: {
        name: "Eternl",
        icon: "",
        apiVersion: "1.0.0",
        isEnabled: async () => true,
        enable: vi.fn(async () => ({
          getNetworkId: async () => 0,
          getChangeAddress: async () => addressHex,
        })) as never,
      },
    };
    const runtime = createBrowserRuntime(new URL("http://127.0.0.1:8787"));
    await expect(runtime.connectMidnight()).resolves.toMatchObject({ network: "Midnight Preprod" });
    await expect(runtime.connectCardano("eternl")).resolves.toMatchObject({
      network: "Cardano Preview",
      address,
    });
  });

  it("rejects a mainnet Cardano wallet", async () => {
    window.cardano = {
      lace: {
        name: "Lace",
        icon: "",
        apiVersion: "1.0.0",
        isEnabled: async () => true,
        enable: vi.fn(async () => ({ getNetworkId: async () => 1 })) as never,
      },
    };
    const runtime = createBrowserRuntime(new URL("http://127.0.0.1:8787"));
    await expect(runtime.connectCardano()).rejects.toMatchObject({ code: "NP_WEB_WRONG_CARDANO_NETWORK" });
  });

  it("rejects a wallet whose change address contradicts the Preview network", async () => {
    window.cardano = {
      lace: {
        name: "Lace",
        icon: "",
        apiVersion: "1.0.0",
        isEnabled: async () => true,
        enable: vi.fn(async () => ({
          getNetworkId: async () => 0,
          getChangeAddress: async () => `61${"34".repeat(28)}`,
        })) as never,
      },
    };
    const runtime = createBrowserRuntime(new URL("http://127.0.0.1:8787"));
    await expect(runtime.connectCardano()).rejects.toMatchObject({ code: "NP_WEB_WRONG_CARDANO_NETWORK" });
  });

  it("parses a strict relay response without logging provider payloads", async () => {
    const permit = {
      version: 1,
      permitBytes: "01",
      permitHash: "02".repeat(32),
      signature: "03".repeat(64),
      relayPublicKey: "04".repeat(32),
    };
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({
      correlationId: "correlation-01",
      permit,
    }), { status: 200, headers: { "content-type": "application/json" } })));
    const runtime = createBrowserRuntime(new URL("http://127.0.0.1:8787"));
    await expect(runtime.getPermit("20".repeat(32))).resolves.toEqual({
      correlationId: "correlation-01",
      permit,
    });
  });
});
