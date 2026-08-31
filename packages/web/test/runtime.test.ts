// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { getRelayPublicKey, signPermit, type PermitV1 } from "@nightpermit/permit";
import { createBrowserRuntime, relayUrl } from "../src/runtime.js";

afterEach(() => {
  vi.restoreAllMocks();
  delete window.midnight;
  window.cardano = {} as never;
});

describe("browser runtime", () => {
  it("accepts HTTPS or local HTTP relay URLs and rejects unsafe transport metadata", () => {
    expect(relayUrl("https://relay.example.test").origin).toBe("https://relay.example.test");
    expect(relayUrl("http://127.0.0.1:8787").port).toBe("8787");
    expect(() => relayUrl("http://relay.example.test")).toThrowError(expect.objectContaining({
      code: "NP_WEB_RUNTIME_NOT_CONFIGURED",
    }));
    expect(() => relayUrl("https://user:pass@relay.example.test")).toThrow();
  });

  it("connects compatible Midnight and Cardano Preview wallets", async () => {
    window.midnight = {
      lace: {
        apiVersion: "4.0.1",
        name: "Lace",
        connect: vi.fn(async () => ({
          getConnectionStatus: async () => ({ status: "connected", networkId: "preprod" }),
        })),
      } as never,
    };
    const address = "addr_test1vq6rgdp5xs6rgdp5xs6rgdp5xs6rgdp5xs6rgdp5xs6rgdq6smfkn";
    const addressHex = `60${"34".repeat(28)}`;
    window.cardano = {
      eternl: {
        name: "Eternl",
        icon: "",
        apiVersion: "1.0.0",
        isEnabled: async () => true,
        enable: vi.fn(async () => ({
          getNetworkId: async () => 0,
          getChangeAddress: async () => addressHex,
        })) as never,
      },
    };
    const runtime = createBrowserRuntime(new URL("http://127.0.0.1:8787"));
    await expect(runtime.connectMidnight()).resolves.toMatchObject({ network: "Midnight Preprod" });
    await expect(runtime.connectCardano("eternl")).resolves.toMatchObject({
      network: "Cardano Preview",
      address,
    });
  });

  it("rejects a mainnet Cardano wallet", async () => {
    window.cardano = {
      lace: {
        name: "Lace",
        icon: "",
        apiVersion: "1.0.0",
        isEnabled: async () => true,
        enable: vi.fn(async () => ({ getNetworkId: async () => 1 })) as never,
      },
    };
    const runtime = createBrowserRuntime(new URL("http://127.0.0.1:8787"));
    await expect(runtime.connectCardano()).rejects.toMatchObject({ code: "NP_WEB_WRONG_CARDANO_NETWORK" });
  });

  it("rejects a wallet whose change address contradicts the Preview network", async () => {
    window.cardano = {
      lace: {
        name: "Lace",
        icon: "",
        apiVersion: "1.0.0",
        isEnabled: async () => true,
        enable: vi.fn(async () => ({
          getNetworkId: async () => 0,
          getChangeAddress: async () => `61${"34".repeat(28)}`,
        })) as never,
      },
    };
    const runtime = createBrowserRuntime(new URL("http://127.0.0.1:8787"));
    await expect(runtime.connectCardano()).rejects.toMatchObject({ code: "NP_WEB_WRONG_CARDANO_NETWORK" });
  });

  it("parses a strict relay response without logging provider payloads", async () => {
    const publicPermit: PermitV1 = {
      version: 1,
      domain: "nightpermit/cardano-preview/v1",
      midnightNetwork: "preprod",
      midnightContractId: "10".repeat(32),
      midnightTxId: "20".repeat(32),
      policyId: "30".repeat(32),
      escrowId: "40".repeat(32),
      milestoneId: "50".repeat(32),
      beneficiaryPkh: "60".repeat(28),
      actionId: "70".repeat(32),
      entitlement: {
        policyId: "30".repeat(32),
        escrowId: "40".repeat(32),
        milestoneId: "50".repeat(32),
        assetPolicyId: "",
        assetName: "",
        amount: 5_000_000n,
      },
      nullifier: "80".repeat(32),
      expiresAtSlot: 121_500_000n,
      cardanoValidatorHash: "90".repeat(28),
      relayKeyId: "a0".repeat(32),
    };
    const seed = "00".repeat(32);
    const signed = await signPermit(publicPermit, seed);
    const permit = {
      version: 1 as const,
      permitBytes: signed.permitBytes,
      permitHash: signed.permitHash,
      signature: signed.signature,
      relayPublicKey: await getRelayPublicKey(seed),
    };
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({
      correlationId: "correlation-01",
      permit,
    }), { status: 200, headers: { "content-type": "application/json" } })));
    const runtime = createBrowserRuntime(new URL("http://127.0.0.1:8787"), undefined, permit.relayPublicKey);
    await expect(runtime.getPermit("20".repeat(32))).resolves.toEqual({
      correlationId: "correlation-01",
      permit,
      nullifier: publicPermit.nullifier,
      relayVerified: true,
    });
    const wrongDeployment = createBrowserRuntime(
      new URL("http://127.0.0.1:8787"),
      undefined,
      "ff".repeat(32),
    );
    await expect(wrongDeployment.getPermit("20".repeat(32))).rejects.toMatchObject({
      code: "NP_WEB_INVALID_RELAY_ENVELOPE",
    });
  });

  it("rejects a relay envelope whose public signature does not verify", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({
      correlationId: "correlation-01",
      permit: {
        version: 1,
        permitBytes: "01",
        permitHash: "02".repeat(32),
        signature: "03".repeat(64),
        relayPublicKey: "04".repeat(32),
      },
    }), { status: 200, headers: { "content-type": "application/json" } })));
    const runtime = createBrowserRuntime(new URL("http://127.0.0.1:8787"), undefined, "04".repeat(32));
    await expect(runtime.getPermit("20".repeat(32))).rejects.toMatchObject({
      code: "NP_WEB_INVALID_RELAY_ENVELOPE",
    });
  });

  it("keeps the product bridge in the runtime closure instead of a mutable window global", async () => {
    const approve = vi.fn(async () => ({
      transactionId: "20".repeat(32),
      approvalCount: 1 as const,
      authorized: false,
    }));
    const runtime = createBrowserRuntime(new URL("http://127.0.0.1:8787"), {
      approve,
      claim: vi.fn(),
    });
    window.midnight = {
      lace: {
        apiVersion: "4.0.1",
        connect: async () => ({
          getConnectionStatus: async () => ({ status: "connected", networkId: "preprod" }),
        }),
      } as never,
    };
    await runtime.connectMidnight();
    await expect(runtime.approve({ privateStoragePassword: "local-only" })).resolves.toMatchObject({ approvalCount: 1 });
    expect(approve).toHaveBeenCalledOnce();
    expect("nightPermitBridge" in window).toBe(false);
  });
});
