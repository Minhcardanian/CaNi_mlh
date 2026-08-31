import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { checkReadiness, readinessConfiguration } from "./check-readiness.mjs";

const response = (body, status = 200) => new Response(
  typeof body === "string" ? body : JSON.stringify(body),
  { status, headers: { "content-type": typeof body === "string" ? "text/plain" : "application/json" } },
);

function healthyFetch(endpoint) {
  const target = endpoint.toString();
  if (target.includes("8787")) return Promise.resolve(response({ status: "ok", service: "nightpermit-relay", version: 1 }));
  if (target.includes("6300")) return Promise.resolve(response({ status: "ok" }));
  if (target.includes("rpc.preprod")) return Promise.resolve(response({ peers: 14, isSyncing: false, shouldHavePeers: true }));
  if (target.includes("indexer.preprod")) return Promise.resolve(response({ data: { __typename: "Query" } }));
  if (target.includes("1442")) return Promise.resolve(response([
    "kupo_connection_status 1.0",
    "kupo_most_recent_checkpoint 121500000",
    "kupo_most_recent_node_tip 121500000",
    "kupo_network_synchronization 1.0",
  ].join("\n")));
  if (target.includes("1337")) return Promise.resolve(response({ result: { slot: 121500000, id: "ab".repeat(32) } }));
  return Promise.resolve(response({}, 404));
}

describe("NightPermit readiness verifier", () => {
  it("verifies all product dependencies and matching Cardano tips", async () => {
    const report = await checkReadiness(readinessConfiguration({}, "full"), healthyFetch, () => 10);
    assert.equal(report.status, "pass");
    assert.deepEqual(report.results.map(({ name }) => name), [
      "relay",
      "proof-server",
      "midnight-rpc",
      "midnight-indexer",
      "kupo",
      "ogmios",
      "cardano-tip-consistency",
    ]);
  });

  it("fails closed without returning provider payloads", async () => {
    const report = await checkReadiness(readinessConfiguration({}, "providers"), async (endpoint, init) => {
      if (endpoint.toString().includes("1337")) {
        assert.equal(JSON.parse(init.body).method, "queryNetwork/tip");
        return response({ privateProviderDetail: "must-not-escape" }, 503);
      }
      return healthyFetch(endpoint);
    }, () => 20);
    assert.equal(report.status, "fail");
    assert.equal(report.results.find(({ name }) => name === "ogmios").detail, "unavailable");
    assert.doesNotMatch(JSON.stringify(report), /must-not-escape/);
  });

  it("rejects endpoint credentials and invalid timeouts", async () => {
    assert.throws(() => readinessConfiguration({ RELAY_URL: "https://user:pass@example.test" }));
    assert.throws(() => readinessConfiguration({ OGMIOS_URL: "http://ogmios.example.test" }));
    const config = readinessConfiguration({ READINESS_TIMEOUT_MS: "50" }, "providers");
    const report = await checkReadiness(config, healthyFetch, () => 30);
    assert.equal(report.status, "fail");
  });
});
