import {
  type LucidEvolution,
  type Script,
  validatorToAddress,
  validatorToScriptHash,
} from "@lucid-evolution/lucid";
import { createClaimPlan, buildClaimTransaction } from "./claim.js";
import { decodeValidatorState } from "./data.js";
import { CardanoClientError } from "./errors.js";
import { STATE_TOKEN_NAME } from "./validator.js";
import type { ClaimPlan, PermitEnvelope } from "./types.js";

export async function createWalletClaimPlan(
  lucid: LucidEvolution,
  envelope: PermitEnvelope,
  validator: Script,
): Promise<ClaimPlan> {
  const stateAddress = validatorToAddress("Preview", validator);
  const stateTokenUnit = validatorToScriptHash(validator) + STATE_TOKEN_NAME;
  const stateUtxos = await lucid.utxosAtWithUnit(stateAddress, stateTokenUnit);
  if (stateUtxos.length !== 1) {
    throw new CardanoClientError(
      "NP_CARDANO_BAD_UTXO",
      `expected one state UTxO but provider returned ${stateUtxos.length}`,
    );
  }
  const stateUtxo = stateUtxos[0]!;
  if (!stateUtxo.datum) {
    throw new CardanoClientError("NP_CARDANO_BAD_UTXO", "state UTxO must contain an inline datum");
  }
  return createClaimPlan({
    beneficiaryAddress: await lucid.wallet().address(),
    currentSlot: BigInt(lucid.currentSlot()),
    envelope,
    state: decodeValidatorState(stateUtxo.datum),
    stateUtxo,
    validator,
  });
}

export async function submitWalletClaim(
  lucid: LucidEvolution,
  envelope: PermitEnvelope,
  validator: Script,
): Promise<{ transactionId: string; awaitConfirmation(): Promise<void> }> {
  const plan = await createWalletClaimPlan(lucid, envelope, validator);
  const transaction = await buildClaimTransaction(lucid, plan);
  const signed = await transaction.sign.withWallet().complete();
  const transactionId = await signed.submit({ canonical: true });
  return {
    transactionId,
    async awaitConfirmation() {
      await lucid.awaitTxConfirmation(transactionId);
    },
  };
}
