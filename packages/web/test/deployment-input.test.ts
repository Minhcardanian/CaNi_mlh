import { describe, expect, it } from "vitest";
import { parsePublicPolicy } from "../src/deployment-input.js";

function source(overrides: Record<string, unknown> = {}) {
  return JSON.stringify({
    policyId: "10".repeat(32),
    escrowId: "11".repeat(32),
    milestoneId: "12".repeat(32),
    beneficiaryPkh: "13".repeat(28),
    actionId: "14".repeat(32),
    assetPolicyId: "15".repeat(28),
    assetName: "16".repeat(4),
    amount: "25000000",
    reviewerOnePublicKey: "17".repeat(32),
    reviewerTwoPublicKey: "18".repeat(32),
    relayKeyId: "19".repeat(32),
    relayPublicKey: "20".repeat(32),
    ...overrides,
  });
}

describe("public deployment input", () => {
  it("converts only the public amount to bigint", () => {
    const parsed = parsePublicPolicy(source());
    expect(parsed.amount).toBe(25_000_000n);
    expect(parsed.policyId).toBe("10".repeat(32));
  });

  it("rejects secret-like extra fields and noncanonical amounts", () => {
    expect(() => parsePublicPolicy(source({ privateKey: "do-not-accept" }))).toThrow("unexpected field");
    expect(() => parsePublicPolicy(source({ amount: 25_000_000 }))).toThrow("positive integer string");
    expect(() => parsePublicPolicy(source({ amount: "01" }))).toThrow("positive integer string");
  });
});
