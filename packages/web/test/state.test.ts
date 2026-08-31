import type { PermitEnvelope } from "@nightpermit/cardano-client";
import { describe, expect, it } from "vitest";
import { flowReducer, initialFlowState, type FlowState, type PublicWallet } from "../src/state.js";

const midnight: PublicWallet = { name: "Lace", network: "Midnight Preprod" };
const cardano: PublicWallet = {
  name: "Eternl",
  network: "Cardano Preview",
  address: "addr_test1_example",
};
const permit: PermitEnvelope = {
  version: 1,
  permitBytes: "01",
  permitHash: "02".repeat(32),
  signature: "03".repeat(64),
  relayPublicKey: "04".repeat(32),
};

function connected(): FlowState {
  const first = flowReducer(initialFlowState, { type: "MIDNIGHT_CONNECTED", wallet: midnight });
  return flowReducer(first, { type: "CARDANO_CONNECTED", wallet: cardano });
}

describe("flow state machine", () => {
  it("does not advance until both testnet wallets connect", () => {
    const one = flowReducer(initialFlowState, { type: "MIDNIGHT_CONNECTED", wallet: midnight });
    expect(one.stage).toBe("connect");
    expect(flowReducer(one, { type: "CARDANO_CONNECTED", wallet: cardano }).stage).toBe("authorize");
  });

  it("requires a confirmed two-of-two authorization before claim", () => {
    const one = flowReducer(connected(), {
      type: "APPROVAL_CONFIRMED",
      approvalCount: 1,
      authorized: false,
      transactionId: "11".repeat(32),
    });
    expect(one.stage).toBe("authorize");
    const two = flowReducer(one, {
      type: "APPROVAL_CONFIRMED",
      approvalCount: 2,
      authorized: true,
      transactionId: "12".repeat(32),
    });
    expect(two.stage).toBe("claim");
  });

  it("ignores a permit before confirmed authorization", () => {
    const state = flowReducer(connected(), {
      type: "PERMIT_RECEIVED",
      permit,
      correlationId: "correlation-01",
      nullifier: "05".repeat(32),
      relayVerified: true,
    });
    expect(state.permit).toBeUndefined();
  });

  it("reports completion only after the submitted Cardano transaction confirms", () => {
    let state = connected();
    state = flowReducer(state, {
      type: "APPROVAL_CONFIRMED",
      approvalCount: 2,
      authorized: true,
      transactionId: "12".repeat(32),
    });
    state = flowReducer(state, {
      type: "PERMIT_RECEIVED",
      permit,
      correlationId: "correlation-01",
      nullifier: "05".repeat(32),
      relayVerified: true,
    });
    state = flowReducer(state, { type: "CLAIM_SUBMITTED", transactionId: "13".repeat(32) });
    expect(state.stage).toBe("claim");
    expect(state.confirmed).toBe(false);
    expect(flowReducer(state, { type: "CLAIM_CONFIRMED", transactionId: "14".repeat(32) }).stage).toBe("claim");
    const complete = flowReducer(state, { type: "CLAIM_CONFIRMED", transactionId: "13".repeat(32) });
    expect(complete.stage).toBe("complete");
    expect(complete.confirmed).toBe(true);
  });

  it("keeps protocol progress unchanged when an operation fails", () => {
    const state = connected();
    const failed = flowReducer(state, {
      type: "FAILED",
      error: { code: "NP_WEB_UNEXPECTED", message: "Safe failure", retryable: true },
    });
    expect(failed.stage).toBe("authorize");
    expect(failed.approvalCount).toBe(0);
    expect(failed.error?.code).toBe("NP_WEB_UNEXPECTED");
  });
});
