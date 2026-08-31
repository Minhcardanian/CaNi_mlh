export type RelayErrorCode =
  | "NP_RELAY_BAD_REQUEST"
  | "NP_RELAY_CONFIGURATION_INVALID"
  | "NP_RELAY_AUTHORIZATION_NOT_FOUND"
  | "NP_RELAY_AUTHORIZATION_REJECTED"
  | "NP_RELAY_PROVIDER_TIMEOUT"
  | "NP_RELAY_PROVIDER_UNAVAILABLE"
  | "NP_RELAY_PERMIT_NOT_FOUND"
  | "NP_RELAY_INTERNAL";

export class RelayError extends Error {
  constructor(
    readonly code: RelayErrorCode,
    message: string,
    readonly httpStatus: number,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "RelayError";
  }
}

export function asRelayError(error: unknown): RelayError {
  if (error instanceof RelayError) {
    return error;
  }
  return new RelayError("NP_RELAY_INTERNAL", "relay operation failed", 500, {
    cause: error,
  });
}
