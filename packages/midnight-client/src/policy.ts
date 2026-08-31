import { fromHex } from "@midnight-ntwrk/midnight-js-protocol/compact-runtime";
import { pureCircuits } from "@nightpermit/midnight-contract";
import { MidnightClientError } from "./errors.js";
import type { DeploymentPolicy } from "./types.js";

function bytes(value: string, length: number, name: string): Uint8Array {
  if (!/^[0-9a-f]+$/.test(value) || value.length !== length * 2) {
    throw new MidnightClientError("NP_MIDNIGHT_BAD_POLICY", `${name} must contain ${length} lowercase hexadecimal bytes`);
  }
  return fromHex(value);
}

function equal(left: Uint8Array, right: Uint8Array): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

export function deploymentArguments(policy: DeploymentPolicy): [
  Uint8Array, Uint8Array, Uint8Array, Uint8Array, Uint8Array, Uint8Array,
  Uint8Array, bigint, Uint8Array, Uint8Array, Uint8Array,
] {
  if (policy.amount < 1n || policy.amount > 18_446_744_073_709_551_615n) {
    throw new MidnightClientError("NP_MIDNIGHT_BAD_POLICY", "amount must be a nonzero unsigned 64-bit integer");
  }
  const reviewerOne = bytes(policy.reviewerOnePublicKey, 32, "reviewer one public key");
  const reviewerTwo = bytes(policy.reviewerTwoPublicKey, 32, "reviewer two public key");
  if (equal(reviewerOne, reviewerTwo)) {
    throw new MidnightClientError("NP_MIDNIGHT_BAD_POLICY", "reviewer public keys must be distinct");
  }
  return [
    bytes(policy.policyId, 32, "policy ID"),
    bytes(policy.escrowId, 32, "escrow ID"),
    bytes(policy.milestoneId, 32, "milestone ID"),
    bytes(policy.beneficiaryPkh, 28, "beneficiary payment key hash"),
    bytes(policy.actionId, 32, "action ID"),
    bytes(policy.assetPolicyId, 28, "asset policy ID"),
    bytes(policy.assetName, 32, "asset name"),
    policy.amount,
    bytes(policy.cardanoValidatorHash, 28, "Cardano validator hash"),
    reviewerOne,
    reviewerTwo,
  ];
}

export function assertReviewerSecret(secret: Uint8Array, reviewerOne: Uint8Array, reviewerTwo: Uint8Array): void {
  if (secret.length !== 32) {
    throw new MidnightClientError("NP_MIDNIGHT_BAD_PRIVATE_STATE", "reviewer secret must contain 32 bytes");
  }
  const commitment = pureCircuits.reviewerKey(secret);
  if (!equal(commitment, reviewerOne) && !equal(commitment, reviewerTwo)) {
    throw new MidnightClientError("NP_MIDNIGHT_BAD_PRIVATE_STATE", "reviewer secret is not authorized by this contract");
  }
}
