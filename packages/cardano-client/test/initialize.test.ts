import { describe, expect, it } from "vitest";
import {
  createInitializationPlan,
  parameterizeValidator,
  STATE_TOKEN_NAME,
  validatorHash,
} from "../src/index.js";
import { fixture, rawValidatorCode, validator } from "./fixtures.js";

describe("state initialization", () => {
  it("mints one state token into a zero-sequence inline state", async () => {
    const input = await fixture();
    const initializationUtxo = {
      txHash: "aa".repeat(32),
      outputIndex: 1,
      address: input.beneficiaryAddress,
      assets: { lovelace: 100_000_000n },
    };
    const plan = createInitializationPlan(
      validator,
      initializationUtxo,
      input.state,
      {
        lovelace: 10_000_000n,
        [input.state.permitPolicy.assetPolicyId + input.state.permitPolicy.assetName]: 50_000_000n,
      },
    );
    expect(plan.stateTokenUnit).toBe(validatorHash(validator) + STATE_TOKEN_NAME);
    expect(plan.stateAssets[plan.stateTokenUnit]).toBe(1n);
    expect(plan.stateDatum).toBe(plan.mintRedeemer);
  });

  it("rejects a nonzero or pre-consumed initial state", async () => {
    const input = await fixture();
    input.state.sequenceNumber = 1n;
    expect(() => createInitializationPlan(
      validator,
      input.stateUtxo,
      input.state,
      { lovelace: 10_000_000n },
    )).toThrowError(expect.objectContaining({ code: "NP_CARDANO_BAD_STATE" }));
  });

  it("parameterization is deterministic and output-reference scoped", () => {
    const first = parameterizeValidator(rawValidatorCode, { txHash: "aa".repeat(32), outputIndex: 0 });
    const repeated = parameterizeValidator(rawValidatorCode, { txHash: "aa".repeat(32), outputIndex: 0 });
    const different = parameterizeValidator(rawValidatorCode, { txHash: "aa".repeat(32), outputIndex: 1 });
    expect(first).toEqual(repeated);
    expect(first.script).not.toBe(different.script);
    expect(validatorHash(first)).not.toBe(validatorHash(different));
  });

  it("rejects a noncanonical initialization reference", () => {
    expect(() => parameterizeValidator(rawValidatorCode, {
      txHash: "AA".repeat(32),
      outputIndex: 0,
    })).toThrow();
  });
});
