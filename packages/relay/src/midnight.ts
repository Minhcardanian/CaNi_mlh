import { indexerPublicDataProvider } from "@midnight-ntwrk/midnight-js-indexer-public-data-provider";
import { asContractAddress } from "@midnight-ntwrk/midnight-js-types";
import { ledger } from "@nightpermit/midnight-contract";
import { encodeHex, type Hex } from "@nightpermit/permit";
import { firstValueFrom, timeout } from "rxjs";
import { RelayError } from "./errors.js";

export type AuthorizationSnapshot = {
  contractId: Hex;
  transactionId: Hex;
  policyId: Hex;
  escrowId: Hex;
  milestoneId: Hex;
  beneficiaryPkh: Hex;
  actionId: Hex;
  assetPolicyId: Hex;
  assetName: Hex;
  amount: bigint;
  cardanoValidatorHash: Hex;
  approvalCount: bigint;
  authorized: boolean;
  authorizationNullifier: Hex;
};

export interface AuthorizationSource {
  readAtTransaction(transactionId: Hex): Promise<AuthorizationSnapshot>;
}

export type MidnightSourceOptions = {
  indexerUrl: URL;
  indexerWsUrl: URL;
  contractId: Hex;
  timeoutMs: number;
  maxAttempts: number;
};

export function createMidnightAuthorizationSource(options: MidnightSourceOptions): AuthorizationSource {
  const provider = indexerPublicDataProvider(
    options.indexerUrl.toString(),
    options.indexerWsUrl.toString(),
  );
  return {
    async readAtTransaction(transactionId) {
      let lastError: unknown;
      for (let attempt = 1; attempt <= options.maxAttempts; attempt += 1) {
        try {
          const state = await firstValueFrom(
            provider
              .contractStateObservable(asContractAddress(options.contractId), {
                type: "txId",
                txId: transactionId,
              })
              .pipe(timeout({ first: options.timeoutMs })),
          );
          const value = ledger(state.data);
          return {
            contractId: options.contractId,
            transactionId,
            policyId: encodeHex(value.policyId),
            escrowId: encodeHex(value.escrowId),
            milestoneId: encodeHex(value.milestoneId),
            beneficiaryPkh: encodeHex(value.beneficiaryPkh),
            actionId: encodeHex(value.actionId),
            assetPolicyId: encodeHex(value.assetPolicyId),
            assetName: encodeHex(value.assetName),
            amount: value.amount,
            cardanoValidatorHash: encodeHex(value.cardanoValidatorHash),
            approvalCount: value.approvalCount,
            authorized: value.authorized,
            authorizationNullifier: encodeHex(value.authorizationNullifier),
          };
        } catch (error) {
          lastError = error;
        }
      }
      throw new RelayError(
        "NP_RELAY_PROVIDER_TIMEOUT",
        "Midnight authorization was not confirmed before the provider deadline",
        504,
        { cause: lastError },
      );
    },
  };
}
