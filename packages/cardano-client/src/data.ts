import { Constr, Data, type Script } from "@lucid-evolution/lucid";
import { CardanoClientError } from "./errors.js";
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

function badDatum(message: string): never {
  throw new CardanoClientError("NP_CARDANO_BAD_STATE", message);
}

function asConstr(value: unknown, fields: number, name: string): Constr<unknown> {
  if (!(value instanceof Constr) || value.index !== 0 || value.fields.length !== fields) {
    return badDatum(`${name} datum must be constructor 0 with ${fields} fields`);
  }
  return value;
}

function asHex(value: unknown, bytes: number | [number, number], name: string): string {
  if (typeof value !== "string" || !/^[0-9a-f]*$/.test(value)) {
    return badDatum(`${name} must be lowercase hexadecimal bytes`);
  }
  const length = value.length / 2;
  const [minimum, maximum] = typeof bytes === "number" ? [bytes, bytes] : bytes;
  if (value.length % 2 !== 0 || length < minimum || length > maximum) {
    return badDatum(`${name} has an invalid byte length`);
  }
  return value;
}

function asInteger(value: unknown, name: string): bigint {
  if (typeof value !== "bigint" || value < 0n) return badDatum(`${name} must be a non-negative integer`);
  return value;
}

export function decodeValidatorState(datum: string): ValidatorState {
  let decoded: unknown;
  try {
    decoded = Data.from(datum);
  } catch (cause) {
    throw new CardanoClientError("NP_CARDANO_BAD_STATE", "state datum is not valid Plutus data", { cause });
  }
  const state = asConstr(decoded, 6, "state");
  const policy = asConstr(state.fields[3], 12, "permit policy");
  const nullifiers = state.fields[4];
  if (!Array.isArray(nullifiers)) return badDatum("consumed nullifiers must be a list");
  const version = asInteger(state.fields[0], "state version");
  if (version !== 1n) return badDatum("state version is unsupported");
  return {
    version: 1,
    stateThreadPolicyId: asHex(state.fields[1], 28, "state thread policy ID"),
    stateThreadAssetName: asHex(state.fields[2], [0, 32], "state thread asset name"),
    permitPolicy: {
      midnightContractId: asHex(policy.fields[0], 32, "Midnight contract ID"),
      policyId: asHex(policy.fields[1], 32, "policy ID"),
      escrowId: asHex(policy.fields[2], 32, "escrow ID"),
      milestoneId: asHex(policy.fields[3], 32, "milestone ID"),
      beneficiaryPkh: asHex(policy.fields[4], 28, "beneficiary payment key hash"),
      actionId: asHex(policy.fields[5], 32, "action ID"),
      assetPolicyId: asHex(policy.fields[6], [0, 28], "asset policy ID"),
      assetName: asHex(policy.fields[7], [0, 32], "asset name"),
      amount: asInteger(policy.fields[8], "entitlement amount"),
      cardanoValidatorHash: asHex(policy.fields[9], 28, "Cardano validator hash"),
      relayKeyId: asHex(policy.fields[10], 32, "relay key ID"),
      relayPublicKey: asHex(policy.fields[11], 32, "relay public key"),
    },
    consumedNullifiers: nullifiers.map((value, index) => asHex(value, 32, `nullifier ${index}`)),
    sequenceNumber: asInteger(state.fields[5], "state sequence number"),
  };
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
