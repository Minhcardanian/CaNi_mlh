import type { WalletApi } from "@lucid-evolution/core-types";
import type { LucidEvolution } from "@lucid-evolution/lucid";
import { WebFlowError } from "./errors.js";
import { secureProviderEndpoint } from "./provider-url.js";

export type CardanoProviderEndpoints = {
  name: "primary" | "fallback";
  kupoUrl: string;
  ogmiosUrl: string;
};

export type PreviewLucidFactory = (
  endpoints: CardanoProviderEndpoints,
) => Promise<LucidEvolution>;

export function cardanoProviderEndpoints(
  primary: { kupoUrl: string; ogmiosUrl: string },
  fallback?: { kupoUrl?: string | undefined; ogmiosUrl?: string | undefined },
): CardanoProviderEndpoints[] {
  const endpoints: CardanoProviderEndpoints[] = [{
    name: "primary",
    kupoUrl: secureProviderEndpoint(primary.kupoUrl),
    ogmiosUrl: secureProviderEndpoint(primary.ogmiosUrl),
  }];
  const hasFallback = Boolean(fallback?.kupoUrl || fallback?.ogmiosUrl);
  if (hasFallback && (!fallback?.kupoUrl || !fallback.ogmiosUrl)) {
    throw new WebFlowError("NP_WEB_RUNTIME_NOT_CONFIGURED");
  }
  if (fallback?.kupoUrl && fallback.ogmiosUrl) {
    endpoints.push({
      name: "fallback",
      kupoUrl: secureProviderEndpoint(fallback.kupoUrl),
      ogmiosUrl: secureProviderEndpoint(fallback.ogmiosUrl),
    });
  }
  return endpoints;
}

async function defaultFactory(endpoints: CardanoProviderEndpoints): Promise<LucidEvolution> {
  const { Kupmios, Lucid } = await import("@lucid-evolution/lucid");
  return Lucid(new Kupmios(endpoints.kupoUrl, endpoints.ogmiosUrl), "Preview");
}

export async function createPreviewLucid(
  endpoints: readonly CardanoProviderEndpoints[],
  wallet: WalletApi,
  factory: PreviewLucidFactory = defaultFactory,
): Promise<{ lucid: LucidEvolution; provider: CardanoProviderEndpoints["name"] }> {
  let selected: { lucid: LucidEvolution; provider: CardanoProviderEndpoints["name"] } | undefined;
  for (const candidate of endpoints) {
    try {
      const lucid = await factory(candidate);
      selected = { lucid, provider: candidate.name };
      break;
    } catch {
      // Provider payloads can contain operational details; expose one stable failure only.
    }
  }
  if (!selected) throw new WebFlowError("NP_WEB_CARDANO_PROVIDER_UNAVAILABLE");
  try {
    selected.lucid.selectWallet.fromAPI(wallet);
  } catch (cause) {
    throw new WebFlowError("NP_WEB_WALLET_REJECTED", { cause });
  }
  return selected;
}
