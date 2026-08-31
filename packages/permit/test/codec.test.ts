import { describe, expect, it } from "vitest";
import {
  decodePermit,
  encodePermit,
  MAX_PERMIT_BYTES,
  PermitCodecError,
} from "../src/index.js";
import { boundaryPermit, ordinaryPermit } from "./fixtures.js";

describe("PermitV1 canonical codec", () => {
  it("encodes deterministically and remains under the payload budget", () => {
    const first = encodePermit(ordinaryPermit);
    const second = encodePermit(structuredClone(ordinaryPermit));

    expect(first).toEqual(second);
    expect(first.length).toBeLessThanOrEqual(MAX_PERMIT_BYTES);
  });

  it.each([ordinaryPermit, boundaryPermit])("round trips every supported field", (permit) => {
    expect(decodePermit(encodePermit(permit))).toEqual(permit);
  });

  it("rejects malformed fixed-length identifiers", () => {
    expect(() =>
      encodePermit({
        ...ordinaryPermit,
        policyId: "00",
        entitlement: { ...ordinaryPermit.entitlement, policyId: "00" },
      }),
    ).toThrowError(/policyId must contain exactly 32 bytes/);
  });

  it("rejects uppercase and otherwise non-canonical hexadecimal", () => {
    expect(() =>
      encodePermit({ ...ordinaryPermit, relayKeyId: ordinaryPermit.relayKeyId.toUpperCase() }),
    ).toThrowError(/canonical lowercase hexadecimal/);
  });

  it("rejects an unknown version", () => {
    const bytes = encodePermit(ordinaryPermit);
    bytes[4] = 2;

    expect(() => decodePermit(bytes)).toThrowError(
      expect.objectContaining<Partial<PermitCodecError>>({ code: "NP_PERMIT_UNKNOWN_VERSION" }),
    );
  });

  it("rejects truncated and trailing data", () => {
    const bytes = encodePermit(ordinaryPermit);
    expect(() => decodePermit(bytes.slice(0, -1))).toThrowError(/truncated/);

    const withTrailingByte = new Uint8Array(bytes.length + 1);
    withTrailingByte.set(bytes);
    expect(() => decodePermit(withTrailingByte)).toThrowError(
      expect.objectContaining<Partial<PermitCodecError>>({ code: "NP_PERMIT_TRAILING_DATA" }),
    );
  });

  it("rejects invalid validity intervals and integer bounds", () => {
    expect(() =>
      encodePermit({ ...ordinaryPermit, notBeforeSlot: ordinaryPermit.expiresAtSlot + 1n }),
    ).toThrowError(/notBeforeSlot/);
    expect(() =>
      encodePermit({
        ...ordinaryPermit,
        entitlement: { ...ordinaryPermit.entitlement, amount: -1n },
      }),
    ).toThrowError(/unsigned 64-bit/);
  });

  it("rejects contradictory entitlement context", () => {
    expect(() =>
      encodePermit({
        ...ordinaryPermit,
        entitlement: { ...ordinaryPermit.entitlement, milestoneId: "00".repeat(32) },
      }),
    ).toThrowError(/entitlement.milestoneId must match milestoneId/);
  });
});
