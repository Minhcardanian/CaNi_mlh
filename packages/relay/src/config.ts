import { readFile, stat } from "node:fs/promises";
import { isAbsolute, resolve } from "node:path";
import { decodeFixedHex, getRelayPublicKey, type Hex } from "@nightpermit/permit";
import { RelayError } from "./errors.js";
import { decimalBigInt, exactKeys, hex, integer, object } from "./validation.js";

export type EntitlementPolicy = {
  policyId: Hex;
  escrowId: Hex;
  milestoneId: Hex;
  beneficiaryPkh: Hex;
  actionId: Hex;
  assetPolicyId: Hex;
  assetName: Hex;
  amount: bigint;
  cardanoValidatorHash: Hex;
};

export type RelayConfig = {
  host: "127.0.0.1";
  port: number;
  midnightNetwork: "preprod";
  midnightIndexerUrl: URL;
  midnightIndexerWsUrl: URL;
  midnightContractId: Hex;
  ogmiosUrl: URL;
  relayKeyId: Hex;
  relayPublicKey: Hex;
  relaySigningSeed: Hex;
  relayStateFile: string;
  permitTtlSlots: bigint;
  providerTimeoutMs: number;
  providerMaxAttempts: number;
  policies: ReadonlyMap<Hex, EntitlementPolicy>;
};

const ENV_KEYS = [
  "RELAY_HOST",
  "RELAY_PORT",
  "MIDNIGHT_NETWORK",
  "MIDNIGHT_INDEXER_URL",
  "MIDNIGHT_INDEXER_WS_URL",
  "MIDNIGHT_CONTRACT_ID",
  "OGMIOS_URL",
  "RELAY_KEY_ID",
  "RELAY_PUBLIC_KEY",
  "RELAY_PRIVATE_KEY_FILE",
  "RELAY_STATE_FILE",
  "RELAY_POLICY_FILE",
  "PERMIT_TTL_SLOTS",
  "RELAY_PROVIDER_TIMEOUT_MS",
  "RELAY_PROVIDER_MAX_ATTEMPTS",
] as const;

function required(env: NodeJS.ProcessEnv, name: (typeof ENV_KEYS)[number]): string {
  const value = env[name];
  if (value === undefined || value.length === 0) {
    configurationError(`${name} is required`);
  }
  return value;
}

function parseInteger(raw: string, min: number, max: number, name: string): number {
  if (!/^(0|[1-9][0-9]*)$/.test(raw)) {
    configurationError(`${name} must be a canonical unsigned integer`);
  }
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < min || value > max) {
    configurationError(`${name} must be from ${min} through ${max}`);
  }
  return value;
}

function parseUrl(raw: string, protocols: readonly string[], name: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch (error) {
    configurationError(`${name} must be an absolute URL`, error);
  }
  if (!protocols.includes(parsed.protocol) || parsed.username || parsed.password || parsed.hash) {
    configurationError(`${name} has an unsupported or unsafe URL`);
  }
  return parsed;
}

async function readSigningSeed(path: string): Promise<Hex> {
  const absolutePath = isAbsolute(path) ? path : resolve(path);
  let metadata;
  try {
    metadata = await stat(absolutePath);
  } catch (error) {
    configurationError("RELAY_PRIVATE_KEY_FILE is not readable", error);
  }
  if (!metadata.isFile()) {
    configurationError("RELAY_PRIVATE_KEY_FILE must reference a regular file");
  }
  if (process.platform !== "win32" && (metadata.mode & 0o077) !== 0) {
    configurationError("RELAY_PRIVATE_KEY_FILE must not grant group or other permissions");
  }
  const raw = (await readFile(absolutePath, "utf8")).trim();
  try {
    decodeFixedHex(raw, 32, "relay signing seed");
  } catch (error) {
    configurationError("RELAY_PRIVATE_KEY_FILE must contain one canonical 32-byte hexadecimal seed", error);
  }
  return raw;
}

function parsePolicy(value: unknown, index: number): EntitlementPolicy {
  const record = object(value, `policies[${index}]`);
  exactKeys(
    record,
    [
      "policyId",
      "escrowId",
      "milestoneId",
      "beneficiaryPkh",
      "actionId",
      "assetPolicyId",
      "assetName",
      "amount",
      "cardanoValidatorHash",
    ],
    `policies[${index}]`,
  );
  const amount = decimalBigInt(record.amount, `policies[${index}].amount`);
  if (amount === 0n || amount > 0xffff_ffff_ffff_ffffn) {
    configurationError(`policies[${index}].amount must be from 1 through 18446744073709551615`);
  }
  return {
    policyId: hex(record.policyId, 32, `policies[${index}].policyId`),
    escrowId: hex(record.escrowId, 32, `policies[${index}].escrowId`),
    milestoneId: hex(record.milestoneId, 32, `policies[${index}].milestoneId`),
    beneficiaryPkh: hex(record.beneficiaryPkh, 28, `policies[${index}].beneficiaryPkh`),
    actionId: hex(record.actionId, 32, `policies[${index}].actionId`),
    assetPolicyId: hex(record.assetPolicyId, 28, `policies[${index}].assetPolicyId`),
    assetName: hex(record.assetName, 32, `policies[${index}].assetName`),
    amount,
    cardanoValidatorHash: hex(record.cardanoValidatorHash, 28, `policies[${index}].cardanoValidatorHash`),
  };
}

async function readPolicies(path: string): Promise<ReadonlyMap<Hex, EntitlementPolicy>> {
  const absolutePath = isAbsolute(path) ? path : resolve(path);
  let parsed: unknown;
  try {
    parsed = JSON.parse(await readFile(absolutePath, "utf8"));
  } catch (error) {
    configurationError("RELAY_POLICY_FILE must contain valid JSON", error);
  }
  try {
    const root = object(parsed, "policy file");
    exactKeys(root, ["version", "policies"], "policy file");
    if (integer(root.version, 1, 1, "policy file.version") !== 1 || !Array.isArray(root.policies)) {
      configurationError("RELAY_POLICY_FILE must contain a version 1 policies array");
    }
    const policies = new Map<Hex, EntitlementPolicy>();
    for (const [index, raw] of root.policies.entries()) {
      const policy = parsePolicy(raw, index);
      if (policies.has(policy.policyId)) {
        configurationError("RELAY_POLICY_FILE contains a duplicate policyId");
      }
      policies.set(policy.policyId, policy);
    }
    if (policies.size === 0) {
      configurationError("RELAY_POLICY_FILE must configure at least one policy");
    }
    return policies;
  } catch (error) {
    if (error instanceof RelayError && error.code === "NP_RELAY_CONFIGURATION_INVALID") {
      throw error;
    }
    configurationError("RELAY_POLICY_FILE has an invalid schema", error);
  }
}

export async function loadConfig(env: NodeJS.ProcessEnv = process.env): Promise<RelayConfig> {
  if (required(env, "RELAY_HOST") !== "127.0.0.1") {
    configurationError("RELAY_HOST must be 127.0.0.1 for the MVP");
  }
  if (required(env, "MIDNIGHT_NETWORK") !== "preprod") {
    configurationError("MIDNIGHT_NETWORK must be preprod");
  }
  const relaySigningSeed = await readSigningSeed(required(env, "RELAY_PRIVATE_KEY_FILE"));
  const relayPublicKey = parseConfigHex(required(env, "RELAY_PUBLIC_KEY"), 32, "RELAY_PUBLIC_KEY");
  if (await getRelayPublicKey(relaySigningSeed) !== relayPublicKey) {
    configurationError("RELAY_PRIVATE_KEY_FILE does not match RELAY_PUBLIC_KEY");
  }
  return {
    host: "127.0.0.1",
    port: parseInteger(required(env, "RELAY_PORT"), 1024, 65_535, "RELAY_PORT"),
    midnightNetwork: "preprod",
    midnightIndexerUrl: parseUrl(required(env, "MIDNIGHT_INDEXER_URL"), ["https:"], "MIDNIGHT_INDEXER_URL"),
    midnightIndexerWsUrl: parseUrl(required(env, "MIDNIGHT_INDEXER_WS_URL"), ["wss:"], "MIDNIGHT_INDEXER_WS_URL"),
    midnightContractId: parseConfigHex(required(env, "MIDNIGHT_CONTRACT_ID"), 32, "MIDNIGHT_CONTRACT_ID"),
    ogmiosUrl: parseUrl(required(env, "OGMIOS_URL"), ["http:", "https:"], "OGMIOS_URL"),
    relayKeyId: parseConfigHex(required(env, "RELAY_KEY_ID"), 32, "RELAY_KEY_ID"),
    relayPublicKey,
    relaySigningSeed,
    relayStateFile: resolve(required(env, "RELAY_STATE_FILE")),
    permitTtlSlots: BigInt(parseInteger(required(env, "PERMIT_TTL_SLOTS"), 1, 3_600, "PERMIT_TTL_SLOTS")),
    providerTimeoutMs: parseInteger(required(env, "RELAY_PROVIDER_TIMEOUT_MS"), 100, 10_000, "RELAY_PROVIDER_TIMEOUT_MS"),
    providerMaxAttempts: parseInteger(required(env, "RELAY_PROVIDER_MAX_ATTEMPTS"), 1, 5, "RELAY_PROVIDER_MAX_ATTEMPTS"),
    policies: await readPolicies(required(env, "RELAY_POLICY_FILE")),
  };
}

function parseConfigHex(raw: string, byteLength: number, name: string): Hex {
  try {
    decodeFixedHex(raw, byteLength, name);
  } catch (error) {
    configurationError(`${name} must be canonical lowercase hexadecimal containing ${byteLength} bytes`, error);
  }
  return raw;
}

function configurationError(message: string, cause?: unknown): never {
  throw new RelayError("NP_RELAY_CONFIGURATION_INVALID", message, 500, { cause });
}
