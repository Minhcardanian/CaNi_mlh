import { describe, expect, it } from "vitest";
import {
  encodePermit,
  getRelayPublicKey,
  signPermit,
  verifyPermitSignature,
} from "../src/index.js";
import type { PermitV1 } from "../src/index.js";
import { ordinaryPermit } from "./fixtures.js";

const TEST_SIGNING_SEED_HEX =
  "000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f";

describe("PermitV1 Ed25519 envelope", () => {
  it("signs the exact canonical bytes and verifies them", async () => {
    const signed = await signPermit(ordinaryPermit, TEST_SIGNING_SEED_HEX);
    const publicKey = await getRelayPublicKey(TEST_SIGNING_SEED_HEX);

    expect(signed.permitBytes).toBe(Buffer.from(encodePermit(ordinaryPermit)).toString("hex"));
    await expect(
      verifyPermitSignature(encodePermit(ordinaryPermit), signed.signature, publicKey),
    ).resolves.toBe(true);
  });

  it("fails closed for a malformed relay public key", async () => {
    const signed = await signPermit(ordinaryPermit, TEST_SIGNING_SEED_HEX);

    await expect(
      verifyPermitSignature(encodePermit(ordinaryPermit), signed.signature, "ff".repeat(32)),
    ).resolves.toBe(false);
  });

  it.each([
    ["midnightContractId", { midnightContractId: "12".repeat(32) }],
    ["midnightTxId", { midnightTxId: "23".repeat(32) }],
    ["authorizationIndex", { authorizationIndex: 8 }],
    ["beneficiaryPkh", { beneficiaryPkh: "67".repeat(28) }],
    ["actionId", { actionId: "78".repeat(32) }],
    ["nullifier", { nullifier: "89".repeat(32) }],
    ["notBeforeSlot", { notBeforeSlot: 121_500_001n }],
    ["expiresAtSlot", { expiresAtSlot: 121_503_601n }],
    ["cardanoValidatorHash", { cardanoValidatorHash: "9a".repeat(28) }],
    ["relayKeyId", { relayKeyId: "ab".repeat(32) }],
  ] as const)("rejects a signature after %s changes", async (_fieldName, mutation) => {
    const signed = await signPermit(ordinaryPermit, TEST_SIGNING_SEED_HEX);
    const publicKey = await getRelayPublicKey(TEST_SIGNING_SEED_HEX);
    const mutated = { ...ordinaryPermit, ...mutation } as PermitV1;

    await expect(
      verifyPermitSignature(encodePermit(mutated), signed.signature, publicKey),
    ).resolves.toBe(false);
  });

  it.each([
    ["asset policy", { assetPolicyId: "bc".repeat(28) }],
    ["asset name", { assetName: "4e50" }],
    ["amount", { amount: 25_000_001n }],
  ] as const)("rejects a signature after %s changes", async (_fieldName, mutation) => {
    const signed = await signPermit(ordinaryPermit, TEST_SIGNING_SEED_HEX);
    const publicKey = await getRelayPublicKey(TEST_SIGNING_SEED_HEX);
    const mutated: PermitV1 = {
      ...ordinaryPermit,
      entitlement: { ...ordinaryPermit.entitlement, ...mutation },
    };

    await expect(
      verifyPermitSignature(encodePermit(mutated), signed.signature, publicKey),
    ).resolves.toBe(false);
  });

  it.each([
    ["policy", "policyId", "34".repeat(32)],
    ["escrow", "escrowId", "45".repeat(32)],
    ["milestone", "milestoneId", "56".repeat(32)],
  ] as const)("rejects a signature after the bound %s changes", async (_name, field, value) => {
    const signed = await signPermit(ordinaryPermit, TEST_SIGNING_SEED_HEX);
    const publicKey = await getRelayPublicKey(TEST_SIGNING_SEED_HEX);
    const mutated = {
      ...ordinaryPermit,
      [field]: value,
      entitlement: { ...ordinaryPermit.entitlement, [field]: value },
    };

    await expect(
      verifyPermitSignature(encodePermit(mutated), signed.signature, publicKey),
    ).resolves.toBe(false);
  });
});
