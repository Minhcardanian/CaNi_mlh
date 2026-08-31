import type { PermitEnvelope } from "@nightpermit/cardano-client";

export type Stage = "connect" | "authorize" | "claim" | "complete";
export type Operation = "connect-midnight" | "connect-cardano" | "approve" | "permit" | "claim";

export type PublicWallet = {
  name: string;
  network: "Midnight Preprod" | "Cardano Preview";
  address?: string;
};

export type FlowError = {
  code: string;
  message: string;
  retryable: boolean;
};

export type FlowState = {
  stage: Stage;
  operation?: Operation | undefined;
  midnightWallet?: PublicWallet;
  cardanoWallet?: PublicWallet;
  approvalCount: 0 | 1 | 2;
  midnightTxId?: string;
  permit?: PermitEnvelope;
  correlationId?: string;
  nullifier?: string;
  relayVerified: boolean;
  cardanoTxId?: string;
  confirmed: boolean;
  error?: FlowError | undefined;
};

export const initialFlowState: FlowState = {
  stage: "connect",
  approvalCount: 0,
  confirmed: false,
  relayVerified: false,
};

export type FlowEvent =
  | { type: "START"; operation: Operation }
  | { type: "MIDNIGHT_CONNECTED"; wallet: PublicWallet }
  | { type: "CARDANO_CONNECTED"; wallet: PublicWallet }
  | { type: "APPROVAL_CONFIRMED"; approvalCount: 1 | 2; authorized: boolean; transactionId: string }
  | { type: "PERMIT_RECEIVED"; permit: PermitEnvelope; correlationId: string; nullifier: string; relayVerified: true }
  | { type: "CLAIM_SUBMITTED"; transactionId: string }
  | { type: "CLAIM_CONFIRMED"; transactionId: string }
  | { type: "FAILED"; error: FlowError }
  | { type: "CLEAR_ERROR" };

function connectedStage(state: FlowState): Stage {
  return state.midnightWallet && state.cardanoWallet ? "authorize" : "connect";
}

export function flowReducer(state: FlowState, event: FlowEvent): FlowState {
  switch (event.type) {
    case "START":
      return { ...state, operation: event.operation, error: undefined };
    case "MIDNIGHT_CONNECTED": {
      const next = { ...state, midnightWallet: event.wallet, operation: undefined, error: undefined };
      return { ...next, stage: connectedStage(next) };
    }
    case "CARDANO_CONNECTED": {
      const next = { ...state, cardanoWallet: event.wallet, operation: undefined, error: undefined };
      return { ...next, stage: connectedStage(next) };
    }
    case "APPROVAL_CONFIRMED":
      if (!state.midnightWallet || !state.cardanoWallet) return state;
      return {
        ...state,
        stage: event.authorized && event.approvalCount === 2 ? "claim" : "authorize",
        approvalCount: event.approvalCount,
        midnightTxId: event.transactionId,
        operation: undefined,
        error: undefined,
      };
    case "PERMIT_RECEIVED":
      if (state.stage !== "claim" || state.approvalCount !== 2 || !state.midnightTxId) return state;
      return {
        ...state,
        permit: event.permit,
        correlationId: event.correlationId,
        nullifier: event.nullifier,
        relayVerified: event.relayVerified,
        operation: undefined,
        error: undefined,
      };
    case "CLAIM_SUBMITTED":
      if (!state.permit) return state;
      return { ...state, cardanoTxId: event.transactionId, operation: undefined, error: undefined };
    case "CLAIM_CONFIRMED":
      if (!state.cardanoTxId || state.cardanoTxId !== event.transactionId) return state;
      return { ...state, stage: "complete", confirmed: true, operation: undefined, error: undefined };
    case "FAILED":
      return { ...state, operation: undefined, error: event.error };
    case "CLEAR_ERROR": {
      const { error: _error, ...next } = state;
      return next;
    }
  }
}
