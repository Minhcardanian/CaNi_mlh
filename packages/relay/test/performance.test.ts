import { describe, expect, it } from "vitest";
import { PermitService } from "../src/service.js";
import type { AuthorizationSource } from "../src/midnight.js";
import { authorization, config, sources, transactionId } from "./fixtures.js";

const MEBIBYTE = 1024 * 1024;

describe("relay performance budgets", () => {
  it("validates, encodes, and signs 50 fixture authorizations below the 2 second p95 budget", async () => {
    let providerCalls = 0;
    const authorizationSource: AuthorizationSource = {
      async readAtTransaction(id) {
        providerCalls += 1;
        return { ...authorization, transactionId: id };
      },
    };
    const latencies: number[] = [];
    for (let index = 0; index < 50; index += 1) {
      const id = index.toString(16).padStart(64, "0");
      const service = new PermitService(config, authorizationSource, sources().slotSource);
      const started = performance.now();
      await service.issue({ midnightTxId: id });
      latencies.push(performance.now() - started);
    }
    latencies.sort((left, right) => left - right);
    const p95 = latencies[Math.ceil(latencies.length * 0.95) - 1] ?? Number.POSITIVE_INFINITY;
    process.stdout.write(
      `${JSON.stringify({ metric: "relay_fixture_latency", samples: 50, p95Ms: Number(p95.toFixed(3)), providerCalls })}\n`,
    );
    expect(p95).toBeLessThan(2_000);
    expect(providerCalls).toBe(50);
  });

  it("keeps 100 idempotent lookups below the memory and provider-call budgets", async () => {
    const source = sources();
    const service = new PermitService(config, source.authorizationSource, source.slotSource);
    await service.issue({ midnightTxId: transactionId });
    const before = process.memoryUsage().rss;
    for (let index = 0; index < 100; index += 1) {
      await service.issue({ midnightTxId: transactionId });
    }
    const after = process.memoryUsage().rss;
    const growth = before === 0 ? 0 : Math.max(0, (after - before) / before);
    process.stdout.write(
      `${JSON.stringify({ metric: "relay_idempotent_memory", samples: 100, beforeMiB: Number((before / MEBIBYTE).toFixed(3)), afterMiB: Number((after / MEBIBYTE).toFixed(3)), growthPercent: Number((growth * 100).toFixed(3)), providerCalls: source.calls.authorization })}\n`,
    );
    expect(after / MEBIBYTE).toBeLessThan(256);
    expect(growth).toBeLessThan(0.1);
    expect(source.calls).toEqual({ authorization: 1, slot: 1 });
  });
});
