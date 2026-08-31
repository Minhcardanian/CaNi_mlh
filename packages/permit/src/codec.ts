import { PermitCodecError } from "./errors.js";
import { decodeFixedHex, decodeHex, encodeHex } from "./hex.js";
import {
  CARDANO_NETWORK_MAGIC,
  MIDNIGHT_NETWORK,
  PERMIT_DOMAIN,
  PERMIT_VERSION,
  type PermitV1,
} from "./types.js";

const MAGIC = Uint8Array.of(0x4e, 0x50, 0x30, 0x31);
const DOMAIN_CODE = 1;
const MIDNIGHT_NETWORK_CODE = 1;
const MAX_U32 = 0xffff_ffff;
const MAX_U64 = 0xffff_ffff_ffff_ffffn;
const MAX_ASSET_NAME_BYTES = 32;
export const MAX_PERMIT_BYTES = 512;

class ByteWriter {
  readonly chunks: Uint8Array[] = [];
  length = 0;

  write(bytes: Uint8Array): void {
    this.chunks.push(bytes);
    this.length += bytes.length;
  }

  writeU8(value: number): void {
    this.write(Uint8Array.of(value));
  }

  writeU32(value: number): void {
    const bytes = new Uint8Array(4);
    new DataView(bytes.buffer).setUint32(0, value, false);
    this.write(bytes);
  }

  writeU64(value: bigint): void {
    const bytes = new Uint8Array(8);
    new DataView(bytes.buffer).setBigUint64(0, value, false);
    this.write(bytes);
  }

  finish(): Uint8Array {
    const bytes = new Uint8Array(this.length);
    let offset = 0;
    for (const chunk of this.chunks) {
      bytes.set(chunk, offset);
      offset += chunk.length;
    }
    return bytes;
  }
}

class ByteReader {
  offset = 0;

  constructor(readonly bytes: Uint8Array) {}

  read(byteLength: number, fieldName: string): Uint8Array {
    if (this.offset + byteLength > this.bytes.length) {
      throw new PermitCodecError(
        "NP_PERMIT_DECODING_FAILED",
        `${fieldName} is truncated`,
      );
    }
    const value = this.bytes.slice(this.offset, this.offset + byteLength);
    this.offset += byteLength;
    return value;
  }

  readU8(fieldName: string): number {
    return this.read(1, fieldName)[0] ?? 0;
  }

  readU32(fieldName: string): number {
    const bytes = this.read(4, fieldName);
    return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(0, false);
  }

  readU64(fieldName: string): bigint {
    const bytes = this.read(8, fieldName);
    return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getBigUint64(0, false);
  }
}

function assertU32(value: number, fieldName: string): void {
  if (!Number.isInteger(value) || value < 0 || value > MAX_U32) {
    throw new PermitCodecError(
      "NP_PERMIT_INVALID_FIELD",
      `${fieldName} must be an unsigned 32-bit integer`,
    );
  }
}

function assertU64(value: bigint, fieldName: string): void {
  if (value < 0n || value > MAX_U64) {
    throw new PermitCodecError(
      "NP_PERMIT_INVALID_FIELD",
      `${fieldName} must be an unsigned 64-bit integer`,
    );
  }
}

function writeOptionalU32(writer: ByteWriter, value: number | undefined, fieldName: string): void {
  if (value === undefined) {
    writer.writeU8(0);
    return;
  }
  assertU32(value, fieldName);
  writer.writeU8(1);
  writer.writeU32(value);
}

function writeOptionalU64(writer: ByteWriter, value: bigint | undefined, fieldName: string): void {
  if (value === undefined) {
    writer.writeU8(0);
    return;
  }
  assertU64(value, fieldName);
  writer.writeU8(1);
  writer.writeU64(value);
}

function readPresence(reader: ByteReader, fieldName: string): boolean {
  const value = reader.readU8(fieldName);
  if (value !== 0 && value !== 1) {
    throw new PermitCodecError(
      "NP_PERMIT_DECODING_FAILED",
      `${fieldName} presence marker must be 0 or 1`,
    );
  }
  return value === 1;
}

function assertLiteralFields(permit: PermitV1): void {
  if (permit.version !== PERMIT_VERSION) {
    throw new PermitCodecError("NP_PERMIT_UNKNOWN_VERSION", "permit version must be 1");
  }
  if (permit.domain !== PERMIT_DOMAIN) {
    throw new PermitCodecError("NP_PERMIT_INVALID_FIELD", "permit domain is not supported");
  }
  if (permit.midnightNetwork !== MIDNIGHT_NETWORK) {
    throw new PermitCodecError("NP_PERMIT_INVALID_FIELD", "Midnight network must be preprod");
  }
}

function assertEntitlementContext(permit: PermitV1): void {
  const bindings = [
    ["policyId", permit.policyId, permit.entitlement.policyId],
    ["escrowId", permit.escrowId, permit.entitlement.escrowId],
    ["milestoneId", permit.milestoneId, permit.entitlement.milestoneId],
  ] as const;
  for (const [fieldName, permitValue, entitlementValue] of bindings) {
    if (permitValue !== entitlementValue) {
      throw new PermitCodecError(
        "NP_PERMIT_INVALID_FIELD",
        `entitlement.${fieldName} must match ${fieldName}`,
      );
    }
  }
}

export function encodePermit(permit: PermitV1): Uint8Array {
  assertLiteralFields(permit);
  assertEntitlementContext(permit);
  assertU64(permit.entitlement.amount, "entitlement.amount");
  assertU64(permit.expiresAtSlot, "expiresAtSlot");
  if (permit.notBeforeSlot !== undefined && permit.notBeforeSlot > permit.expiresAtSlot) {
    throw new PermitCodecError(
      "NP_PERMIT_INVALID_FIELD",
      "notBeforeSlot must not exceed expiresAtSlot",
    );
  }

  const assetPolicyId = decodeHex(permit.entitlement.assetPolicyId, "entitlement.assetPolicyId");
  if (assetPolicyId.length !== 0 && assetPolicyId.length !== 28) {
    throw new PermitCodecError(
      "NP_PERMIT_INVALID_FIELD",
      "entitlement.assetPolicyId must be empty for lovelace or contain 28 bytes",
    );
  }
  const assetName = decodeHex(permit.entitlement.assetName, "entitlement.assetName");
  if (assetName.length > MAX_ASSET_NAME_BYTES) {
    throw new PermitCodecError(
      "NP_PERMIT_INVALID_FIELD",
      `entitlement.assetName must not exceed ${MAX_ASSET_NAME_BYTES} bytes`,
    );
  }

  const writer = new ByteWriter();
  writer.write(MAGIC);
  writer.writeU8(PERMIT_VERSION);
  writer.writeU8(DOMAIN_CODE);
  writer.writeU8(MIDNIGHT_NETWORK_CODE);
  writer.writeU32(CARDANO_NETWORK_MAGIC);
  writer.write(decodeFixedHex(permit.midnightContractId, 32, "midnightContractId"));
  writer.write(decodeFixedHex(permit.midnightTxId, 32, "midnightTxId"));
  writeOptionalU32(writer, permit.authorizationIndex, "authorizationIndex");
  writer.write(decodeFixedHex(permit.policyId, 32, "policyId"));
  writer.write(decodeFixedHex(permit.escrowId, 32, "escrowId"));
  writer.write(decodeFixedHex(permit.milestoneId, 32, "milestoneId"));
  writer.write(decodeFixedHex(permit.beneficiaryPkh, 28, "beneficiaryPkh"));
  writer.write(decodeFixedHex(permit.actionId, 32, "actionId"));
  writer.writeU8(assetPolicyId.length);
  writer.write(assetPolicyId);
  writer.writeU8(assetName.length);
  writer.write(assetName);
  writer.writeU64(permit.entitlement.amount);
  writer.write(decodeFixedHex(permit.nullifier, 32, "nullifier"));
  writeOptionalU64(writer, permit.notBeforeSlot, "notBeforeSlot");
  writer.writeU64(permit.expiresAtSlot);
  writer.write(decodeFixedHex(permit.cardanoValidatorHash, 28, "cardanoValidatorHash"));
  writer.write(decodeFixedHex(permit.relayKeyId, 32, "relayKeyId"));

  const bytes = writer.finish();
  if (bytes.length > MAX_PERMIT_BYTES) {
    throw new PermitCodecError(
      "NP_PERMIT_ENCODING_FAILED",
      `permit exceeds the ${MAX_PERMIT_BYTES}-byte limit`,
    );
  }
  return bytes;
}

export function decodePermit(bytes: Uint8Array): PermitV1 {
  if (bytes.length > MAX_PERMIT_BYTES) {
    throw new PermitCodecError(
      "NP_PERMIT_DECODING_FAILED",
      `permit exceeds the ${MAX_PERMIT_BYTES}-byte limit`,
    );
  }

  const reader = new ByteReader(bytes);
  if (encodeHex(reader.read(MAGIC.length, "magic")) !== encodeHex(MAGIC)) {
    throw new PermitCodecError("NP_PERMIT_DECODING_FAILED", "permit magic is invalid");
  }
  const version = reader.readU8("version");
  if (version !== PERMIT_VERSION) {
    throw new PermitCodecError("NP_PERMIT_UNKNOWN_VERSION", `unsupported permit version ${version}`);
  }
  if (reader.readU8("domain") !== DOMAIN_CODE) {
    throw new PermitCodecError("NP_PERMIT_DECODING_FAILED", "permit domain code is invalid");
  }
  if (reader.readU8("midnightNetwork") !== MIDNIGHT_NETWORK_CODE) {
    throw new PermitCodecError("NP_PERMIT_DECODING_FAILED", "Midnight network code is invalid");
  }
  if (reader.readU32("cardanoNetworkMagic") !== CARDANO_NETWORK_MAGIC) {
    throw new PermitCodecError("NP_PERMIT_DECODING_FAILED", "Cardano network magic is invalid");
  }

  const midnightContractId = encodeHex(reader.read(32, "midnightContractId"));
  const midnightTxId = encodeHex(reader.read(32, "midnightTxId"));
  const hasAuthorizationIndex = readPresence(reader, "authorizationIndex");
  const authorizationIndex = hasAuthorizationIndex
    ? reader.readU32("authorizationIndex")
    : undefined;
  const policyId = encodeHex(reader.read(32, "policyId"));
  const escrowId = encodeHex(reader.read(32, "escrowId"));
  const milestoneId = encodeHex(reader.read(32, "milestoneId"));
  const beneficiaryPkh = encodeHex(reader.read(28, "beneficiaryPkh"));
  const actionId = encodeHex(reader.read(32, "actionId"));
  const assetPolicyLength = reader.readU8("entitlement.assetPolicyId.length");
  if (assetPolicyLength !== 0 && assetPolicyLength !== 28) {
    throw new PermitCodecError(
      "NP_PERMIT_DECODING_FAILED",
      "entitlement.assetPolicyId length must be 0 or 28",
    );
  }
  const assetPolicyId = encodeHex(reader.read(assetPolicyLength, "entitlement.assetPolicyId"));
  const assetNameLength = reader.readU8("entitlement.assetName.length");
  if (assetNameLength > MAX_ASSET_NAME_BYTES) {
    throw new PermitCodecError(
      "NP_PERMIT_DECODING_FAILED",
      `entitlement.assetName length must not exceed ${MAX_ASSET_NAME_BYTES}`,
    );
  }
  const assetName = encodeHex(reader.read(assetNameLength, "entitlement.assetName"));
  const amount = reader.readU64("entitlement.amount");
  const nullifier = encodeHex(reader.read(32, "nullifier"));
  const hasNotBeforeSlot = readPresence(reader, "notBeforeSlot");
  const notBeforeSlot = hasNotBeforeSlot ? reader.readU64("notBeforeSlot") : undefined;
  const expiresAtSlot = reader.readU64("expiresAtSlot");
  const cardanoValidatorHash = encodeHex(reader.read(28, "cardanoValidatorHash"));
  const relayKeyId = encodeHex(reader.read(32, "relayKeyId"));

  if (reader.offset !== bytes.length) {
    throw new PermitCodecError("NP_PERMIT_TRAILING_DATA", "permit contains trailing data");
  }
  if (notBeforeSlot !== undefined && notBeforeSlot > expiresAtSlot) {
    throw new PermitCodecError(
      "NP_PERMIT_DECODING_FAILED",
      "notBeforeSlot must not exceed expiresAtSlot",
    );
  }

  return {
    version: PERMIT_VERSION,
    domain: PERMIT_DOMAIN,
    midnightNetwork: MIDNIGHT_NETWORK,
    midnightContractId,
    midnightTxId,
    ...(authorizationIndex === undefined ? {} : { authorizationIndex }),
    policyId,
    escrowId,
    milestoneId,
    beneficiaryPkh,
    actionId,
    entitlement: {
      policyId,
      escrowId,
      milestoneId,
      assetPolicyId,
      assetName,
      amount,
    },
    nullifier,
    ...(notBeforeSlot === undefined ? {} : { notBeforeSlot }),
    expiresAtSlot,
    cardanoValidatorHash,
    relayKeyId,
  };
}
