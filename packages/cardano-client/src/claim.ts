import {
  type Assets,
  type LucidEvolution,
  type TxSignBuilder,
  paymentCredentialOf,
  validatorToAddress,
  validatorToScriptHash,
} from "@lucid-evolution/lucid";
import {
  decodeHex,
  decodePermit,
  encodeHex,
  hashPermit,
  verifyPermitSignature,
} from "@nightpermit/permit";
import { encodeClaimRedeemer, encodeNullifierDatum, encodeValidatorState } from "./data.js";
import { CardanoClientError } from "./errors.js";
import type { ClaimPlan, ClaimPlanInput, PermitPolicyState, ValidatorState } from "./types.js";

const PREVIEW_SYSTEM_START_MS = 1_666_656_000_000n;
const DEFAULT_VALIDITY_WINDOW_SLOTS = 120n;

function fail(code: ConstructorParameters<typeof CardanoClientError>[0], message: string): never {
  throw new CardanoClientError(code, message);
}

function slotToMs(slot: bigint): number {
  const value = PREVIEW_SYSTEM_START_MS + slot * 1_000n;
  if (value > BigInt(Number.MAX_SAFE_INTEGER)) {
    return fail("NP_CARDANO_BAD_ENVELOPE", "permit slot cannot be represented safely");
  }
  return Number(value);
}

function expectEqual(actual: string | bigint, expected: string | bigint, field: string): void {
  if (actual !== expected) {
    fail("NP_CARDANO_BAD_STATE", `state ${field} does not match the signed permit`);
  }
}

function validatePolicy(policy: PermitPolicyState, permit: ReturnType<typeof decodePermit>): void {
  expectEqual(policy.midnightContractId, permit.midnightContractId, "midnightContractId");
  expectEqual(policy.policyId, permit.policyId, "policyId");
  expectEqual(policy.escrowId, permit.escrowId, "escrowId");
  expectEqual(policy.milestoneId, permit.milestoneId, "milestoneId");
  expectEqual(policy.beneficiaryPkh, permit.beneficiaryPkh, "beneficiaryPkh");
  expectEqual(policy.actionId, permit.actionId, "actionId");
  expectEqual(policy.assetPolicyId, permit.entitlement.assetPolicyId, "assetPolicyId");
  expectEqual(policy.assetName, permit.entitlement.assetName, "assetName");
  expectEqual(policy.amount, permit.entitlement.amount, "amount");
  expectEqual(policy.cardanoValidatorHash, permit.cardanoValidatorHash, "cardanoValidatorHash");
  expectEqual(policy.relayKeyId, permit.relayKeyId, "relayKeyId");
}

function subtractAsset(assets: Assets, unit: string, amount: bigint): Assets {
  const available = assets[unit] ?? 0n;
  if (available < amount) {
    return fail("NP_CARDANO_BAD_UTXO", "state UTxO does not contain the signed entitlement amount");
  }
  const next = { ...assets, [unit]: available - amount };
  if (next[unit] === 0n) delete next[unit];
  return next;
}

function ensureStateUtxo(input: ClaimPlanInput, stateAddress: string, stateTokenUnit: string): void {
  if (input.stateUtxo.address !== stateAddress) {
    fail("NP_CARDANO_BAD_UTXO", "state UTxO is not locked by the configured validator");
  }
  if (input.stateUtxo.assets[stateTokenUnit] !== 1n) {
    fail("NP_CARDANO_BAD_UTXO", "state UTxO must contain exactly one state-thread token");
  }
  if (input.stateUtxo.datum !== encodeValidatorState(input.state)) {
    fail("NP_CARDANO_BAD_UTXO", "state UTxO inline datum does not match the supplied decoded state");
  }
}

export async function createClaimPlan(input: ClaimPlanInput): Promise<ClaimPlan> {
  if (input.envelope.version !== 1) {
    return fail("NP_CARDANO_BAD_ENVELOPE", "relay envelope version is unsupported");
  }
  const permitBytes = decodeHex(input.envelope.permitBytes, "permitBytes");
  const permit = decodePermit(permitBytes);
  if (encodeHex(hashPermit(permitBytes)) !== input.envelope.permitHash) {
    return fail("NP_CARDANO_BAD_ENVELOPE", "relay envelope permit hash is invalid");
  }
  if (!(await verifyPermitSignature(permitBytes, input.envelope.signature, input.envelope.relayPublicKey))) {
    return fail("NP_CARDANO_BAD_ENVELOPE", "relay signature is invalid");
  }
  if (input.state.version !== 1 || input.state.sequenceNumber < 0n) {
    return fail("NP_CARDANO_BAD_STATE", "validator state version or sequence is invalid");
  }
  validatePolicy(input.state.permitPolicy, permit);
  expectEqual(input.state.permitPolicy.relayPublicKey, input.envelope.relayPublicKey, "relayPublicKey");

  const scriptHash = validatorToScriptHash(input.validator);
  if (
    scriptHash !== permit.cardanoValidatorHash ||
    scriptHash !== input.state.stateThreadPolicyId ||
    scriptHash !== input.state.permitPolicy.cardanoValidatorHash
  ) {
    return fail("NP_CARDANO_WRONG_VALIDATOR", "validator hash is inconsistent with permit and state");
  }
  const stateAddress = validatorToAddress("Preview", input.validator);
  const stateTokenUnit = input.state.stateThreadPolicyId + input.state.stateThreadAssetName;
  ensureStateUtxo(input, stateAddress, stateTokenUnit);

  const credential = paymentCredentialOf(input.beneficiaryAddress);
  if (credential.type !== "Key" || credential.hash !== permit.beneficiaryPkh) {
    return fail("NP_CARDANO_WRONG_WALLET", "connected Cardano wallet is not the signed beneficiary");
  }
  if (input.state.consumedNullifiers.includes(permit.nullifier)) {
    return fail("NP_CARDANO_BAD_STATE", "permit nullifier has already been consumed");
  }
  if (permit.notBeforeSlot !== undefined && input.currentSlot < permit.notBeforeSlot) {
    return fail("NP_CARDANO_NOT_YET_VALID", "permit is not valid at the current Preview slot");
  }
  if (input.currentSlot > permit.expiresAtSlot) {
    return fail("NP_CARDANO_EXPIRED", "permit has expired at the current Preview slot");
  }

  const assetUnit = permit.entitlement.assetPolicyId + permit.entitlement.assetName || "lovelace";
  if (assetUnit === stateTokenUnit) {
    return fail("NP_CARDANO_BAD_STATE", "entitlement asset cannot be the state-thread token");
  }
  const stateAssets = subtractAsset(input.stateUtxo.assets, assetUnit, permit.entitlement.amount);
  const nextState: ValidatorState = {
    ...input.state,
    consumedNullifiers: [permit.nullifier, ...input.state.consumedNullifiers],
    sequenceNumber: input.state.sequenceNumber + 1n,
  };
  const window = input.validityWindowSlots ?? DEFAULT_VALIDITY_WINDOW_SLOTS;
  if (window < 1n || window > 3_600n) {
    return fail("NP_CARDANO_BAD_ENVELOPE", "claim validity window must be between 1 and 3600 slots");
  }
  const validToSlot = input.currentSlot + window < permit.expiresAtSlot
    ? input.currentSlot + window
    : permit.expiresAtSlot;

  return {
    beneficiaryAddress: input.beneficiaryAddress,
    beneficiaryPkh: permit.beneficiaryPkh,
    claimRedeemer: encodeClaimRedeemer(input.envelope.permitBytes, input.envelope.signature),
    currentState: input.state,
    nextState,
    nextStateDatum: encodeValidatorState(nextState),
    payoutDatum: encodeNullifierDatum(permit.nullifier),
    payoutAssets: { [assetUnit]: permit.entitlement.amount },
    permit,
    stateAddress,
    stateAssets,
    stateUtxo: input.stateUtxo,
    validFromMs: slotToMs(input.currentSlot),
    validToMs: slotToMs(validToSlot),
    validator: input.validator,
  };
}

export async function buildClaimTransaction(
  lucid: LucidEvolution,
  plan: ClaimPlan,
): Promise<TxSignBuilder> {
  return lucid
    .newTx()
    .collectFrom([plan.stateUtxo], plan.claimRedeemer)
    .pay.ToContract(
      plan.stateAddress,
      { kind: "inline", value: plan.nextStateDatum },
      plan.stateAssets,
    )
    .pay.ToAddressWithData(
      plan.beneficiaryAddress,
      { kind: "inline", value: plan.payoutDatum },
      plan.payoutAssets,
    )
    .addSignerKey(plan.beneficiaryPkh)
    .validFrom(plan.validFromMs)
    .validTo(plan.validToMs)
    .attach.SpendingValidator(plan.validator)
    .complete();
}
