// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { createProductBridge, productConfigFromEnvironment } from "../src/product-bridge.js";

const validEnvironment = {
  VITE_RELAY_PUBLIC_KEY: "09".repeat(32),
  VITE_MIDNIGHT_CONTRACT_ID: "10".repeat(32),
  VITE_MIDNIGHT_ARTIFACT_BASE_URL: "/proof/",
  VITE_CARDANO_KUPO_URL: "http://127.0.0.1:1442",
  VITE_CARDANO_OGMIOS_URL: "http://localhost:1337",
  VITE_CARDANO_VALIDATOR_COMPILED_CODE: "4e4d01000033222220051200120011",
  VITE_CARDANO_INITIALIZATION_TX_HASH: "20".repeat(32),
  VITE_CARDANO_INITIALIZATION_OUTPUT_INDEX: "1",
};

describe("browser product configuration", () => {
  it("parses only public deployment parameters", () => {
    expect(productConfigFromEnvironment(validEnvironment, "https://app.example.test/nightpermit/")).toEqual({
      relayPublicKey: "09".repeat(32),
      midnightContractId: "10".repeat(32),
      midnightArtifactBaseUrl: new URL("https://app.example.test/proof/"),
      cardanoProviders: [{
        name: "primary",
        kupoUrl: "http://127.0.0.1:1442/",
        ogmiosUrl: "http://localhost:1337/",
      }],
      cardanoValidatorCompiledCode: "4e4d01000033222220051200120011",
      cardanoInitializationTxHash: "20".repeat(32),
      cardanoInitializationOutputIndex: 1,
    });
  });

  it("requires a complete secure fallback provider pair", () => {
    expect(() => productConfigFromEnvironment({
      ...validEnvironment,
      VITE_CARDANO_FALLBACK_KUPO_URL: "https://fallback-kupo.example.test",
    }, "https://app.example.test/")).toThrowError(expect.objectContaining({
      code: "NP_WEB_RUNTIME_NOT_CONFIGURED",
    }));
    expect(productConfigFromEnvironment({
      ...validEnvironment,
      VITE_CARDANO_FALLBACK_KUPO_URL: "https://fallback-kupo.example.test",
      VITE_CARDANO_FALLBACK_OGMIOS_URL: "https://fallback-ogmios.example.test",
    }, "https://app.example.test/").cardanoProviders).toHaveLength(2);
  });

  it("rejects missing, malformed, or unsafe deployment parameters", () => {
    expect(() => productConfigFromEnvironment({
      ...validEnvironment,
      VITE_MIDNIGHT_CONTRACT_ID: "AA".repeat(32),
    }, "https://app.example.test/")).toThrowError(expect.objectContaining({ code: "NP_WEB_RUNTIME_NOT_CONFIGURED" }));
    expect(() => productConfigFromEnvironment({
      ...validEnvironment,
      VITE_CARDANO_KUPO_URL: "http://kupo.example.test",
    }, "https://app.example.test/")).toThrowError(expect.objectContaining({ code: "NP_WEB_RUNTIME_NOT_CONFIGURED" }));
    expect(() => productConfigFromEnvironment({
      ...validEnvironment,
      VITE_MIDNIGHT_ARTIFACT_BASE_URL: "https://user:pass@app.example.test/",
    }, "https://app.example.test/")).toThrowError(expect.objectContaining({ code: "NP_WEB_RUNTIME_NOT_CONFIGURED" }));
  });

  it("rejects reviewer credentials before opening any provider connection", async () => {
    const bridge = createProductBridge(productConfigFromEnvironment(
      validEnvironment,
      "https://app.example.test/",
    ));
    await expect(bridge.approve({} as never, {
      privateStoragePassword: "short",
      reviewerSecretHex: "10".repeat(32),
    })).rejects.toMatchObject({ code: "NP_WEB_BAD_STORAGE_PASSWORD" });
    await expect(bridge.approve({} as never, {
      privateStoragePassword: "Correct-Horse-2026",
      reviewerSecretHex: "AA".repeat(32),
    })).rejects.toMatchObject({ code: "NP_WEB_BAD_REVIEWER_SECRET" });
  });

  it("defers Cardano SDK and validator initialization until the claim stage", async () => {
    const bridge = createProductBridge(productConfigFromEnvironment({
      ...validEnvironment,
      VITE_CARDANO_VALIDATOR_COMPILED_CODE: "590100",
    }, "https://app.example.test/"));
    await expect(bridge.claim({} as never, {} as never)).rejects.toMatchObject({
      code: "NP_WEB_RUNTIME_NOT_CONFIGURED",
    });
  });
});
