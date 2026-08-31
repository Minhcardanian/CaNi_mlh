import { Constr, credentialToAddress, Data } from "@lucid-evolution/lucid";
import { describe, expect, it } from "vitest";
import {
  CardanoClientError,
  createClaimPlan,
  decodeValidatorState,
  encodeValidatorState,
} from "../src/index.js";
import { assetName, assetPolicyId, beneficiaryPkh, currentSlot, fixture } from "./fixtures.js";

async function expectCode(
  mutate: (input: Awaited<ReturnType<typeof fixture>>) => void,
  code: CardanoClientError["code"],
): Promise<void> {
  const input = await fixture();
  mutate(input);
  await expect(createClaimPlan(input)).rejects.toMatchObject({ code });
}

describe("claim planning", () => {
  it("verifies the envelope and produces the exact state transition", async () => {
    const input = await fixture();
    const plan = await createClaimPlan(input);
    expect(plan.nextState.sequenceNumber).toBe(1n);
    expect(plan.nextState.consumedNullifiers).toEqual([plan.permit.nullifier]);
    expect(plan.stateAssets[assetPolicyId + assetName]).toBe(25_000_000n);
    expect(plan.stateAssets.lovelace).toBe(10_000_000n);
    expect(plan.payoutAssets).toEqual({ [assetPolicyId + assetName]: 25_000_000n });
    expect(Data.from(plan.payoutDatum)).toBe(plan.permit.nullifier);
    expect(plan.validFromMs).toBe(1_788_156_000_000);
    expect(plan.validToMs).toBe(1_788_156_120_000);
  });

  it("rejects a tampered relay signature", async () => {
    await expectCode((input) => {
      input.envelope.signature = "00".repeat(64);
    }, "NP_CARDANO_BAD_ENVELOPE");
  });

  it("rejects a wallet other than the signed beneficiary", async () => {
    await expectCode((input) => {
      input.beneficiaryAddress = credentialToAddress("Preview", {
        type: "Key",
        hash: "99".repeat(28),
      });
    }, "NP_CARDANO_WRONG_WALLET");
  });

  it("rejects not-yet-valid and expired permits", async () => {
    await expectCode((input) => {
      input.currentSlot = currentSlot - 11n;
    }, "NP_CARDANO_NOT_YET_VALID");
    await expectCode((input) => {
      input.currentSlot = currentSlot + 601n;
    }, "NP_CARDANO_EXPIRED");
  });

  it("rejects a consumed nullifier", async () => {
    await expectCode((input) => {
      input.state.consumedNullifiers = ["42".repeat(32)];
      input.stateUtxo.datum = null;
    }, "NP_CARDANO_BAD_UTXO");
    await expectCode((input) => {
      input.state.consumedNullifiers = ["42".repeat(32)];
      input.stateUtxo.datum = encodeValidatorState(input.state);
    }, "NP_CARDANO_BAD_STATE");
  });

  it("rejects forged decoded state and insufficient inventory", async () => {
    await expectCode((input) => {
      input.state.permitPolicy.amount += 1n;
    }, "NP_CARDANO_BAD_STATE");
    await expectCode((input) => {
      input.stateUtxo.assets[assetPolicyId + assetName] = 1n;
    }, "NP_CARDANO_BAD_UTXO");
  });

  it("rejects a missing state token and mismatched inline datum", async () => {
    await expectCode((input) => {
      delete input.stateUtxo.assets[input.state.stateThreadPolicyId + input.state.stateThreadAssetName];
    }, "NP_CARDANO_BAD_UTXO");
    await expectCode((input) => {
      input.stateUtxo.datum = "d87980";
    }, "NP_CARDANO_BAD_UTXO");
  });

  it("binds the beneficiary payment key hash exactly", async () => {
    const input = await fixture();
    const plan = await createClaimPlan(input);
    expect(plan.beneficiaryPkh).toBe(beneficiaryPkh);
  });

  it("round trips the live inline validator datum strictly", async () => {
    const input = await fixture();
    expect(decodeValidatorState(encodeValidatorState(input.state))).toEqual(input.state);
    const invalidVersion = Data.to(new Constr(0, [
      2n,
      input.state.stateThreadPolicyId,
      input.state.stateThreadAssetName,
      new Constr(0, []),
      [],
      0n,
    ]));
    expect(() => decodeValidatorState(invalidVersion)).toThrowError(expect.objectContaining({
      code: "NP_CARDANO_BAD_STATE",
    }));
  });
});
