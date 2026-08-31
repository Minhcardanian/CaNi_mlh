import { pathToFileURL } from "node:url";

const DEFAULT_TIMEOUT_MS = 5_000;

function url(value, fallback) {
  const parsed = new URL(value || fallback);
  const local = parsed.hostname === "127.0.0.1" || parsed.hostname === "localhost" || parsed.hostname === "[::1]";
  if (parsed.username || parsed.password || parsed.hash ||
    (parsed.protocol !== "https:" && !(local && parsed.protocol === "http:"))) {
    throw new Error("unsafe readiness endpoint");
  }
  return parsed;
}

export function readinessConfiguration(environment = process.env, scope = "full") {
  if (scope !== "full" && scope !== "providers") throw new Error("scope must be full or providers");
  return {
    scope,
    timeoutMs: Number(environment.READINESS_TIMEOUT_MS || DEFAULT_TIMEOUT_MS),
    relayUrl: url(environment.RELAY_URL, "http://127.0.0.1:8787"),
    proofServerUrl: url(environment.MIDNIGHT_PROOF_SERVER_URL, "http://127.0.0.1:6300"),
    midnightRpcUrl: url(environment.MIDNIGHT_RPC_URL, "https://rpc.preprod.midnight.network"),
    midnightIndexerUrl: url(environment.MIDNIGHT_INDEXER_URL, "https://indexer.preprod.midnight.network/api/v4/graphql"),
    kupoUrl: url(environment.KUPO_URL, "http://127.0.0.1:1442"),
    ogmiosUrl: url(environment.OGMIOS_URL, "http://127.0.0.1:1337"),
  };
}

async function request(fetchImpl, endpoint, init, timeoutMs) {
  if (!Number.isInteger(timeoutMs) || timeoutMs < 100 || timeoutMs > 30_000) {
    throw new Error("readiness timeout must be between 100 and 30000 ms");
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(endpoint, { ...init, signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response;
  } finally {
    clearTimeout(timer);
  }
}

async function json(fetchImpl, endpoint, init, timeoutMs) {
  return request(fetchImpl, endpoint, init, timeoutMs).then((response) => response.json());
}

function postJson(body) {
  return {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  };
}

async function checked(name, action, now) {
  const started = now();
  try {
    const detail = await action();
    return { name, status: "pass", elapsedMs: Math.max(0, now() - started), detail };
  } catch {
    return { name, status: "fail", elapsedMs: Math.max(0, now() - started), detail: "unavailable" };
  }
}

export async function checkReadiness(config, fetchImpl = fetch, now = () => Date.now()) {
  const { timeoutMs } = config;
  const checks = [
    checked("proof-server", async () => {
      const body = await json(fetchImpl, new URL("/health", config.proofServerUrl), {}, timeoutMs);
      if (body?.status !== "ok") throw new Error("not ready");
      return "ready";
    }, now),
    checked("midnight-rpc", async () => {
      const body = await json(fetchImpl, new URL("/health", config.midnightRpcUrl), {}, timeoutMs);
      if (body?.isSyncing !== false || body?.shouldHavePeers !== true || !Number.isInteger(body?.peers) || body.peers < 1) {
        throw new Error("not synchronized");
      }
      return `${body.peers} peers`;
    }, now),
    checked("midnight-indexer", async () => {
      const body = await json(fetchImpl, config.midnightIndexerUrl, postJson({ query: "query Readiness { __typename }" }), timeoutMs);
      if (body?.data?.__typename !== "Query") throw new Error("not ready");
      return "query ready";
    }, now),
    checked("kupo", async () => {
      const body = await request(fetchImpl, new URL("/health", config.kupoUrl), {}, timeoutMs).then((response) => response.text());
      const metric = (name) => Number(body.match(new RegExp(`^${name}\\s+([0-9.]+)$`, "m"))?.[1]);
      const checkpoint = metric("kupo_most_recent_checkpoint");
      const tip = metric("kupo_most_recent_node_tip");
      if (metric("kupo_connection_status") !== 1 || metric("kupo_network_synchronization") !== 1 || checkpoint !== tip) {
        throw new Error("not synchronized");
      }
      return { slot: tip };
    }, now),
    checked("ogmios", async () => {
      const body = await json(fetchImpl, config.ogmiosUrl, postJson({
        jsonrpc: "2.0",
        method: "queryNetwork/tip",
        id: "nightpermit-readiness",
      }), timeoutMs);
      if (!Number.isInteger(body?.result?.slot) || !/^[0-9a-f]{64}$/.test(body?.result?.id)) {
        throw new Error("tip unavailable");
      }
      return { slot: body.result.slot };
    }, now),
  ];
  if (config.scope === "full") {
    checks.unshift(checked("relay", async () => {
      const body = await json(fetchImpl, new URL("/health", config.relayUrl), {}, timeoutMs);
      if (body?.status !== "ok" || body?.service !== "nightpermit-relay" || body?.version !== 1) {
        throw new Error("not ready");
      }
      return "ready";
    }, now));
  }
  const results = await Promise.all(checks);
  const kupo = results.find(({ name }) => name === "kupo");
  const ogmios = results.find(({ name }) => name === "ogmios");
  if (kupo?.status === "pass" && ogmios?.status === "pass" && kupo.detail.slot !== ogmios.detail.slot) {
    results.push({ name: "cardano-tip-consistency", status: "fail", elapsedMs: 0, detail: "mismatch" });
  } else if (kupo?.status === "pass" && ogmios?.status === "pass") {
    results.push({ name: "cardano-tip-consistency", status: "pass", elapsedMs: 0, detail: kupo.detail });
  }
  return { scope: config.scope, status: results.every(({ status }) => status === "pass") ? "pass" : "fail", results };
}

async function main() {
  const scope = process.argv.includes("--providers") ? "providers" : "full";
  const report = await checkReadiness(readinessConfiguration(process.env, scope));
  process.stdout.write(`${JSON.stringify(report)}\n`);
  if (report.status !== "pass") process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
