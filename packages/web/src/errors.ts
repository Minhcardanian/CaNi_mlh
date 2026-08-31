import type { FlowError } from "./state.js";

const messages: Record<string, Omit<FlowError, "code">> = {
  NP_WEB_MIDNIGHT_WALLET_MISSING: {
    message: "Install or enable a compatible Midnight Lace wallet, then try again.",
    retryable: true,
  },
  NP_WEB_CARDANO_WALLET_MISSING: {
    message: "Install or enable a CIP-30 Cardano wallet, then try again.",
    retryable: true,
  },
  NP_WEB_WRONG_CARDANO_NETWORK: {
    message: "Switch the Cardano wallet to Preview before continuing.",
    retryable: true,
  },
  NP_WEB_WRONG_MIDNIGHT_NETWORK: {
    message: "Switch the Midnight wallet to Preprod before continuing.",
    retryable: true,
  },
  NP_WEB_WALLET_REJECTED: {
    message: "The wallet request was declined. No transaction was submitted.",
    retryable: true,
  },
  NP_WEB_RUNTIME_NOT_CONFIGURED: {
    message: "This deployment is missing its public contract runtime configuration.",
    retryable: false,
  },
  NP_WEB_CARDANO_PROVIDER_UNAVAILABLE: {
    message: "Cardano Preview providers are unavailable. No transaction was submitted; try again after provider recovery.",
    retryable: true,
  },
  NP_WEB_INVALID_RELAY_ENVELOPE: {
    message: "The relay envelope failed public hash or signature verification. No Cardano transaction was built.",
    retryable: false,
  },
  NP_WEB_BAD_STORAGE_PASSWORD: {
    message: "Use an encrypted-storage password of at least 16 characters with three character types and no simple sequences.",
    retryable: true,
  },
  NP_WEB_BAD_REVIEWER_SECRET: {
    message: "The reviewer secret must contain exactly 32 bytes as lowercase hexadecimal.",
    retryable: true,
  },
  NP_RELAY_PROVIDER_TIMEOUT: {
    message: "Authorization is still pending or the Midnight provider timed out. Try again safely.",
    retryable: true,
  },
  NP_RELAY_PERMIT_NOT_FOUND: {
    message: "No confirmed authorization permit is available yet.",
    retryable: true,
  },
  NP_CARDANO_EXPIRED: {
    message: "This permit expired before claim construction. Request a fresh authorization.",
    retryable: false,
  },
  NP_CARDANO_WRONG_WALLET: {
    message: "The connected Cardano wallet is not the permit beneficiary.",
    retryable: true,
  },
  NP_CARDANO_BAD_STATE: {
    message: "The Cardano escrow state no longer accepts this permit.",
    retryable: false,
  },
};

export class WebFlowError extends Error {
  constructor(readonly code: string, options?: ErrorOptions) {
    super(code, options);
    this.name = "WebFlowError";
  }
}

export function toFlowError(error: unknown): FlowError {
  const candidate = typeof error === "object" && error !== null && "code" in error
    ? String(error.code)
    : error instanceof WebFlowError
      ? error.code
      : "NP_WEB_UNEXPECTED";
  const known = messages[candidate];
  return known
    ? { code: candidate, ...known }
    : {
        code: "NP_WEB_UNEXPECTED",
        message: "The operation failed safely. No success state was recorded.",
        retryable: true,
      };
}
