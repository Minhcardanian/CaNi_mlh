import type { WalletApi } from "@lucid-evolution/core-types";
import type { LucidEvolution, OutRef } from "@lucid-evolution/lucid";
import type { ConnectedAPI } from "@midnight-ntwrk/dapp-connector-api";
import type {
  DeploymentInputs,
  FinalizedDeployment,
  PreparedDeployment,
} from "@nightpermit/deployment";
import { WebFlowError } from "./errors.js";
import { createMidnightBrowserProviders } from "./midnight-browser.js";
import { secureProviderEndpoint } from "./provider-url.js";
import { parseReviewerSecret } from "./reviewer-access.js";
import {
  connectCardanoWallet,
  connectMidnightWallet,
  type ReviewerAccess,
} from "./runtime.js";
import type { PublicWallet } from "./state.js";

export type DeploymentRuntimeConfig = {
  validatorCompiledCode: string;
  midnightArtifactBaseUrl: URL;
  cardanoKupoUrl: string;
  cardanoOgmiosUrl: string;
  relayUrl: string;
};

export type InitializationCandidate = OutRef & {
  lovelace: string;
  assetCount: number;
};

export type DeploymentArtifacts = {
  browserEnvironment: Record<string, string>;
  relayEnvironment: Record<string, string>;
  relayPolicy: ReturnType<(typeof import("@nightpermit/deployment"))["relayPolicyDocument"]>;
};

export type DeploymentRuntime = {
  connectMidnight(): Promise<PublicWallet>;
  connectCardano(): Promise<PublicWallet>;
  initializationCandidates(): Promise<InitializationCandidate[]>;
  prepare(inputs: Omit<DeploymentInputs, "validatorCompiledCode" | "initializationRef">, initializationRef: OutRef): Promise<{
    validatorHash: string;
    validatorAddress: string;
  }>;
  deployMidnight(access: ReviewerAccess): Promise<{ contractId: string; transactionId: string; blockHeight: number }>;
  initializeCardano(lovelace: bigint): Promise<{ transactionId: string; awaitConfirmation(): Promise<void> }>;
  artifacts(): Promise<DeploymentArtifacts>;
};

export function createDeploymentRuntime(config: DeploymentRuntimeConfig): DeploymentRuntime {
  const endpoints = {
    midnightArtifactBaseUrl: new URL(secureProviderEndpoint(config.midnightArtifactBaseUrl.href)),
    cardanoKupoUrl: secureProviderEndpoint(config.cardanoKupoUrl),
    cardanoOgmiosUrl: secureProviderEndpoint(config.cardanoOgmiosUrl),
    relayUrl: secureProviderEndpoint(config.relayUrl),
  };
  let midnightWallet: ConnectedAPI | undefined;
  let cardanoWallet: WalletApi | undefined;
  let lucid: LucidEvolution | undefined;
  let prepared: PreparedDeployment | undefined;
  let finalized: FinalizedDeployment | undefined;

  async function cardanoLucid(): Promise<LucidEvolution> {
    if (!cardanoWallet) throw new WebFlowError("NP_WEB_CARDANO_WALLET_MISSING");
    if (!lucid) {
      const { Kupmios, Lucid } = await import("@lucid-evolution/lucid");
      lucid = await Lucid(new Kupmios(endpoints.cardanoKupoUrl, endpoints.cardanoOgmiosUrl), "Preview");
      lucid.selectWallet.fromAPI(cardanoWallet);
    }
    return lucid;
  }

  return {
    async connectMidnight() {
      const connected = await connectMidnightWallet();
      midnightWallet = connected.api;
      return connected.wallet;
    },
    async connectCardano() {
      const connected = await connectCardanoWallet();
      cardanoWallet = connected.api;
      lucid = undefined;
      return connected.wallet;
    },
    async initializationCandidates() {
      const walletUtxos = await (await cardanoLucid()).wallet().getUtxos();
      return walletUtxos
        .map((utxo) => ({
          txHash: utxo.txHash,
          outputIndex: utxo.outputIndex,
          lovelace: (utxo.assets.lovelace ?? 0n).toString(),
          assetCount: Object.keys(utxo.assets).length,
        }))
        .sort((left, right) => left.txHash.localeCompare(right.txHash) || left.outputIndex - right.outputIndex);
    },
    async prepare(inputs, initializationRef) {
      const { prepareDeployment } = await import("@nightpermit/deployment");
      prepared = prepareDeployment({
        ...inputs,
        validatorCompiledCode: config.validatorCompiledCode,
        initializationRef,
      });
      finalized = undefined;
      return {
        validatorHash: prepared.validatorHash,
        validatorAddress: prepared.validatorAddress,
      };
    },
    async deployMidnight(access) {
      if (!midnightWallet || !prepared) throw new WebFlowError("NP_WEB_RUNTIME_NOT_CONFIGURED");
      const reviewerSecret = parseReviewerSecret(access);
      if (!reviewerSecret) throw new WebFlowError("NP_WEB_BAD_REVIEWER_SECRET");
      const [{ deployNightPermit }, { finalizeDeployment }] = await Promise.all([
        import("@nightpermit/midnight-client"),
        import("@nightpermit/deployment"),
      ]);
      const providers = await createMidnightBrowserProviders(midnightWallet, {
        artifactBaseUrl: endpoints.midnightArtifactBaseUrl,
        privateStoragePasswordProvider: () => access.privateStoragePassword,
      });
      const deployed = await deployNightPermit(providers, prepared.midnightPolicy, reviewerSecret);
      finalized = finalizeDeployment(prepared, deployed.api.contractAddress);
      return {
        contractId: deployed.api.contractAddress,
        transactionId: deployed.transactionId,
        blockHeight: deployed.blockHeight,
      };
    },
    async initializeCardano(lovelace) {
      if (!finalized || lovelace <= 0n) throw new WebFlowError("NP_WEB_RUNTIME_NOT_CONFIGURED");
      const { submitWalletInitialization } = await import("@nightpermit/cardano-client");
      const policy = finalized.initialCardanoState.permitPolicy;
      const result = await submitWalletInitialization(await cardanoLucid(), {
        compiledCode: finalized.inputs.validatorCompiledCode,
        initializationRef: finalized.inputs.initializationRef,
        initialState: finalized.initialCardanoState,
        inventory: {
          lovelace,
          [policy.assetPolicyId + policy.assetName]: policy.amount,
        },
      });
      return { transactionId: result.transactionId, awaitConfirmation: result.awaitConfirmation };
    },
    async artifacts() {
      if (!finalized || !midnightWallet) throw new WebFlowError("NP_WEB_RUNTIME_NOT_CONFIGURED");
      const configuration = await midnightWallet.getConfiguration();
      if (configuration.networkId !== "preprod") throw new WebFlowError("NP_WEB_WRONG_MIDNIGHT_NETWORK");
      const {
        browserEnvironment,
        relayPolicyDocument,
        relayPublicEnvironment,
      } = await import("@nightpermit/deployment");
      return {
        browserEnvironment: browserEnvironment(finalized, {
          relayUrl: endpoints.relayUrl,
          midnightArtifactBaseUrl: endpoints.midnightArtifactBaseUrl.href,
          cardanoKupoUrl: endpoints.cardanoKupoUrl,
          cardanoOgmiosUrl: endpoints.cardanoOgmiosUrl,
        }),
        relayEnvironment: relayPublicEnvironment(finalized, {
          midnightIndexerUrl: secureProviderEndpoint(configuration.indexerUri),
          midnightIndexerWsUrl: secureProviderEndpoint(configuration.indexerWsUri, true),
          cardanoOgmiosUrl: endpoints.cardanoOgmiosUrl,
        }),
        relayPolicy: relayPolicyDocument(finalized),
      };
    },
  };
}
