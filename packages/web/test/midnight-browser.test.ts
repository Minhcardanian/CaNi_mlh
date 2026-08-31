// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { createMidnightBrowserProviders } from "../src/midnight-browser.js";
import { secureProviderEndpoint } from "../src/provider-url.js";

describe("Midnight browser providers", () => {
  it("accepts secure or local provider endpoints and rejects unsafe metadata", () => {
    expect(secureProviderEndpoint("https://indexer.example.test/graphql")).toBe(
      "https://indexer.example.test/graphql",
    );
    expect(secureProviderEndpoint("ws://127.0.0.1:8080/graphql", true)).toBe(
      "ws://127.0.0.1:8080/graphql",
    );
    expect(() => secureProviderEndpoint("http://indexer.example.test")).toThrowError(
      expect.objectContaining({ code: "NP_WEB_RUNTIME_NOT_CONFIGURED" }),
    );
    expect(() => secureProviderEndpoint("https://user:pass@indexer.example.test")).toThrow();
    expect(() => secureProviderEndpoint("wss://indexer.example.test/#fragment", true)).toThrow();
  });

  it("fails closed before provider storage is opened when wallet configuration is not Preprod", async () => {
    const hintUsage = vi.fn(async () => undefined);
    const connectedApi = {
      hintUsage,
      getConnectionStatus: async () => ({ status: "connected", networkId: "preprod" }),
      getConfiguration: async () => ({
        networkId: "mainnet",
        indexerUri: "https://indexer.example.test/graphql",
        indexerWsUri: "wss://indexer.example.test/graphql/ws",
      }),
      getShieldedAddresses: async () => ({
        shieldedCoinPublicKey: "coin-key",
        shieldedEncryptionPublicKey: "encryption-key",
      }),
    };
    await expect(createMidnightBrowserProviders(connectedApi as never, {
      artifactBaseUrl: new URL("https://app.example.test/"),
      privateStoragePasswordProvider: () => "local-only",
    })).rejects.toMatchObject({ code: "NP_WEB_WRONG_MIDNIGHT_NETWORK" });
    expect(hintUsage).toHaveBeenCalledWith([
      "getShieldedAddresses",
      "getConfiguration",
      "getConnectionStatus",
      "getProvingProvider",
      "balanceUnsealedTransaction",
      "submitTransaction",
    ]);
  });
});
