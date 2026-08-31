import type { FoundContract } from "@midnight-ntwrk/midnight-js-contracts";
import type { MidnightProviders } from "@midnight-ntwrk/midnight-js-types";
import type {
  Contract,
  NightPermitPrivateState,
  Witnesses,
} from "@nightpermit/midnight-contract";

export type NightPermitContract = Contract<
  NightPermitPrivateState,
  Witnesses<NightPermitPrivateState>
>;
export type NightPermitCircuitKey = Exclude<keyof NightPermitContract["impureCircuits"], number | symbol>;
export type NightPermitProviders = MidnightProviders<
  NightPermitCircuitKey,
  "nightPermitReviewerV1",
  NightPermitPrivateState
>;
export type DeployedNightPermitContract = FoundContract<NightPermitContract>;

export type DeploymentPolicy = {
  policyId: string;
  escrowId: string;
  milestoneId: string;
  beneficiaryPkh: string;
  actionId: string;
  assetPolicyId: string;
  assetName: string;
  amount: bigint;
  cardanoValidatorHash: string;
  reviewerOnePublicKey: string;
  reviewerTwoPublicKey: string;
};

export type PublicAuthorizationState = {
  approvalCount: 0 | 1 | 2;
  authorized: boolean;
  authorizationNullifier: string;
  reviewerOnePublicKey: string;
  reviewerTwoPublicKey: string;
};
