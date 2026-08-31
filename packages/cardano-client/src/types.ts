import type { Assets, Script, UTxO } from "@lucid-evolution/lucid";
import type { Hex, PermitV1 } from "@nightpermit/permit";

export type PermitEnvelope = {
  version: 1;
  permitBytes: Hex;
  permitHash: Hex;
  signature: Hex;
  relayPublicKey: Hex;
};

export type PermitPolicyState = {
  midnightContractId: Hex;
  policyId: Hex;
  escrowId: Hex;
  milestoneId: Hex;
  beneficiaryPkh: Hex;
  actionId: Hex;
  assetPolicyId: Hex;
  assetName: Hex;
  amount: bigint;
  cardanoValidatorHash: Hex;
  relayKeyId: Hex;
  relayPublicKey: Hex;
};

export type ValidatorState = {
  version: 1;
  stateThreadPolicyId: Hex;
  stateThreadAssetName: Hex;
  permitPolicy: PermitPolicyState;
  consumedNullifiers: Hex[];
  sequenceNumber: bigint;
};

export type ClaimPlan = {
  beneficiaryAddress: string;
  beneficiaryPkh: Hex;
  claimRedeemer: Hex;
  currentState: ValidatorState;
  nextState: ValidatorState;
  nextStateDatum: Hex;
  payoutDatum: Hex;
  payoutAssets: Assets;
  permit: PermitV1;
  stateAddress: string;
  stateAssets: Assets;
  stateUtxo: UTxO;
  validFromMs: number;
  validToMs: number;
  validator: Script;
};

export type ClaimPlanInput = {
  beneficiaryAddress: string;
  currentSlot: bigint;
  envelope: PermitEnvelope;
  state: ValidatorState;
  stateUtxo: UTxO;
  validator: Script;
  validityWindowSlots?: bigint;
};

export type InitializationPlan = {
  initializationUtxo: UTxO;
  mintRedeemer: Hex;
  stateAddress: string;
  stateAssets: Assets;
  stateDatum: Hex;
  stateTokenUnit: string;
  validator: Script;
};
