import { describe, expect, it } from "vitest";
import {
  browserEnvironment,
  finalizeDeployment,
  prepareDeployment,
  relayPublicEnvironment,
  relayPolicyDocument,
  type DeploymentInputs,
} from "../src/index.js";

const hex = (byte: string, length = 32) => byte.repeat(length);

function inputs(): DeploymentInputs {
  return {
    policyId: hex("10"),
    escrowId: hex("11"),
    milestoneId: hex("12"),
    beneficiaryPkh: hex("13", 28),
    actionId: hex("14"),
    assetPolicyId: hex("15", 28),
    assetName: hex("16"),
    amount: 25_000_000n,
    reviewerOnePublicKey: hex("17"),
    reviewerTwoPublicKey: hex("18"),
    relayKeyId: hex("19"),
    relayPublicKey: hex("20"),
    validatorCompiledCode: "4e4d01000033222220051200120011",
    initializationRef: { txHash: hex("21"), outputIndex: 1 },
  };
}

describe("public deployment plan", () => {
  it("derives one validator binding for Midnight, Cardano, relay, and browser configuration", () => {
    const prepared = prepareDeployment(inputs());
    expect(prepared.midnightPolicy.cardanoValidatorHash).toBe(prepared.validatorHash);
    expect(prepared.validatorAddress).toMatch(/^addr_test1/);
    const finalized = finalizeDeployment(prepared, hex("22"));
    expect(finalized.initialCardanoState.permitPolicy.cardanoValidatorHash).toBe(prepared.validatorHash);
    expect(finalized.initialCardanoState.permitPolicy.midnightContractId).toBe(hex("22"));
    expect(relayPolicyDocument(finalized).policies[0]).toMatchObject({
      policyId: inputs().policyId,
      amount: "25000000",
      cardanoValidatorHash: prepared.validatorHash,
    });
    expect(relayPublicEnvironment(finalized, {
      midnightIndexerUrl: "https://indexer.example.test/graphql",
      midnightIndexerWsUrl: "wss://indexer.example.test/graphql/ws",
      cardanoOgmiosUrl: "http://127.0.0.1:1337",
    })).toMatchObject({
      MIDNIGHT_CONTRACT_ID: hex("22"),
      RELAY_KEY_ID: inputs().relayKeyId,
      RELAY_PUBLIC_KEY: inputs().relayPublicKey,
    });
    expect(browserEnvironment(finalized, {
      relayUrl: "http://127.0.0.1:8787",
      midnightArtifactBaseUrl: "http://127.0.0.1:4173/",
      cardanoKupoUrl: "http://127.0.0.1:1442",
      cardanoOgmiosUrl: "http://127.0.0.1:1337",
      cardanoFallbackKupoUrl: "https://kupo.example.test",
      cardanoFallbackOgmiosUrl: "https://ogmios.example.test",
    })).toMatchObject({
      VITE_MIDNIGHT_CONTRACT_ID: hex("22"),
      VITE_RELAY_PUBLIC_KEY: hex("20"),
      VITE_CARDANO_INITIALIZATION_TX_HASH: hex("21"),
      VITE_CARDANO_INITIALIZATION_OUTPUT_INDEX: "1",
      VITE_CARDANO_FALLBACK_KUPO_URL: "https://kupo.example.test",
    });
  });

  it("rejects malformed keys, duplicate reviewers, and malformed contract identifiers", () => {
    expect(() => prepareDeployment({ ...inputs(), relayPublicKey: hex("AA") })).toThrow();
    const duplicate = inputs();
    duplicate.reviewerTwoPublicKey = duplicate.reviewerOnePublicKey;
    expect(() => prepareDeployment(duplicate)).toThrowError(expect.objectContaining({
      code: "NP_MIDNIGHT_BAD_POLICY",
    }));
    expect(() => finalizeDeployment(prepareDeployment(inputs()), hex("22", 31))).toThrow();
  });

  it("keeps the reviewed plan stable when caller-owned inputs are later mutated", () => {
    const mutable = inputs();
    const prepared = prepareDeployment(mutable);
    mutable.policyId = hex("ff");
    mutable.initializationRef.txHash = hex("ee");
    expect(prepared.inputs.policyId).toBe(hex("10"));
    expect(prepared.inputs.initializationRef.txHash).toBe(hex("21"));
    expect(prepared.midnightPolicy.policyId).toBe(hex("10"));
  });
});
