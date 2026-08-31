import type { ConnectedAPI } from "@midnight-ntwrk/dapp-connector-api";
import { FetchZkConfigProvider } from "@midnight-ntwrk/midnight-js-fetch-zk-config-provider";
import { indexerPublicDataProvider } from "@midnight-ntwrk/midnight-js-indexer-public-data-provider";
import { levelPrivateStateProvider } from "@midnight-ntwrk/midnight-js-level-private-state-provider";
import { setNetworkId } from "@midnight-ntwrk/midnight-js-network-id";
import { fromHex, toHex } from "@midnight-ntwrk/midnight-js-protocol/compact-runtime";
import {
  Binding,
  Proof,
  SignatureEnabled,
  Transaction,
  type FinalizedTransaction,
  type TransactionId,
} from "@midnight-ntwrk/midnight-js-protocol/ledger";
import { createProofProvider, type UnboundTransaction } from "@midnight-ntwrk/midnight-js-types";
import type { NightPermitProviders } from "@nightpermit/midnight-client";
import type { NightPermitPrivateState } from "@nightpermit/midnight-contract";
import { WebFlowError } from "./errors.js";
import { secureProviderEndpoint } from "./provider-url.js";

export type MidnightBrowserOptions = {
  artifactBaseUrl: URL;
  privateStoragePasswordProvider: () => string | Promise<string>;
};

export async function createMidnightBrowserProviders(
  connectedApi: ConnectedAPI,
  options: MidnightBrowserOptions,
): Promise<NightPermitProviders> {
  setNetworkId("preprod");
  await connectedApi.hintUsage([
    "getShieldedAddresses",
    "getConfiguration",
    "getConnectionStatus",
    "getProvingProvider",
    "balanceUnsealedTransaction",
    "submitTransaction",
  ]);
  const [status, configuration, shieldedAddresses] = await Promise.all([
    connectedApi.getConnectionStatus(),
    connectedApi.getConfiguration(),
    connectedApi.getShieldedAddresses(),
  ]);
  if (status.status !== "connected" || status.networkId !== "preprod" || configuration.networkId !== "preprod") {
    throw new WebFlowError("NP_WEB_WRONG_MIDNIGHT_NETWORK");
  }
  const indexerUri = secureProviderEndpoint(configuration.indexerUri);
  const indexerWsUri = secureProviderEndpoint(configuration.indexerWsUri, true);
  const artifactBase = secureProviderEndpoint(options.artifactBaseUrl.href);
  const zkConfigProvider = new FetchZkConfigProvider<"approve">(artifactBase, fetch.bind(window));
  const privateStateProvider = levelPrivateStateProvider<"nightPermitReviewerV1", NightPermitPrivateState>({
    accountId: shieldedAddresses.shieldedCoinPublicKey,
    privateStoragePasswordProvider: options.privateStoragePasswordProvider,
  });
  const provingProvider = await connectedApi.getProvingProvider(zkConfigProvider);

  return {
    privateStateProvider,
    zkConfigProvider,
    proofProvider: createProofProvider(provingProvider),
    publicDataProvider: indexerPublicDataProvider(indexerUri, indexerWsUri),
    walletProvider: {
      getCoinPublicKey: () => shieldedAddresses.shieldedCoinPublicKey,
      getEncryptionPublicKey: () => shieldedAddresses.shieldedEncryptionPublicKey,
      async balanceTx(tx: UnboundTransaction): Promise<FinalizedTransaction> {
        const balanced = await connectedApi.balanceUnsealedTransaction(toHex(tx.serialize()));
        return Transaction.deserialize<SignatureEnabled, Proof, Binding>(
          "signature",
          "proof",
          "binding",
          fromHex(balanced.tx),
        );
      },
    },
    midnightProvider: {
      async submitTx(tx: FinalizedTransaction): Promise<TransactionId> {
        await connectedApi.submitTransaction(toHex(tx.serialize()));
        const transactionId = tx.identifiers()[0];
        if (!transactionId) throw new WebFlowError("NP_WEB_UNEXPECTED");
        return transactionId;
      },
    },
  };
}
