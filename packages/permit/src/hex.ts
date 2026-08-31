import { PermitCodecError } from "./errors.js";
import type { Hex } from "./types.js";

const HEX_PATTERN = /^[0-9a-f]*$/;

export function decodeHex(hex: Hex, fieldName = "hex"): Uint8Array {
  if (hex.length % 2 !== 0 || !HEX_PATTERN.test(hex)) {
    throw new PermitCodecError(
      "NP_PERMIT_INVALID_FIELD",
      `${fieldName} must be canonical lowercase hexadecimal`,
    );
  }

  const bytes = new Uint8Array(hex.length / 2);
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16);
  }
  return bytes;
}

export function decodeFixedHex(hex: Hex, byteLength: number, fieldName: string): Uint8Array {
  const bytes = decodeHex(hex, fieldName);
  if (bytes.length !== byteLength) {
    throw new PermitCodecError(
      "NP_PERMIT_INVALID_FIELD",
      `${fieldName} must contain exactly ${byteLength} bytes`,
    );
  }
  return bytes;
}

export function encodeHex(bytes: Uint8Array): Hex {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}
