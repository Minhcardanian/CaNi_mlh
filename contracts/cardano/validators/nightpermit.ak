use aiken/collection/dict
use aiken/collection/list
use cardano/address.{Script, VerificationKey}
use cardano/assets.{PolicyId}
use cardano/transaction.{InlineDatum, Output, OutputReference, Transaction}
use nightpermit/permit_v1.{PermitPolicy, PermitV1}

pub type ValidatorState {
  version: Int,
  state_thread_policy_id: ByteArray,
  state_thread_asset_name: ByteArray,
  permit_policy: PermitPolicy,
  consumed_nullifiers: List<ByteArray>,
  sequence_number: Int,
}

pub type Claim {
  permit_bytes: ByteArray,
  signature: ByteArray,
}

const state_thread_asset_name = #"4e505f5354415445"

fn has_nullifier_tag(output: Output, nullifier: ByteArray) -> Bool {
  when output.datum is {
    InlineDatum(datum) ->
      if datum is ByteArray {
        datum == nullifier
      } else {
        False
      }
    _ -> False
  }
}

fn is_exact_payout(output: Output, permit: PermitV1) -> Bool {
  output.address.payment_credential == VerificationKey(permit.beneficiary_pkh) && has_nullifier_tag(
    output,
    permit.nullifier,
  ) && assets.quantity_of(
    output.value,
    permit.asset_policy_id,
    permit.asset_name,
  ) == permit.amount
}

fn state_value_releases_exact_tranche(
  input: Output,
  output: Output,
  permit: PermitV1,
) -> Bool {
  assets.add(
    output.value,
    permit.asset_policy_id,
    permit.asset_name,
    permit.amount,
  ) == input.value
}

validator nightpermit(initialization_ref: OutputReference) {
  mint(
    initial_state: ValidatorState,
    policy_id: PolicyId,
    transaction: Transaction,
  ) {
    expect [Pair(asset_name, quantity)] =
      transaction.mint
        |> assets.tokens(policy_id)
        |> dict.to_pairs()
    expect [state_output] =
      list.filter(
        transaction.outputs,
        fn(output) {
          assets.quantity_of(output.value, policy_id, state_thread_asset_name) == 1
        },
      )
    expect Script(output_script_hash) = state_output.address.payment_credential
    expect InlineDatum(output_datum) = state_output.datum
    expect output_state: ValidatorState = output_datum

    list.any(
      transaction.inputs,
      fn(input) { input.output_reference == initialization_ref },
    ) && asset_name == state_thread_asset_name && quantity == 1 && output_script_hash == policy_id && output_state == initial_state && initial_state.version == 1 && initial_state.state_thread_policy_id == policy_id && initial_state.state_thread_asset_name == state_thread_asset_name && initial_state.permit_policy.cardano_validator_hash == policy_id && initial_state.consumed_nullifiers == [] && initial_state.sequence_number == 0
  }

  spend(
    optional_state: Option<ValidatorState>,
    claim: Claim,
    own_ref: OutputReference,
    transaction: Transaction,
  ) {
    expect Some(state) = optional_state
    expect state.version == 1
    expect state.state_thread_asset_name == state_thread_asset_name
    expect Some(own_input) =
      list.find(
        transaction.inputs,
        fn(input) { input.output_reference == own_ref },
      )
    expect Script(own_script_hash) = own_input.output.address.payment_credential
    expect state.state_thread_policy_id == own_script_hash
    expect state.permit_policy.cardano_validator_hash == own_script_hash
    expect
      !(state.permit_policy.asset_policy_id == state.state_thread_policy_id && state.permit_policy.asset_name == state.state_thread_asset_name)
    expect [state_input] =
      list.filter(
        transaction.inputs,
        fn(input) {
          assets.quantity_of(
            input.output.value,
            state.state_thread_policy_id,
            state.state_thread_asset_name,
          ) != 0
        },
      )
    expect state_input.output_reference == own_ref
    expect
      assets.quantity_of(
        own_input.output.value,
        state.state_thread_policy_id,
        state.state_thread_asset_name,
      ) == 1
    expect
      assets.quantity_of(
        transaction.mint,
        state.state_thread_policy_id,
        state.state_thread_asset_name,
      ) == 0

    expect [state_output] =
      list.filter(
        transaction.outputs,
        fn(output) {
          assets.quantity_of(
            output.value,
            state.state_thread_policy_id,
            state.state_thread_asset_name,
          ) != 0
        },
      )
    expect state_output.address == own_input.output.address
    expect state_output.address.payment_credential == Script(own_script_hash)
    expect
      assets.quantity_of(
        state_output.value,
        state.state_thread_policy_id,
        state.state_thread_asset_name,
      ) == 1
    expect InlineDatum(output_datum) = state_output.datum
    expect next_state: ValidatorState = output_datum

    let permit = permit_v1.decode(claim.permit_bytes)
    let expected_state =
      ValidatorState {
        ..state,
        consumed_nullifiers: [permit.nullifier, ..state.consumed_nullifiers],
        sequence_number: state.sequence_number + 1,
      }
    expect next_state == expected_state
    expect [payout_output] =
      list.filter(
        transaction.outputs,
        fn(output) { is_exact_payout(output, permit) },
      )

    permit_v1.authorizes_claim(
      state.permit_policy,
      claim.permit_bytes,
      claim.signature,
      transaction.extra_signatories,
      transaction.validity_range,
      state.consumed_nullifiers,
    ) && state_value_releases_exact_tranche(
      own_input.output,
      state_output,
      permit,
    ) && is_exact_payout(payout_output, permit)
  }

  else(_) {
    fail
  }
}
