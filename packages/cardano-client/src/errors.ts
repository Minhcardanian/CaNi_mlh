export type CardanoClientErrorCode =
  | "NP_CARDANO_BAD_ENVELOPE"
  | "NP_CARDANO_BAD_STATE"
  | "NP_CARDANO_BAD_UTXO"
  | "NP_CARDANO_EXPIRED"
  | "NP_CARDANO_NOT_YET_VALID"
  | "NP_CARDANO_WRONG_WALLET"
  | "NP_CARDANO_WRONG_VALIDATOR";

export class CardanoClientError extends Error {
  constructor(
    readonly code: CardanoClientErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "CardanoClientError";
  }
}
