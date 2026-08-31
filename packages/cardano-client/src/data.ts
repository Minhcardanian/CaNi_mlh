import { Constr, Data, type Script } from "@lucid-evolution/lucid";
import type { PermitPolicyState, ValidatorState } from "./types.js";

function policyData(policy: PermitPolicyState): Constr<ReturnType<typeof asData>> {
  return new Constr(0, [
    policy.midnightContractId,
    policy.policyId,
    policy.escrowId,
    policy.milestoneId,
    policy.beneficiaryPkh,
    policy.actionId,
    policy.assetPolicyId,
    policy.assetName,
    policy.amount,
    policy.cardanoValidatorHash,
    policy.relayKeyId,
    policy.relayPublicKey,
  ]);
}

function asData(value: string | bigint): string | bigint {
  return value;
}

export function encodeValidatorState(state: ValidatorState): string {
  return Data.to(
    new Constr(0, [
      BigInt(state.version),
      state.stateThreadPolicyId,
      state.stateThreadAssetName,
      policyData(state.permitPolicy),
      state.consumedNullifiers,
      state.sequenceNumber,
    ]),
  );
}

export function encodeClaimRedeemer(permitBytes: string, signature: string): string {
  return Data.to(new Constr(0, [permitBytes, signature]));
}

export function encodeNullifierDatum(nullifier: string): string {
  return Data.to(nullifier);
}

export function encodeOutputReference(txHash: string, outputIndex: number): Constr<string | bigint> {
  return new Constr(0, [txHash, BigInt(outputIndex)]);
}

export function assertPlutusV3(script: Script): void {
  if (script.type !== "PlutusV3" || !/^[0-9a-f]+$/.test(script.script)) {
    throw new TypeError("validator must contain lowercase hexadecimal Plutus V3 CBOR");
  }
}
