import type * as __compactRuntime from '@midnight-ntwrk/compact-runtime';

export type Witnesses<PS> = {
  localReviewerSecret(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, Uint8Array];
}

export type ImpureCircuits<PS> = {
  approve(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, []>;
}

export type ProvableCircuits<PS> = {
  approve(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, []>;
}

export type PureCircuits = {
  reviewerKey(secret_0: Uint8Array): Uint8Array;
  reviewerNullifier(secret_0: Uint8Array,
                    milestone_0: Uint8Array,
                    deployment_0: Uint8Array): Uint8Array;
  authorizationId(policy_0: Uint8Array,
                  escrow_0: Uint8Array,
                  milestone_0: Uint8Array,
                  beneficiary_0: Uint8Array,
                  action_0: Uint8Array,
                  assetPolicy_0: Uint8Array,
                  asset_0: Uint8Array,
                  trancheAmount_0: bigint,
                  deployment_0: Uint8Array,
                  validator_0: Uint8Array): Uint8Array;
}

export type Circuits<PS> = {
  approve(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, []>;
  reviewerKey(context: __compactRuntime.CircuitContext<PS>, secret_0: Uint8Array): __compactRuntime.CircuitResults<PS, Uint8Array>;
  reviewerNullifier(context: __compactRuntime.CircuitContext<PS>,
                    secret_0: Uint8Array,
                    milestone_0: Uint8Array,
                    deployment_0: Uint8Array): __compactRuntime.CircuitResults<PS, Uint8Array>;
  authorizationId(context: __compactRuntime.CircuitContext<PS>,
                  policy_0: Uint8Array,
                  escrow_0: Uint8Array,
                  milestone_0: Uint8Array,
                  beneficiary_0: Uint8Array,
                  action_0: Uint8Array,
                  assetPolicy_0: Uint8Array,
                  asset_0: Uint8Array,
                  trancheAmount_0: bigint,
                  deployment_0: Uint8Array,
                  validator_0: Uint8Array): __compactRuntime.CircuitResults<PS, Uint8Array>;
}

export type Ledger = {
  readonly policyId: Uint8Array;
  readonly escrowId: Uint8Array;
  readonly milestoneId: Uint8Array;
  readonly beneficiaryPkh: Uint8Array;
  readonly actionId: Uint8Array;
  readonly assetPolicyId: Uint8Array;
  readonly assetName: Uint8Array;
  readonly amount: bigint;
  readonly cardanoValidatorHash: Uint8Array;
  readonly reviewerOnePublicKey: Uint8Array;
  readonly reviewerTwoPublicKey: Uint8Array;
  reviewerNullifiers: {
    isEmpty(): boolean;
    size(): bigint;
    member(elem_0: Uint8Array): boolean;
    [Symbol.iterator](): Iterator<Uint8Array>
  };
  readonly approvalCount: bigint;
  readonly authorized: boolean;
  readonly authorizationNullifier: Uint8Array;
}

export type ContractReferenceLocations = any;

export declare const contractReferenceLocations : ContractReferenceLocations;

export declare class Contract<PS = any, W extends Witnesses<PS> = Witnesses<PS>> {
  witnesses: W;
  circuits: Circuits<PS>;
  impureCircuits: ImpureCircuits<PS>;
  provableCircuits: ProvableCircuits<PS>;
  constructor(witnesses: W);
  initialState(context: __compactRuntime.ConstructorContext<PS>,
               initialPolicyId_0: Uint8Array,
               initialEscrowId_0: Uint8Array,
               initialMilestoneId_0: Uint8Array,
               initialBeneficiaryPkh_0: Uint8Array,
               initialActionId_0: Uint8Array,
               initialAssetPolicyId_0: Uint8Array,
               initialAssetName_0: Uint8Array,
               initialAmount_0: bigint,
               initialCardanoValidatorHash_0: Uint8Array,
               initialReviewerOnePublicKey_0: Uint8Array,
               initialReviewerTwoPublicKey_0: Uint8Array): __compactRuntime.ConstructorResult<PS>;
}

export declare function ledger(state: __compactRuntime.StateValue | __compactRuntime.ChargedState): Ledger;
export declare const pureCircuits: PureCircuits;
