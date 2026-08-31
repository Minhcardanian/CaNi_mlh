import {
  type LucidEvolution,
  type OutRef,
  type Script,
  validatorToAddress,
  validatorToScriptHash,
} from "@lucid-evolution/lucid";
import { createClaimPlan, buildClaimTransaction } from "./claim.js";
import { decodeValidatorState } from "./data.js";
import { CardanoClientError } from "./errors.js";
import { buildInitializationTransaction, createInitializationPlan } from "./initialize.js";
import { STATE_TOKEN_NAME } from "./validator.js";
import { parameterizeValidator } from "./validator.js";
import type { Assets, ClaimPlan, InitializationPlan, PermitEnvelope, ValidatorState } from "./types.js";

export type WalletInitializationInput = {
  compiledCode: string;
  initializationRef: OutRef;
  initialState: ValidatorState;
  inventory: Assets;
};

function sameOutRef(left: OutRef, right: OutRef): boolean {
  return left.txHash === right.txHash && left.outputIndex === right.outputIndex;
}

export async function createWalletInitializationPlan(
  lucid: LucidEvolution,
  input: WalletInitializationInput,
): Promise<InitializationPlan> {
  const [candidate] = await lucid.utxosByOutRef([input.initializationRef]);
  if (!candidate) {
    throw new CardanoClientError("NP_CARDANO_BAD_UTXO", "initialization output reference was not found");
  }
  const walletUtxos = await lucid.wallet().getUtxos();
  if (!walletUtxos.some((utxo) => sameOutRef(utxo, input.initializationRef))) {
    throw new CardanoClientError("NP_CARDANO_BAD_UTXO", "initialization output reference is not controlled by this wallet");
  }
  const validator = parameterizeValidator(input.compiledCode, input.initializationRef);
  return createInitializationPlan(validator, candidate, input.initialState, input.inventory);
}

export async function submitWalletInitialization(
  lucid: LucidEvolution,
  input: WalletInitializationInput,
): Promise<{
  transactionId: string;
  stateAddress: string;
  stateTokenUnit: string;
  validator: Script;
  awaitConfirmation(): Promise<void>;
}> {
  const plan = await createWalletInitializationPlan(lucid, input);
  const transaction = await buildInitializationTransaction(lucid, plan);
  const signed = await transaction.sign.withWallet().complete();
  const transactionId = await signed.submit({ canonical: true });
  return {
    transactionId,
    stateAddress: plan.stateAddress,
    stateTokenUnit: plan.stateTokenUnit,
    validator: plan.validator,
    async awaitConfirmation() {
      await lucid.awaitTxConfirmation(transactionId);
    },
  };
}

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
