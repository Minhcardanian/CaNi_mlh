import { readFileSync } from "node:fs";
import {
  credentialToAddress,
  type Script,
  type UTxO,
  validatorToAddress,
} from "@lucid-evolution/lucid";
import {
  getRelayPublicKey,
  signPermit,
  type PermitV1,
} from "@nightpermit/permit";
import {
  encodeValidatorState,
  parameterizeValidator,
  STATE_TOKEN_NAME,
  validatorHash,
  type ClaimPlanInput,
  type PermitEnvelope,
  type ValidatorState,
} from "../src/index.js";

const blueprint = JSON.parse(
  readFileSync(new URL("../../../contracts/cardano/plutus.json", import.meta.url), "utf8"),
) as { validators: Array<{ title: string; compiledCode: string }> };

const rawValidator = blueprint.validators.find(
  ({ title }) => title === "nightpermit.nightpermit.spend",
);
if (!rawValidator) throw new Error("NightPermit validator is missing from plutus.json");
export const rawValidatorCode = rawValidator.compiledCode;

export const signingSeed = "10".repeat(32);
export const beneficiaryPkh = "34".repeat(28);
export const assetPolicyId = "36".repeat(28);
export const assetName = "37".repeat(16);
export const currentSlot = 121_500_000n;
export const validator: Script = parameterizeValidator(rawValidatorCode, {
  txHash: "aa".repeat(32),
  outputIndex: 1,
});
export const scriptHash = validatorHash(validator);
export const beneficiaryAddress = credentialToAddress("Preview", {
  type: "Key",
  hash: beneficiaryPkh,
});

export async function fixture(): Promise<ClaimPlanInput> {
  const relayPublicKey = await getRelayPublicKey(signingSeed);
  const permit: PermitV1 = {
    version: 1,
    domain: "nightpermit/cardano-preview/v1",
    midnightNetwork: "preprod",
    midnightContractId: "40".repeat(32),
    midnightTxId: "20".repeat(32),
    authorizationIndex: 0,
    policyId: "31".repeat(32),
    escrowId: "32".repeat(32),
    milestoneId: "33".repeat(32),
    beneficiaryPkh,
    actionId: "35".repeat(32),
    entitlement: {
      policyId: "31".repeat(32),
      escrowId: "32".repeat(32),
      milestoneId: "33".repeat(32),
      assetPolicyId,
      assetName,
      amount: 25_000_000n,
    },
    nullifier: "42".repeat(32),
    notBeforeSlot: currentSlot - 10n,
    expiresAtSlot: currentSlot + 600n,
    cardanoValidatorHash: scriptHash,
    relayKeyId: "41".repeat(32),
  };
  const signed = await signPermit(permit, signingSeed);
  const envelope: PermitEnvelope = {
    version: 1,
    permitBytes: signed.permitBytes,
    permitHash: signed.permitHash,
    signature: signed.signature,
    relayPublicKey,
  };
  const state: ValidatorState = {
    version: 1,
    stateThreadPolicyId: scriptHash,
    stateThreadAssetName: STATE_TOKEN_NAME,
    permitPolicy: {
      midnightContractId: permit.midnightContractId,
      policyId: permit.policyId,
      escrowId: permit.escrowId,
      milestoneId: permit.milestoneId,
      beneficiaryPkh,
      actionId: permit.actionId,
      assetPolicyId,
      assetName,
      amount: permit.entitlement.amount,
      cardanoValidatorHash: scriptHash,
      relayKeyId: permit.relayKeyId,
      relayPublicKey,
    },
    consumedNullifiers: [],
    sequenceNumber: 0n,
  };
  const stateUtxo: UTxO = {
    txHash: "bb".repeat(32),
    outputIndex: 0,
    address: validatorToAddress("Preview", validator),
    assets: {
      lovelace: 10_000_000n,
      [scriptHash + STATE_TOKEN_NAME]: 1n,
      [assetPolicyId + assetName]: 50_000_000n,
    },
    datum: encodeValidatorState(state),
  };
  return {
    beneficiaryAddress,
    currentSlot,
    envelope,
    state,
    stateUtxo,
    validator,
  };
}
