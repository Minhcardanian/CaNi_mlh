export type PermitErrorCode =
  | "NP_PERMIT_INVALID_FIELD"
  | "NP_PERMIT_ENCODING_FAILED"
  | "NP_PERMIT_DECODING_FAILED"
  | "NP_PERMIT_UNKNOWN_VERSION"
  | "NP_PERMIT_TRAILING_DATA";

export class PermitCodecError extends Error {
  readonly code: PermitErrorCode;

  constructor(code: PermitErrorCode, message: string) {
    super(message);
    this.name = "PermitCodecError";
    this.code = code;
  }
}
