import { chmod, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { loadConfig } from "../src/config.js";
import { policy, relayPublicKey, signingSeed } from "./fixtures.js";

const directories: string[] = [];

afterEach(async () => {
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true })));
});

async function files(): Promise<{ key: string; policy: string; state: string }> {
  const directory = await mkdtemp(join(tmpdir(), "nightpermit-relay-config-"));
  directories.push(directory);
  const key = join(directory, "relay.seed");
  const policyPath = join(directory, "policy.json");
  const state = join(directory, "state.json");
  await writeFile(key, `${signingSeed}\n`, { mode: 0o600 });
  await writeFile(
    policyPath,
    JSON.stringify({
      version: 1,
      policies: [{ ...policy, amount: policy.amount.toString() }],
    }),
  );
  return { key, policy: policyPath, state };
}

function environment(paths: { key: string; policy: string; state: string }): NodeJS.ProcessEnv {
  return {
    RELAY_HOST: "127.0.0.1",
    RELAY_PORT: "8787",
    MIDNIGHT_NETWORK: "preprod",
    MIDNIGHT_INDEXER_URL: "https://indexer.preprod.midnight.network/api/v4/graphql",
    MIDNIGHT_INDEXER_WS_URL: "wss://indexer.preprod.midnight.network/api/v4/graphql/ws",
    MIDNIGHT_CONTRACT_ID: "40".repeat(32),
    OGMIOS_URL: "http://127.0.0.1:1337",
    RELAY_KEY_ID: "41".repeat(32),
    RELAY_PUBLIC_KEY: relayPublicKey,
    RELAY_PRIVATE_KEY_FILE: paths.key,
    RELAY_STATE_FILE: paths.state,
    RELAY_POLICY_FILE: paths.policy,
    PERMIT_TTL_SLOTS: "600",
    RELAY_PROVIDER_TIMEOUT_MS: "500",
    RELAY_PROVIDER_MAX_ATTEMPTS: "2",
  };
}

describe("relay configuration", () => {
  it("loads a strict preprod/preview configuration from files", async () => {
    const paths = await files();
    const config = await loadConfig(environment(paths));
    expect(config.host).toBe("127.0.0.1");
    expect(config.policies.get(policy.policyId)).toEqual(policy);
    expect(config.relaySigningSeed).toBe(signingSeed);
    expect(config.relayPublicKey).toBe(relayPublicKey);
  });

  it("rejects a signing seed file readable by group or others", async () => {
    const paths = await files();
    await chmod(paths.key, 0o644);
    await expect(loadConfig(environment(paths))).rejects.toMatchObject({
      code: "NP_RELAY_CONFIGURATION_INVALID",
    });
  });

  it("rejects a signing seed that does not derive the expected public key", async () => {
    const paths = await files();
    await expect(loadConfig({
      ...environment(paths),
      RELAY_PUBLIC_KEY: "ff".repeat(32),
    })).rejects.toMatchObject({ code: "NP_RELAY_CONFIGURATION_INVALID" });
  });

  it.each([
    ["public bind", { RELAY_HOST: "0.0.0.0" }],
    ["wrong network", { MIDNIGHT_NETWORK: "preview" }],
    ["unsafe indexer", { MIDNIGHT_INDEXER_URL: "http://indexer.invalid/graphql" }],
    ["embedded credentials", { OGMIOS_URL: "http://user:pass@127.0.0.1:1337" }],
    ["unbounded timeout", { RELAY_PROVIDER_TIMEOUT_MS: "60000" }],
    ["unbounded retries", { RELAY_PROVIDER_MAX_ATTEMPTS: "100" }],
  ])("rejects %s", async (_name, mutation) => {
    const paths = await files();
    await expect(loadConfig({ ...environment(paths), ...mutation })).rejects.toMatchObject({
      code: "NP_RELAY_CONFIGURATION_INVALID",
    });
  });
});
