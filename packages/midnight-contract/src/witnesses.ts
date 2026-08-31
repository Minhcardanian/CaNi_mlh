import type { WitnessContext } from "@midnight-ntwrk/compact-runtime";
import type { Ledger } from "./managed/nightpermit/contract/index.js";

export type NightPermitPrivateState = {
  readonly reviewerSecret: Uint8Array;
};

export const nightPermitPrivateStateKey = "nightPermitReviewerV1" as const;

export function createPrivateState(reviewerSecret: Uint8Array): NightPermitPrivateState {
  if (reviewerSecret.length !== 32) {
    throw new Error("reviewer secret must contain exactly 32 bytes");
  }
  return { reviewerSecret: reviewerSecret.slice() };
}

export const witnesses = {
  localReviewerSecret: ({
    privateState,
  }: WitnessContext<Ledger, NightPermitPrivateState>): [NightPermitPrivateState, Uint8Array] => [
    privateState,
    privateState.reviewerSecret,
  ],
};
