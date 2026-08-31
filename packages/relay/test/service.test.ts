import {
  decodeHex,
  decodePermit,
  verifyPermitSignature,
} from "@nightpermit/permit";
import { describe, expect, it } from "vitest";
import { RelayError } from "../src/errors.js";
import { MAX_ENVELOPE_BYTES, PermitService } from "../src/service.js";
import { authorization, config, policy, sources, transactionId } from "./fixtures.js";

describe("PermitService", () => {
  it("validates a confirmed authorization and signs one bound permit", async () => {
    const source = sources();
    const envelope = await new PermitService(
      config,
      source.authorizationSource,
      source.slotSource,
    ).issue({ midnightTxId: transactionId });

    const permitBytes = decodeHex(envelope.permitBytes);
    const decoded = decodePermit(permitBytes);
    expect(decoded).toMatchObject({
      midnightContractId: config.midnightContractId,
      midnightTxId: transactionId,
      policyId: policy.policyId,
      escrowId: policy.escrowId,
      milestoneId: policy.milestoneId,
      beneficiaryPkh: policy.beneficiaryPkh,
      actionId: policy.actionId,
      nullifier: authorization.authorizationNullifier,
      notBeforeSlot: 121_500_000n,
      expiresAtSlot: 121_500_600n,
      cardanoValidatorHash: policy.cardanoValidatorHash,
      relayKeyId: config.relayKeyId,
    });
    await expect(
      verifyPermitSignature(permitBytes, envelope.signature, envelope.relayPublicKey),
    ).resolves.toBe(true);
    const envelopeBytes = new TextEncoder().encode(JSON.stringify(envelope)).length;
    process.stdout.write(
      `${JSON.stringify({ metric: "signed_permit_envelope", bytes: envelopeBytes, budgetBytes: MAX_ENVELOPE_BYTES })}\n`,
    );
    expect(envelopeBytes).toBeLessThanOrEqual(MAX_ENVELOPE_BYTES);
  });

  it("coalesces concurrent requests and returns byte-identical idempotent results", async () => {
    const source = sources();
    const service = new PermitService(config, source.authorizationSource, source.slotSource);
    const [first, second] = await Promise.all([
      service.issue({ midnightTxId: transactionId }),
      service.issue({ midnightTxId: transactionId }),
    ]);
    const third = await service.issue({ midnightTxId: transactionId });

    expect(second).toEqual(first);
    expect(third).toEqual(first);
    expect(source.calls).toEqual({ authorization: 1, slot: 1 });
  });

  it.each([
    ["contract", { contractId: "ff".repeat(32) }],
    ["transaction", { transactionId: "ff".repeat(32) }],
    ["threshold", { approvalCount: 1n }],
    ["authorization flag", { authorized: false }],
    ["nullifier", { authorizationNullifier: "00".repeat(32) }],
    ["escrow", { escrowId: "ff".repeat(32) }],
    ["milestone", { milestoneId: "ff".repeat(32) }],
    ["beneficiary", { beneficiaryPkh: "ff".repeat(28) }],
    ["action", { actionId: "ff".repeat(32) }],
    ["asset policy", { assetPolicyId: "ff".repeat(28) }],
    ["asset name", { assetName: "ff".repeat(32) }],
    ["amount", { amount: 1n }],
    ["validator", { cardanoValidatorHash: "ff".repeat(28) }],
  ] as const)("fails closed when the %s binding differs", async (_name, mutation) => {
    const source = sources({ ...authorization, ...mutation });
    await expect(
      new PermitService(config, source.authorizationSource, source.slotSource).issue({
        midnightTxId: transactionId,
      }),
    ).rejects.toEqual(
      expect.objectContaining<Partial<RelayError>>({
        code: "NP_RELAY_AUTHORIZATION_REJECTED",
      }),
    );
    expect(source.calls.slot).toBe(0);
  });

  it("rejects unknown policies", async () => {
    const source = sources({ ...authorization, policyId: "ff".repeat(32) });
    await expect(
      new PermitService(config, source.authorizationSource, source.slotSource).issue({
        midnightTxId: transactionId,
      }),
    ).rejects.toMatchObject({ code: "NP_RELAY_AUTHORIZATION_REJECTED" });
  });

  it.each([
    ["not found or pending", new RelayError("NP_RELAY_AUTHORIZATION_NOT_FOUND", "not confirmed", 404)],
    ["provider timeout", new RelayError("NP_RELAY_PROVIDER_TIMEOUT", "deadline", 504)],
  ])("does not sign when the authorization is %s", async (_name, failure) => {
    const source = sources();
    source.authorizationSource.readAtTransaction = async () => {
      throw failure;
    };
    await expect(
      new PermitService(config, source.authorizationSource, source.slotSource).issue({
        midnightTxId: transactionId,
      }),
    ).rejects.toBe(failure);
    expect(source.calls.slot).toBe(0);
  });

  it("accepts only the strict request schema", () => {
    const source = sources();
    const service = new PermitService(config, source.authorizationSource, source.slotSource);
    expect(service.parseRequest({ midnightTxId: transactionId })).toEqual({ midnightTxId: transactionId });
    expect(() => service.parseRequest({ midnightTxId: transactionId, verified: true })).toThrow(
      /unsupported fields/,
    );
    expect(() => service.parseRequest({ midnightTxId: "not-hex" })).toThrow(/canonical/);
  });
});
