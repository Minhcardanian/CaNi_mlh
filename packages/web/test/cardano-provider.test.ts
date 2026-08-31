import { describe, expect, it, vi } from "vitest";
import {
  cardanoProviderEndpoints,
  createPreviewLucid,
  type CardanoProviderEndpoints,
} from "../src/cardano-provider.js";

describe("Cardano Preview provider selection", () => {
  it("validates one primary and one optional complete fallback pair", () => {
    expect(cardanoProviderEndpoints({
      kupoUrl: "http://127.0.0.1:1442",
      ogmiosUrl: "http://127.0.0.1:1337",
    }, {
      kupoUrl: "https://kupo.example.test",
      ogmiosUrl: "https://ogmios.example.test",
    }).map(({ name }) => name)).toEqual(["primary", "fallback"]);
    expect(() => cardanoProviderEndpoints({
      kupoUrl: "http://127.0.0.1:1442",
      ogmiosUrl: "http://127.0.0.1:1337",
    }, { kupoUrl: "https://kupo.example.test" })).toThrowError(expect.objectContaining({
      code: "NP_WEB_RUNTIME_NOT_CONFIGURED",
    }));
  });

  it("falls back only while creating a provider and selects the wallet once", async () => {
    const selected = vi.fn();
    const lucid = { selectWallet: { fromAPI: selected } };
    const factory = vi.fn(async ({ name }: CardanoProviderEndpoints) => {
      if (name === "primary") throw new Error("private provider detail");
      return lucid as never;
    });
    const endpoints = cardanoProviderEndpoints({
      kupoUrl: "http://127.0.0.1:1442",
      ogmiosUrl: "http://127.0.0.1:1337",
    }, {
      kupoUrl: "https://kupo.example.test",
      ogmiosUrl: "https://ogmios.example.test",
    });
    const wallet = {} as never;
    await expect(createPreviewLucid(endpoints, wallet, factory)).resolves.toEqual({
      lucid,
      provider: "fallback",
    });
    expect(factory.mock.calls.map(([candidate]) => candidate.name)).toEqual(["primary", "fallback"]);
    expect(selected).toHaveBeenCalledOnce();
    expect(selected).toHaveBeenCalledWith(wallet);
  });

  it("returns one stable error after every provider fails", async () => {
    const endpoints = cardanoProviderEndpoints({
      kupoUrl: "http://127.0.0.1:1442",
      ogmiosUrl: "http://127.0.0.1:1337",
    });
    await expect(createPreviewLucid(endpoints, {} as never, async () => {
      throw new Error("must not escape");
    })).rejects.toMatchObject({ code: "NP_WEB_CARDANO_PROVIDER_UNAVAILABLE" });
  });

  it("never switches providers after wallet selection begins", async () => {
    const factory = vi.fn(async () => ({
      selectWallet: { fromAPI: () => { throw new Error("wallet declined"); } },
    }) as never);
    const endpoints = cardanoProviderEndpoints({
      kupoUrl: "http://127.0.0.1:1442",
      ogmiosUrl: "http://127.0.0.1:1337",
    }, {
      kupoUrl: "https://kupo.example.test",
      ogmiosUrl: "https://ogmios.example.test",
    });
    await expect(createPreviewLucid(endpoints, {} as never, factory)).rejects.toMatchObject({
      code: "NP_WEB_WALLET_REJECTED",
    });
    expect(factory).toHaveBeenCalledOnce();
  });
});
