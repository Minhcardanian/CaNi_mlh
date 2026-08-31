import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import {
  decodeHex,
  encodeHex,
  encodePermit,
  hashPermit,
  verifyPermitSignature,
  type PermitV1,
} from "../src/index.js";

type JsonPermit = Omit<PermitV1, "entitlement" | "notBeforeSlot" | "expiresAtSlot"> & {
  entitlement: Omit<PermitV1["entitlement"], "amount"> & { amount: string };
  notBeforeSlot?: string;
  expiresAtSlot: string;
};

type GoldenVector = {
  id: string;
  permit: JsonPermit;
  permitBytes: string;
  permitHash: string;
  signature: string;
  expectedValid: boolean;
};

type GoldenVectorFile = {
  version: number;
  algorithm: string;
  digest: string;
  relayPublicKey: string;
  vectors: GoldenVector[];
};

function parsePermit(permit: JsonPermit): PermitV1 {
  const { entitlement, notBeforeSlot, expiresAtSlot, ...fields } = permit;
  return {
    ...fields,
    entitlement: {
      ...entitlement,
      amount: BigInt(entitlement.amount),
    },
    ...(notBeforeSlot === undefined
      ? {}
      : { notBeforeSlot: BigInt(notBeforeSlot) }),
    expiresAtSlot: BigInt(expiresAtSlot),
  };
}

describe("PermitV1 cross-language golden vectors", () => {
  it("reproduces the frozen bytes, hashes, and signature expectations", async () => {
    const fixtureUrl = new URL("../fixtures/permit-v1.json", import.meta.url);
    const fixture = JSON.parse(await readFile(fixtureUrl, "utf8")) as GoldenVectorFile;

    expect(fixture).toMatchObject({ version: 1, algorithm: "Ed25519", digest: "Blake2b-256" });
    expect(fixture.vectors).toHaveLength(3);

    for (const vector of fixture.vectors) {
      const permitBytes = encodePermit(parsePermit(vector.permit));
      expect(encodeHex(permitBytes), `${vector.id} bytes`).toBe(vector.permitBytes);
      expect(encodeHex(hashPermit(permitBytes)), `${vector.id} hash`).toBe(vector.permitHash);
      await expect(
        verifyPermitSignature(permitBytes, vector.signature, fixture.relayPublicKey),
        `${vector.id} signature`,
      ).resolves.toBe(vector.expectedValid);
      expect(decodeHex(vector.permitBytes).length).toBeLessThanOrEqual(512);
    }
  });
});
