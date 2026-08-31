export type MidnightClientErrorCode =
  | "NP_MIDNIGHT_BAD_POLICY"
  | "NP_MIDNIGHT_BAD_PRIVATE_STATE"
  | "NP_MIDNIGHT_ALREADY_APPROVED"
  | "NP_MIDNIGHT_ALREADY_AUTHORIZED"
  | "NP_MIDNIGHT_STATE_NOT_FOUND"
  | "NP_MIDNIGHT_STATE_TIMEOUT";

export class MidnightClientError extends Error {
  constructor(readonly code: MidnightClientErrorCode, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "MidnightClientError";
  }
}
