import type { WalletApi } from "@lucid-evolution/core-types";
import { Kupmios, Lucid } from "@lucid-evolution/lucid";
import type { ConnectedAPI } from "@midnight-ntwrk/dapp-connector-api";
import { validatePassword } from "@midnight-ntwrk/midnight-js-utils";
import { parameterizeValidator, submitWalletClaim } from "@nightpermit/cardano-client";
import { joinNightPermit } from "@nightpermit/midnight-client";
import { WebFlowError } from "./errors.js";
import { createMidnightBrowserProviders, secureProviderEndpoint } from "./midnight-browser.js";
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

function reviewerSecret(access: ReviewerAccess): Uint8Array | undefined {
  try {
    validatePassword(access.privateStoragePassword);
  } catch (cause) {
    throw new WebFlowError("NP_WEB_BAD_STORAGE_PASSWORD", { cause });
  }
  if (access.reviewerSecretHex === undefined) return undefined;
  if (!/^[0-9a-f]{64}$/.test(access.reviewerSecretHex)) {
    throw new WebFlowError("NP_WEB_BAD_REVIEWER_SECRET");
  }
  return Uint8Array.from(access.reviewerSecretHex.match(/.{2}/g)!, (byte) => Number.parseInt(byte, 16));
}

export function createProductBridge(config: BrowserProductConfig): ProductBridge {
  let validator;
  try {
    validator = parameterizeValidator(config.cardanoValidatorCompiledCode, {
      txHash: config.cardanoInitializationTxHash,
      outputIndex: config.cardanoInitializationOutputIndex,
    });
  } catch (cause) {
    throw new WebFlowError("NP_WEB_RUNTIME_NOT_CONFIGURED", { cause });
  }
  return {
    async approve(connectedWallet: ConnectedAPI, access: ReviewerAccess) {
      const secret = reviewerSecret(access);
      const providers = await createMidnightBrowserProviders(connectedWallet, {
        artifactBaseUrl: config.midnightArtifactBaseUrl,
        privateStoragePasswordProvider: () => access.privateStoragePassword,
      });
      const api = await joinNightPermit(providers, config.midnightContractId, secret);
      return api.approve();
    },
    async claim(wallet: WalletApi, permit) {
      const provider = new Kupmios(config.cardanoKupoUrl, config.cardanoOgmiosUrl);
      const lucid = await Lucid(provider, "Preview");
      lucid.selectWallet.fromAPI(wallet);
      return submitWalletClaim(lucid, permit, validator);
    },
  };
}
