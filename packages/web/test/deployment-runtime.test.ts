import { describe, expect, it } from "vitest";
import { createDeploymentRuntime } from "../src/deployment-runtime.js";

const base = {
  validatorCompiledCode: "4e4d01000033222220051200120011",
  midnightArtifactBaseUrl: new URL("http://127.0.0.1:4173/"),
  cardanoKupoUrl: "http://127.0.0.1:1442",
  cardanoOgmiosUrl: "http://127.0.0.1:1337",
  relayUrl: "http://127.0.0.1:8787",
};

describe("deployment runtime configuration", () => {
  it("accepts local operator providers", () => {
    expect(createDeploymentRuntime(base)).toBeTruthy();
  });

  it("rejects plaintext remote providers before a wallet is requested", () => {
    expect(() => createDeploymentRuntime({ ...base, cardanoKupoUrl: "http://kupo.example.test" }))
      .toThrowError(expect.objectContaining({ code: "NP_WEB_RUNTIME_NOT_CONFIGURED" }));
    expect(() => createDeploymentRuntime({ ...base, relayUrl: "https://user:pass@relay.example.test" }))
      .toThrowError(expect.objectContaining({ code: "NP_WEB_RUNTIME_NOT_CONFIGURED" }));
  });
});
