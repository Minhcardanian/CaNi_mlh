import { type OutRef, type Script, validatorToAddress } from "@lucid-evolution/lucid";
import {
  parameterizeValidator,
  STATE_TOKEN_NAME,
  validatorHash,
  type ValidatorState,
} from "@nightpermit/cardano-client";
import { deploymentArguments, type DeploymentPolicy } from "@nightpermit/midnight-client";
import { decodeFixedHex } from "@nightpermit/permit";

export type DeploymentInputs = Omit<DeploymentPolicy, "cardanoValidatorHash"> & {
  relayKeyId: string;
  relayPublicKey: string;
  validatorCompiledCode: string;
  initializationRef: OutRef;
};

export type PreparedDeployment = {
  inputs: DeploymentInputs;
  midnightPolicy: DeploymentPolicy;
  validator: Script;
  validatorHash: string;
  validatorAddress: string;
};

export type FinalizedDeployment = PreparedDeployment & {
  midnightContractId: string;
  initialCardanoState: ValidatorState;
};

export type PublicProviderEndpoints = {
  relayUrl: string;
  midnightArtifactBaseUrl: string;
  cardanoKupoUrl: string;
  cardanoOgmiosUrl: string;
  cardanoFallbackKupoUrl?: string;
  cardanoFallbackOgmiosUrl?: string;
};

export type PublicRelayEndpoints = {
  midnightIndexerUrl: string;
  midnightIndexerWsUrl: string;
  cardanoOgmiosUrl: string;
};

export function prepareDeployment(inputs: DeploymentInputs): PreparedDeployment {
  decodeFixedHex(inputs.relayKeyId, 32, "relay key ID");
  decodeFixedHex(inputs.relayPublicKey, 32, "relay public key");
  const copiedInputs: DeploymentInputs = {
    ...inputs,
    initializationRef: { ...inputs.initializationRef },
  };
  const validator = parameterizeValidator(copiedInputs.validatorCompiledCode, copiedInputs.initializationRef);
  const cardanoValidatorHash = validatorHash(validator);
  const midnightPolicy: DeploymentPolicy = {
    policyId: copiedInputs.policyId,
    escrowId: copiedInputs.escrowId,
    milestoneId: copiedInputs.milestoneId,
    beneficiaryPkh: copiedInputs.beneficiaryPkh,
    actionId: copiedInputs.actionId,
    assetPolicyId: copiedInputs.assetPolicyId,
    assetName: copiedInputs.assetName,
    amount: copiedInputs.amount,
    cardanoValidatorHash,
    reviewerOnePublicKey: copiedInputs.reviewerOnePublicKey,
    reviewerTwoPublicKey: copiedInputs.reviewerTwoPublicKey,
  };
  deploymentArguments(midnightPolicy);
  return {
    inputs: copiedInputs,
    midnightPolicy,
    validator,
    validatorHash: cardanoValidatorHash,
    validatorAddress: validatorToAddress("Preview", validator),
  };
}

export function finalizeDeployment(
  prepared: PreparedDeployment,
  midnightContractId: string,
): FinalizedDeployment {
  decodeFixedHex(midnightContractId, 32, "Midnight contract ID");
  return {
    ...prepared,
    midnightContractId,
    initialCardanoState: {
      version: 1,
      stateThreadPolicyId: prepared.validatorHash,
      stateThreadAssetName: STATE_TOKEN_NAME,
      permitPolicy: {
        midnightContractId,
        policyId: prepared.inputs.policyId,
        escrowId: prepared.inputs.escrowId,
        milestoneId: prepared.inputs.milestoneId,
        beneficiaryPkh: prepared.inputs.beneficiaryPkh,
        actionId: prepared.inputs.actionId,
        assetPolicyId: prepared.inputs.assetPolicyId,
        assetName: prepared.inputs.assetName,
        amount: prepared.inputs.amount,
        cardanoValidatorHash: prepared.validatorHash,
        relayKeyId: prepared.inputs.relayKeyId,
        relayPublicKey: prepared.inputs.relayPublicKey,
      },
      consumedNullifiers: [],
      sequenceNumber: 0n,
    },
  };
}

export function relayPolicyDocument(deployment: FinalizedDeployment) {
  const policy = deployment.initialCardanoState.permitPolicy;
  return {
    version: 1 as const,
    policies: [{
      policyId: policy.policyId,
      escrowId: policy.escrowId,
      milestoneId: policy.milestoneId,
      beneficiaryPkh: policy.beneficiaryPkh,
      actionId: policy.actionId,
      assetPolicyId: policy.assetPolicyId,
      assetName: policy.assetName,
      amount: policy.amount.toString(),
      cardanoValidatorHash: policy.cardanoValidatorHash,
    }],
  };
}

export function relayPublicEnvironment(
  deployment: FinalizedDeployment,
  endpoints: PublicRelayEndpoints,
): Record<string, string> {
  return {
    MIDNIGHT_NETWORK: "preprod",
    MIDNIGHT_INDEXER_URL: endpoints.midnightIndexerUrl,
    MIDNIGHT_INDEXER_WS_URL: endpoints.midnightIndexerWsUrl,
    MIDNIGHT_CONTRACT_ID: deployment.midnightContractId,
    OGMIOS_URL: endpoints.cardanoOgmiosUrl,
    RELAY_KEY_ID: deployment.inputs.relayKeyId,
    RELAY_PUBLIC_KEY: deployment.inputs.relayPublicKey,
  };
}

export function browserEnvironment(
  deployment: FinalizedDeployment,
  endpoints: PublicProviderEndpoints,
): Record<string, string> {
  return {
    VITE_RELAY_URL: endpoints.relayUrl,
    VITE_RELAY_PUBLIC_KEY: deployment.inputs.relayPublicKey,
    VITE_MIDNIGHT_CONTRACT_ID: deployment.midnightContractId,
    VITE_MIDNIGHT_ARTIFACT_BASE_URL: endpoints.midnightArtifactBaseUrl,
    VITE_CARDANO_KUPO_URL: endpoints.cardanoKupoUrl,
    VITE_CARDANO_OGMIOS_URL: endpoints.cardanoOgmiosUrl,
    ...(endpoints.cardanoFallbackKupoUrl && endpoints.cardanoFallbackOgmiosUrl ? {
      VITE_CARDANO_FALLBACK_KUPO_URL: endpoints.cardanoFallbackKupoUrl,
      VITE_CARDANO_FALLBACK_OGMIOS_URL: endpoints.cardanoFallbackOgmiosUrl,
    } : {}),
    VITE_CARDANO_VALIDATOR_COMPILED_CODE: deployment.inputs.validatorCompiledCode,
    VITE_CARDANO_INITIALIZATION_TX_HASH: deployment.inputs.initializationRef.txHash,
    VITE_CARDANO_INITIALIZATION_OUTPUT_INDEX: deployment.inputs.initializationRef.outputIndex.toString(),
  };
}
