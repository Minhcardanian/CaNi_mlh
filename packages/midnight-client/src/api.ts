import { deployContract, findDeployedContract } from "@midnight-ntwrk/midnight-js-contracts";
import { fromHex } from "@midnight-ntwrk/midnight-js-protocol/compact-runtime";
import { toHex } from "@midnight-ntwrk/midnight-js-utils";
import {
  compiledContract,
  createPrivateState,
  ledger,
  nightPermitPrivateStateKey,
  pureCircuits,
} from "@nightpermit/midnight-contract";
import { firstValueFrom, map, timeout } from "rxjs";
import { MidnightClientError } from "./errors.js";
import { assertReviewerSecret, deploymentArguments } from "./policy.js";
import type {
  DeployedNightPermitContract,
  DeploymentPolicy,
  NightPermitProviders,
  PublicAuthorizationState,
} from "./types.js";

function publicState(value: ReturnType<typeof ledger>): PublicAuthorizationState {
  const count = Number(value.approvalCount);
  if (count !== 0 && count !== 1 && count !== 2) {
    throw new MidnightClientError("NP_MIDNIGHT_STATE_NOT_FOUND", "approval count is outside the fixed threshold");
  }
  return {
    approvalCount: count,
    authorized: value.authorized,
    authorizationNullifier: toHex(value.authorizationNullifier),
    reviewerOnePublicKey: toHex(value.reviewerOnePublicKey),
    reviewerTwoPublicKey: toHex(value.reviewerTwoPublicKey),
  };
}

async function latestLedger(providers: NightPermitProviders, address: string) {
  const state = await providers.publicDataProvider.queryContractState(address);
  if (!state) throw new MidnightClientError("NP_MIDNIGHT_STATE_NOT_FOUND", "contract state was not found");
  return ledger(state.data);
}

export class NightPermitAPI {
  constructor(
    readonly deployedContract: DeployedNightPermitContract,
    private readonly providers: NightPermitProviders,
    private readonly stateTimeoutMs = 30_000,
  ) {
    providers.privateStateProvider.setContractAddress(this.contractAddress);
  }

  get contractAddress(): string {
    return this.deployedContract.deployTxData.public.contractAddress;
  }

  async state(): Promise<PublicAuthorizationState> {
    return publicState(await latestLedger(this.providers, this.contractAddress));
  }

  async approve(): Promise<{ transactionId: string; approvalCount: 1 | 2; authorized: boolean }> {
    const current = await latestLedger(this.providers, this.contractAddress);
    if (current.authorized) {
      throw new MidnightClientError("NP_MIDNIGHT_ALREADY_AUTHORIZED", "milestone is already authorized");
    }
    const privateState = await this.providers.privateStateProvider.get(nightPermitPrivateStateKey);
    if (!privateState) {
      throw new MidnightClientError("NP_MIDNIGHT_BAD_PRIVATE_STATE", "reviewer private state is not provisioned");
    }
    assertReviewerSecret(privateState.reviewerSecret, current.reviewerOnePublicKey, current.reviewerTwoPublicKey);
    const reviewerNullifier = pureCircuits.reviewerNullifier(
      privateState.reviewerSecret,
      current.milestoneId,
      fromHex(this.contractAddress),
    );
    if (current.reviewerNullifiers.member(reviewerNullifier)) {
      throw new MidnightClientError("NP_MIDNIGHT_ALREADY_APPROVED", "this reviewer already approved the milestone");
    }

    const transaction = await this.deployedContract.callTx.approve();
    const transactionId = transaction.public.txId;
    try {
      const next = await firstValueFrom(this.providers.publicDataProvider.contractStateObservable(
        this.contractAddress,
        { type: "txId", txId: transactionId, inclusive: true },
      ).pipe(
        map((state) => publicState(ledger(state.data))),
        timeout({ first: this.stateTimeoutMs }),
      ));
      if (next.approvalCount !== 1 && next.approvalCount !== 2) {
        throw new MidnightClientError("NP_MIDNIGHT_STATE_NOT_FOUND", "approval did not advance the public threshold");
      }
      return { transactionId, approvalCount: next.approvalCount, authorized: next.authorized };
    } catch (cause) {
      if (cause instanceof MidnightClientError) throw cause;
      throw new MidnightClientError("NP_MIDNIGHT_STATE_TIMEOUT", "exact approval state was not observed before timeout", { cause });
    }
  }
}

export async function deployNightPermit(
  providers: NightPermitProviders,
  policy: DeploymentPolicy,
  reviewerSecret: Uint8Array,
): Promise<{ api: NightPermitAPI; transactionId: string; blockHeight: number }> {
  const args = deploymentArguments(policy);
  assertReviewerSecret(reviewerSecret, args[9], args[10]);
  const deployed = await deployContract(providers, {
    compiledContract,
    args,
    privateStateId: nightPermitPrivateStateKey,
    initialPrivateState: createPrivateState(reviewerSecret),
  });
  return {
    api: new NightPermitAPI(deployed, providers),
    transactionId: deployed.deployTxData.public.txId,
    blockHeight: deployed.deployTxData.public.blockHeight,
  };
}

export async function joinNightPermit(
  providers: NightPermitProviders,
  contractAddress: string,
  reviewerSecret?: Uint8Array,
): Promise<NightPermitAPI> {
  if (!/^[0-9a-f]{64}$/.test(contractAddress)) {
    throw new MidnightClientError("NP_MIDNIGHT_BAD_POLICY", "contract address must contain 32 lowercase hexadecimal bytes");
  }
  providers.privateStateProvider.setContractAddress(contractAddress);
  const existing = await providers.privateStateProvider.get(nightPermitPrivateStateKey);
  const privateState = existing ?? (reviewerSecret ? createPrivateState(reviewerSecret) : undefined);
  if (!privateState) {
    throw new MidnightClientError("NP_MIDNIGHT_BAD_PRIVATE_STATE", "reviewer secret must be provisioned once before joining");
  }
  const current = await latestLedger(providers, contractAddress);
  assertReviewerSecret(privateState.reviewerSecret, current.reviewerOnePublicKey, current.reviewerTwoPublicKey);
  const deployed = existing
    ? await findDeployedContract(providers, {
        contractAddress,
        compiledContract,
        privateStateId: nightPermitPrivateStateKey,
      })
    : await findDeployedContract(providers, {
        contractAddress,
        compiledContract,
        privateStateId: nightPermitPrivateStateKey,
        initialPrivateState: privateState,
      });
  return new NightPermitAPI(deployed, providers);
}
