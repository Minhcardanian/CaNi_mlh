import { decodeFixedHex, decodeHex, type Hex } from "@nightpermit/permit";
import { RelayError } from "./errors.js";

export type JsonObject = Record<string, unknown>;

export function object(value: unknown, field: string): JsonObject {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    invalid(`${field} must be an object`);
  }
  return value as JsonObject;
}

export function exactKeys(value: JsonObject, keys: readonly string[], field: string): void {
  const allowed = new Set(keys);
  const extras = Object.keys(value).filter((key) => !allowed.has(key));
  if (extras.length > 0) {
    invalid(`${field} contains unsupported fields`);
  }
}

export function string(value: unknown, field: string): string {
  if (typeof value !== "string" || value.length === 0) {
    invalid(`${field} must be a non-empty string`);
  }
  return value as string;
}

export function hex(value: unknown, byteLength: number, field: string): Hex {
  const result = string(value, field);
  try {
    decodeFixedHex(result, byteLength, field);
  } catch (error) {
    invalid(`${field} must be canonical lowercase hexadecimal containing ${byteLength} bytes`, error);
  }
  return result;
}

export function variableHex(value: unknown, maxByteLength: number, field: string): Hex {
  const result = typeof value === "string" ? value : invalid(`${field} must be a hexadecimal string`);
  try {
    const decoded = decodeHex(result, field);
    if (decoded.length > maxByteLength) {
      invalid(`${field} must not exceed ${maxByteLength} bytes`);
    }
  } catch (error) {
    invalid(`${field} must be canonical lowercase hexadecimal`, error);
  }
  return result;
}

export function integer(value: unknown, min: number, max: number, field: string): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < min || value > max) {
    invalid(`${field} must be an integer from ${min} through ${max}`);
  }
  return value as number;
}

export function decimalBigInt(value: unknown, field: string): bigint {
  if (typeof value !== "string" || !/^(0|[1-9][0-9]*)$/.test(value)) {
    invalid(`${field} must be a canonical unsigned decimal string`);
  }
  return BigInt(value);
}

export function boolean(value: unknown, field: string): boolean {
  if (typeof value !== "boolean") {
    invalid(`${field} must be boolean`);
  }
  return value as boolean;
}

export function url(value: unknown, protocol: "http:" | "https:" | "ws:" | "wss:", field: string): URL {
  const raw = string(value, field);
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch (error) {
    invalid(`${field} must be an absolute URL`, error);
  }
  if (parsed.protocol !== protocol || parsed.username || parsed.password || parsed.hash) {
    invalid(`${field} must use ${protocol} without credentials or a fragment`);
  }
  return parsed;
}

export function invalid(message: string, cause?: unknown): never {
  throw new RelayError("NP_RELAY_BAD_REQUEST", message, 400, { cause });
}
