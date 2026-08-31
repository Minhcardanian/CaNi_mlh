import {
  CostModel,
  QueryContext,
  createConstructorContext,
  sampleContractAddress,
  type CircuitContext,
} from "@midnight-ntwrk/compact-runtime";
import { Contract, ledger, type Ledger } from "../managed/nightpermit/contract/index.js";
import { createPrivateState, witnesses, type NightPermitPrivateState } from "../witnesses.js";

export type DeploymentConfig = {
  policyId: Uint8Array;
  escrowId: Uint8Array;
  milestoneId: Uint8Array;
  beneficiaryPkh: Uint8Array;
  actionId: Uint8Array;
  assetPolicyId: Uint8Array;
  assetName: Uint8Array;
  amount: bigint;
  cardanoValidatorHash: Uint8Array;
  reviewerOnePublicKey: Uint8Array;
  reviewerTwoPublicKey: Uint8Array;
};

export class NightPermitSimulator {
  readonly contract: Contract<NightPermitPrivateState>;
  private context: CircuitContext<NightPermitPrivateState>;

  constructor(config: DeploymentConfig, reviewerSecret: Uint8Array) {
    this.contract = new Contract<NightPermitPrivateState>(witnesses);
    const initial = this.contract.initialState(
      createConstructorContext(createPrivateState(reviewerSecret), "0".repeat(64)),
      config.policyId,
      config.escrowId,
      config.milestoneId,
      config.beneficiaryPkh,
      config.actionId,
      config.assetPolicyId,
      config.assetName,
      config.amount,
      config.cardanoValidatorHash,
      config.reviewerOnePublicKey,
      config.reviewerTwoPublicKey,
    );
    this.context = {
      currentPrivateState: initial.currentPrivateState,
      currentZswapLocalState: initial.currentZswapLocalState,
      costModel: CostModel.initialCostModel(),
      currentQueryContext: new QueryContext(initial.currentContractState.data, sampleContractAddress()),
    };
  }

  setReviewer(reviewerSecret: Uint8Array): void {
    this.context.currentPrivateState = createPrivateState(reviewerSecret);
  }

  approve(): Ledger {
    this.context = this.contract.impureCircuits.approve(this.context).context;
    return this.ledger();
  }

  ledger(): Ledger {
    return ledger(this.context.currentQueryContext.state);
  }
}
