import type { WalletApi } from "@lucid-evolution/core-types";
import type { ConnectedAPI } from "@midnight-ntwrk/dapp-connector-api";
import { WebFlowError } from "./errors.js";
import { secureProviderEndpoint } from "./provider-url.js";
import { parseReviewerSecret } from "./reviewer-access.js";
import type { ProductBridge, ReviewerAccess } from "./runtime.js";

export type BrowserProductConfig = {
  midnightContractId: string;
  midnightArtifactBaseUrl: URL;
  cardanoKupoUrl: string;
  cardanoOgmiosUrl: string;
  cardanoValidatorCompiledCode: string;
  cardanoInitializationTxHash: string;
  cardanoInitializationOutputIndex: number;
};

type PublicEnvironment = Record<string, string | boolean | undefined>;

function configured(value: string | boolean | undefined): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new WebFlowError("NP_WEB_RUNTIME_NOT_CONFIGURED");
  }
  return value;
}

function lowerHex(value: string, bytes?: number): string {
  const expected = bytes === undefined ? /^[0-9a-f]+$/ : new RegExp(`^[0-9a-f]{${bytes * 2}}$`);
  if (!expected.test(value) || value.length % 2 !== 0) {
    throw new WebFlowError("NP_WEB_RUNTIME_NOT_CONFIGURED");
  }
  return value;
}

function outputIndex(value: string | boolean | undefined): number {
  const parsed = Number(configured(value));
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new WebFlowError("NP_WEB_RUNTIME_NOT_CONFIGURED");
  }
  return parsed;
}

export function productConfigFromEnvironment(
  environment: PublicEnvironment,
  pageUrl = window.location.href,
): BrowserProductConfig {
  return {
    midnightContractId: lowerHex(configured(environment.VITE_MIDNIGHT_CONTRACT_ID), 32),
    midnightArtifactBaseUrl: new URL(secureProviderEndpoint(new URL(
      configured(environment.VITE_MIDNIGHT_ARTIFACT_BASE_URL), pageUrl,
    ).href)),
    cardanoKupoUrl: secureProviderEndpoint(configured(environment.VITE_CARDANO_KUPO_URL)),
    cardanoOgmiosUrl: secureProviderEndpoint(configured(environment.VITE_CARDANO_OGMIOS_URL)),
    cardanoValidatorCompiledCode: lowerHex(configured(environment.VITE_CARDANO_VALIDATOR_COMPILED_CODE)),
    cardanoInitializationTxHash: lowerHex(configured(environment.VITE_CARDANO_INITIALIZATION_TX_HASH), 32),
    cardanoInitializationOutputIndex: outputIndex(environment.VITE_CARDANO_INITIALIZATION_OUTPUT_INDEX),
  };
}

export function createProductBridge(config: BrowserProductConfig): ProductBridge {
  return {
    async approve(connectedWallet: ConnectedAPI, access: ReviewerAccess) {
      const secret = parseReviewerSecret(access);
      const [{ createMidnightBrowserProviders }, { joinNightPermit }] = await Promise.all([
        import("./midnight-browser.js"),
        import("@nightpermit/midnight-client"),
      ]);
      const providers = await createMidnightBrowserProviders(connectedWallet, {
        artifactBaseUrl: config.midnightArtifactBaseUrl,
        privateStoragePasswordProvider: () => access.privateStoragePassword,
      });
      const api = await joinNightPermit(providers, config.midnightContractId, secret);
      return api.approve();
    },
    async claim(wallet: WalletApi, permit) {
      const [{ Kupmios, Lucid }, { parameterizeValidator, submitWalletClaim }] = await Promise.all([
        import("@lucid-evolution/lucid"),
        import("@nightpermit/cardano-client"),
      ]);
      let validator;
      try {
        validator = parameterizeValidator(config.cardanoValidatorCompiledCode, {
          txHash: config.cardanoInitializationTxHash,
          outputIndex: config.cardanoInitializationOutputIndex,
        });
      } catch (cause) {
        throw new WebFlowError("NP_WEB_RUNTIME_NOT_CONFIGURED", { cause });
      }
      const provider = new Kupmios(config.cardanoKupoUrl, config.cardanoOgmiosUrl);
      const lucid = await Lucid(provider, "Preview");
      lucid.selectWallet.fromAPI(wallet);
      return submitWalletClaim(lucid, permit, validator);
    },
  };
}
