import {
  type Assets,
  type LucidEvolution,
  type TxSignBuilder,
  type UTxO,
  validatorToAddress,
  validatorToScriptHash,
} from "@lucid-evolution/lucid";
import { encodeValidatorState } from "./data.js";
import { CardanoClientError } from "./errors.js";
import type { InitializationPlan, ValidatorState } from "./types.js";
import { STATE_TOKEN_NAME } from "./validator.js";

export function createInitializationPlan(
  validator: InitializationPlan["validator"],
  initializationUtxo: UTxO,
  initialState: ValidatorState,
  inventory: Assets,
): InitializationPlan {
  const hash = validatorToScriptHash(validator);
  if (
    initialState.version !== 1 ||
    initialState.sequenceNumber !== 0n ||
    initialState.consumedNullifiers.length !== 0 ||
    initialState.stateThreadPolicyId !== hash ||
    initialState.stateThreadAssetName !== STATE_TOKEN_NAME ||
    initialState.permitPolicy.cardanoValidatorHash !== hash
  ) {
    throw new CardanoClientError("NP_CARDANO_BAD_STATE", "initial validator state invariants are invalid");
  }
  const stateTokenUnit = hash + STATE_TOKEN_NAME;
  if ((inventory[stateTokenUnit] ?? 0n) !== 0n) {
    throw new CardanoClientError("NP_CARDANO_BAD_STATE", "inventory must not already contain the state token");
  }
  return {
    initializationUtxo,
    mintRedeemer: encodeValidatorState(initialState),
    stateAddress: validatorToAddress("Preview", validator),
    stateAssets: { ...inventory, [stateTokenUnit]: 1n },
    stateDatum: encodeValidatorState(initialState),
    stateTokenUnit,
    validator,
  };
}

export async function buildInitializationTransaction(
  lucid: LucidEvolution,
  plan: InitializationPlan,
): Promise<TxSignBuilder> {
  return lucid
    .newTx()
    .collectFrom([plan.initializationUtxo])
    .mintAssets({ [plan.stateTokenUnit]: 1n }, plan.mintRedeemer)
    .pay.ToContract(
      plan.stateAddress,
      { kind: "inline", value: plan.stateDatum },
      plan.stateAssets,
    )
    .attach.MintingPolicy(plan.validator)
    .complete();
}
