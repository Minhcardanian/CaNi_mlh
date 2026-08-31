import { toHex } from "@midnight-ntwrk/midnight-js-utils";
import { pureCircuits } from "@nightpermit/midnight-contract";
import { describe, expect, it } from "vitest";
import { assertReviewerSecret, deploymentArguments, type DeploymentPolicy } from "../src/index.js";

const hex = (byte: string, length = 32) => byte.repeat(length);
const reviewerOneSecret = new Uint8Array(32).fill(0x11);
const reviewerTwoSecret = new Uint8Array(32).fill(0x22);

function policy(): DeploymentPolicy {
  return {
    policyId: hex("41"),
    escrowId: hex("42"),
    milestoneId: hex("43"),
    beneficiaryPkh: hex("44", 28),
    actionId: hex("45"),
    assetPolicyId: hex("46", 28),
    assetName: hex("47"),
    amount: 25_000_000n,
    cardanoValidatorHash: hex("48", 28),
    reviewerOnePublicKey: toHex(pureCircuits.reviewerKey(reviewerOneSecret)),
    reviewerTwoPublicKey: toHex(pureCircuits.reviewerKey(reviewerTwoSecret)),
  };
}

describe("Midnight deployment policy", () => {
  it("produces the exact eleven constructor arguments in protocol order", () => {
    const value = policy();
    const args = deploymentArguments(value);
    expect(args).toHaveLength(11);
    expect(args.map((entry) => entry instanceof Uint8Array ? entry.length : entry)).toEqual([
      32, 32, 32, 28, 32, 28, 32, 25_000_000n, 28, 32, 32,
    ]);
    expect(toHex(args[0])).toBe(value.policyId);
    expect(toHex(args[8])).toBe(value.cardanoValidatorHash);
  });

  it("rejects duplicate reviewers and zero or overflowing tranche amounts", () => {
    const duplicate = policy();
    duplicate.reviewerTwoPublicKey = duplicate.reviewerOnePublicKey;
    expect(() => deploymentArguments(duplicate)).toThrowError(expect.objectContaining({
      code: "NP_MIDNIGHT_BAD_POLICY",
    }));
    const overflow = policy();
    overflow.amount = 18_446_744_073_709_551_616n;
    expect(() => deploymentArguments(overflow)).toThrowError(expect.objectContaining({
      code: "NP_MIDNIGHT_BAD_POLICY",
    }));
    const zero = policy();
    zero.amount = 0n;
    expect(() => deploymentArguments(zero)).toThrowError(expect.objectContaining({
      code: "NP_MIDNIGHT_BAD_POLICY",
    }));
  });

  it("accepts only a configured reviewer secret", () => {
    const args = deploymentArguments(policy());
    expect(() => assertReviewerSecret(reviewerOneSecret, args[9], args[10])).not.toThrow();
    expect(() => assertReviewerSecret(new Uint8Array(32).fill(0x33), args[9], args[10])).toThrowError(
      expect.objectContaining({ code: "NP_MIDNIGHT_BAD_PRIVATE_STATE" }),
    );
  });
});
