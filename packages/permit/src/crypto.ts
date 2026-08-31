import { getPublicKeyAsync, signAsync, verifyAsync } from "@noble/ed25519";
import { blake2b } from "@noble/hashes/blake2.js";
import { encodePermit } from "./codec.js";
import { decodeFixedHex, encodeHex } from "./hex.js";
import type { Hex, PermitV1, SignedPermit } from "./types.js";

export function hashPermit(permitBytes: Uint8Array): Uint8Array {
  return blake2b(permitBytes, { dkLen: 32 });
}

export async function getRelayPublicKey(signingSeedHex: Hex): Promise<Hex> {
  const signingSeed = decodeFixedHex(signingSeedHex, 32, "signingSeed");
  return encodeHex(await getPublicKeyAsync(signingSeed));
}

export async function signPermit(permit: PermitV1, signingSeedHex: Hex): Promise<SignedPermit> {
  const permitBytes = encodePermit(permit);
  const signingSeed = decodeFixedHex(signingSeedHex, 32, "signingSeed");
  const signature = await signAsync(permitBytes, signingSeed);
  return {
    permit,
    permitBytes: encodeHex(permitBytes),
    permitHash: encodeHex(hashPermit(permitBytes)),
    signature: encodeHex(signature),
  };
}

export async function verifyPermitSignature(
  permitBytes: Uint8Array,
  signatureHex: Hex,
  relayPublicKeyHex: Hex,
): Promise<boolean> {
  const signature = decodeFixedHex(signatureHex, 64, "signature");
  const relayPublicKey = decodeFixedHex(relayPublicKeyHex, 32, "relayPublicKey");
  try {
    return await verifyAsync(signature, permitBytes, relayPublicKey);
  } catch {
    return false;
  }
}
