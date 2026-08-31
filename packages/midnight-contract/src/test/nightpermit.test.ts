import { describe, expect, it } from "vitest";
import { NightPermitSimulator, type DeploymentConfig } from "./simulator.js";
import { pureCircuits } from "../managed/nightpermit/contract/index.js";

const bytes = (value: number, length = 32): Uint8Array => new Uint8Array(length).fill(value);
const reviewerOneSecret = bytes(0x11);
const reviewerTwoSecret = bytes(0x22);
const outsiderSecret = bytes(0x33);

function reviewerKey(secret: Uint8Array): Uint8Array {
  return pureCircuits.reviewerKey(secret);
}

function baseConfig(reviewerOnePublicKey = reviewerKey(reviewerOneSecret), reviewerTwoPublicKey = reviewerKey(reviewerTwoSecret)): DeploymentConfig {
  return {
    policyId: bytes(0x41),
    escrowId: bytes(0x42),
    milestoneId: bytes(0x43),
    beneficiaryPkh: bytes(0x44, 28),
    actionId: bytes(0x48),
    assetPolicyId: bytes(0x45, 28),
    assetName: bytes(0x46),
    amount: 25_000_000n,
    cardanoValidatorHash: bytes(0x47, 28),
    reviewerOnePublicKey,
    reviewerTwoPublicKey,
  };
}

describe("NightPermit Midnight contract", () => {
  it("keeps the milestone unauthorized below the two-reviewer threshold", () => {
    const simulator = new NightPermitSimulator(baseConfig(), reviewerOneSecret);
    const state = simulator.approve();
    expect(state.approvalCount).toBe(1n);
    expect(state.authorized).toBe(false);
    expect(state.authorizationNullifier).toEqual(bytes(0));
  });

  it("authorizes after two distinct eligible reviewers approve", () => {
    const simulator = new NightPermitSimulator(baseConfig(), reviewerOneSecret);
    simulator.approve();
    simulator.setReviewer(reviewerTwoSecret);
    const state = simulator.approve();
    expect(state.approvalCount).toBe(2n);
    expect(state.authorized).toBe(true);
    expect(state.authorizationNullifier).not.toEqual(bytes(0));
  });

  it("rejects an unauthorized reviewer", () => {
    const simulator = new NightPermitSimulator(baseConfig(), outsiderSecret);
    expect(() => simulator.approve()).toThrow(/Reviewer is not authorized/);
  });

  it("rejects a duplicate approval from the same reviewer", () => {
    const simulator = new NightPermitSimulator(baseConfig(), reviewerOneSecret);
    simulator.approve();
    expect(() => simulator.approve()).toThrow(/Reviewer already approved/);
  });

  it("rejects duplicate reviewer identities at deployment", () => {
    const key = reviewerKey(reviewerOneSecret);
    expect(() => new NightPermitSimulator(baseConfig(key, key), reviewerOneSecret)).toThrow(/Reviewers must be distinct/);
  });

  it("does not mutate the public entitlement bindings during approval", () => {
    const config = baseConfig();
    const simulator = new NightPermitSimulator(config, reviewerOneSecret);
    simulator.approve();
    simulator.setReviewer(reviewerTwoSecret);
    const state = simulator.approve();
    expect(state.policyId).toEqual(config.policyId);
    expect(state.escrowId).toEqual(config.escrowId);
    expect(state.milestoneId).toEqual(config.milestoneId);
    expect(state.beneficiaryPkh).toEqual(config.beneficiaryPkh);
    expect(state.actionId).toEqual(config.actionId);
    expect(state.amount).toBe(config.amount);
    expect(state.cardanoValidatorHash).toEqual(config.cardanoValidatorHash);
  });

  it("derives deterministic reviewer nullifiers scoped to milestone and deployment", () => {
    const deployment = bytes(0x51);
    const first = pureCircuits.reviewerNullifier(
      reviewerOneSecret,
      baseConfig().milestoneId,
      deployment,
    );
    expect(
      pureCircuits.reviewerNullifier(reviewerOneSecret, baseConfig().milestoneId, deployment),
    ).toEqual(first);
    expect(
      pureCircuits.reviewerNullifier(reviewerOneSecret, bytes(0x52), deployment),
    ).not.toEqual(first);
    expect(
      pureCircuits.reviewerNullifier(reviewerOneSecret, baseConfig().milestoneId, bytes(0x53)),
    ).not.toEqual(first);
  });

  it("binds the authorization nullifier to the beneficiary and complete payout context", () => {
    const config = baseConfig();
    const deployment = bytes(0x54);
    const authorization = pureCircuits.authorizationId(
      config.policyId,
      config.escrowId,
      config.milestoneId,
      config.beneficiaryPkh,
      config.actionId,
      config.assetPolicyId,
      config.assetName,
      config.amount,
      deployment,
      config.cardanoValidatorHash,
    );
    expect(
      pureCircuits.authorizationId(
        config.policyId,
        config.escrowId,
        config.milestoneId,
        bytes(0x55, 28),
        config.actionId,
        config.assetPolicyId,
        config.assetName,
        config.amount,
        deployment,
        config.cardanoValidatorHash,
      ),
    ).not.toEqual(authorization);
    expect(
      pureCircuits.authorizationId(
        config.policyId,
        config.escrowId,
        config.milestoneId,
        config.beneficiaryPkh,
        config.actionId,
        config.assetPolicyId,
        config.assetName,
        config.amount + 1n,
        deployment,
        config.cardanoValidatorHash,
      ),
    ).not.toEqual(authorization);
  });
});
