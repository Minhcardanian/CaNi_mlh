use aiken/cbor
use aiken/interval
use aiken/primitive/bytearray
use cardano/address.{Address, Script, VerificationKey}
use cardano/assets
use cardano/transaction.{
  InlineDatum, Input, NoDatum, Output, OutputReference, Transaction,
}
use nightpermit
use nightpermit/permit_v1

const script_hash = #"99999999999999999999999999999999999999999999999999999999"

const state_thread_policy_id = script_hash

const state_thread_asset_name = #"4e505f5354415445"

const beneficiary_pkh =
  #"66666666666666666666666666666666666666666666666666666666"

const nullifier =
  #"8888888888888888888888888888888888888888888888888888888888888888"

const relay_public_key =
  #"03a107bff3ce10be1d70dd18e74bc09967e4d6309ba50d5f1ddc8664125531b8"

const permit_bytes =
  #"4e50303101010100000002111111111111111111111111111111111111111111111111111111111111111122222222222222222222222222222222222222222222222222222222222222220100000007333333333333333333333333333333333333333333333333333333333333333344444444444444444444444444444444444444444444444444444444444444445555555555555555555555555555555555555555555555555555555555555555666666666666666666666666666666666666666666666666666666667777777777777777777777777777777777777777777777777777777777777777000000000000017d784088888888888888888888888888888888888888888888888888888888888888880100000000073df16000000000073dff7099999999999999999999999999999999999999999999999999999999aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"

const signature =
  #"a3a37324659ec2552a1b0c3f0089eca965de2eb9cd95671e02c6c842da19e7dc36219c5623cd611950de3d9c0585119afbaed96dbc8b99928f7b4fb446159305"

const own_ref =
  OutputReference {
    transaction_id: #"cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
    output_index: 0,
  }

const initialization_ref =
  OutputReference {
    transaction_id: #"eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
    output_index: 0,
  }

const script_address =
  Address { payment_credential: Script(script_hash), stake_credential: None }

const beneficiary_address =
  Address {
    payment_credential: VerificationKey(beneficiary_pkh),
    stake_credential: None,
  }

fn permit_policy() -> permit_v1.PermitPolicy {
  permit_v1.PermitPolicy {
    midnight_contract_id: #"1111111111111111111111111111111111111111111111111111111111111111",
    policy_id: #"3333333333333333333333333333333333333333333333333333333333333333",
    escrow_id: #"4444444444444444444444444444444444444444444444444444444444444444",
    milestone_id: #"5555555555555555555555555555555555555555555555555555555555555555",
    beneficiary_pkh,
    action_id: #"7777777777777777777777777777777777777777777777777777777777777777",
    asset_policy_id: #"",
    asset_name: #"",
    amount: 25_000_000,
    cardano_validator_hash: script_hash,
    relay_key_id: #"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    relay_public_key,
  }
}

fn state(consumed_nullifiers: List<ByteArray>) -> nightpermit.ValidatorState {
  nightpermit.ValidatorState {
    version: 1,
    state_thread_policy_id,
    state_thread_asset_name,
    permit_policy: permit_policy(),
    consumed_nullifiers,
    sequence_number: 0,
  }
}

fn state_value(lovelace: Int) -> assets.Value {
  assets.from_lovelace(lovelace)
    |> assets.add(state_thread_policy_id, state_thread_asset_name, 1)
}

fn state_output(next_state: nightpermit.ValidatorState, lovelace: Int) -> Output {
  Output {
    address: script_address,
    value: state_value(lovelace),
    datum: InlineDatum(next_state),
    reference_script: None,
  }
}

fn payout_output(lovelace: Int) -> Output {
  Output {
    address: beneficiary_address,
    value: assets.from_lovelace(lovelace),
    datum: InlineDatum(nullifier),
    reference_script: None,
  }
}

fn claim_transaction(
  current_state: nightpermit.ValidatorState,
  next_state: nightpermit.ValidatorState,
  next_state_lovelace: Int,
  payout_lovelace: Int,
) -> Transaction {
  let input =
    Input {
      output_reference: own_ref,
      output: Output {
        address: script_address,
        value: state_value(100_000_000),
        datum: InlineDatum(current_state),
        reference_script: None,
      },
    }
  let not_before_ms = permit_v1.preview_slot_to_posix_ms(121_500_000)
  let expiry_ms = permit_v1.preview_slot_to_posix_ms(121_503_600)
  Transaction {
    ..transaction.placeholder,
    inputs: [input],
    outputs: [
      state_output(next_state, next_state_lovelace),
      payout_output(payout_lovelace),
    ],
    validity_range: interval.between(not_before_ms, expiry_ms),
    extra_signatories: [beneficiary_pkh],
  }
}

fn claim() -> nightpermit.Claim {
  nightpermit.Claim { permit_bytes, signature }
}

fn initialization_transaction(
  initial_state: nightpermit.ValidatorState,
  minted_quantity: Int,
) -> Transaction {
  let initialization_input =
    Input {
      output_reference: initialization_ref,
      output: Output {
        address: beneficiary_address,
        value: assets.from_lovelace(2_000_000),
        datum: NoDatum,
        reference_script: None,
      },
    }
  Transaction {
    ..transaction.placeholder,
    inputs: [initialization_input],
    outputs: [state_output(initial_state, 100_000_000)],
    mint: assets.from_asset(
      state_thread_policy_id,
      state_thread_asset_name,
      minted_quantity,
    ),
  }
}

fn repeated_nullifiers(
  count: Int,
  nullifiers: List<ByteArray>,
) -> List<ByteArray> {
  if count <= 0 {
    nullifiers
  } else {
    repeated_nullifiers(
      count - 1,
      [
        #"0000000000000000000000000000000000000000000000000000000000000000",
        ..nullifiers
      ],
    )
  }
}

fn accepts_scaled_state(consumed_count: Int) -> Bool {
  let consumed_nullifiers = repeated_nullifiers(consumed_count, [])
  let current_state = state(consumed_nullifiers)
  let next_state =
    nightpermit.ValidatorState {
      ..current_state,
      consumed_nullifiers: [nullifier, ..consumed_nullifiers],
      sequence_number: 1,
    }
  nightpermit.nightpermit.spend(
    initialization_ref,
    Some(current_state),
    claim(),
    own_ref,
    claim_transaction(current_state, next_state, 75_000_000, 25_000_000),
  )
}

test records_scaled_datum_sizes() {
  bytearray.length(cbor.serialise(state(repeated_nullifiers(1, [])))) == 390 && bytearray.length(
    cbor.serialise(state(repeated_nullifiers(8, []))),
  ) == 628 && bytearray.length(
    cbor.serialise(state(repeated_nullifiers(16, []))),
  ) == 900 && bytearray.length(
    cbor.serialise(state(repeated_nullifiers(32, []))),
  ) == 1_444
}

test accepts_exact_state_transition() {
  let current_state = state([])
  let next_state =
    nightpermit.ValidatorState {
      ..current_state,
      consumed_nullifiers: [nullifier],
      sequence_number: 1,
    }
  nightpermit.nightpermit.spend(
    initialization_ref,
    Some(current_state),
    claim(),
    own_ref,
    claim_transaction(current_state, next_state, 75_000_000, 25_000_000),
  )
}

test mints_one_state_thread_token() {
  let initial_state = state([])
  nightpermit.nightpermit.mint(
    initialization_ref,
    initial_state,
    state_thread_policy_id,
    initialization_transaction(initial_state, 1),
  )
}

test rejects_wrong_initialization_reference() {
  let initial_state = state([])
  !nightpermit.nightpermit.mint(
    own_ref,
    initial_state,
    state_thread_policy_id,
    initialization_transaction(initial_state, 1),
  )
}

test rejects_multiple_state_thread_tokens() {
  let initial_state = state([])
  !nightpermit.nightpermit.mint(
    initialization_ref,
    initial_state,
    state_thread_policy_id,
    initialization_transaction(initial_state, 2),
  )
}

test rejects_missing_state_thread_token() fail {
  let initial_state = state([])
  nightpermit.nightpermit.mint(
    initialization_ref,
    initial_state,
    state_thread_policy_id,
    initialization_transaction(initial_state, 0),
  )
}

test rejects_nonzero_initial_sequence() {
  let initial_state =
    nightpermit.ValidatorState { ..state([]), sequence_number: 1 }
  !nightpermit.nightpermit.mint(
    initialization_ref,
    initial_state,
    state_thread_policy_id,
    initialization_transaction(initial_state, 1),
  )
}

test accepts_state_with_1_consumed_nullifier() {
  accepts_scaled_state(1)
}

test accepts_state_with_8_consumed_nullifiers() {
  accepts_scaled_state(8)
}

test accepts_state_with_16_consumed_nullifiers() {
  accepts_scaled_state(16)
}

test accepts_state_with_32_consumed_nullifiers() {
  accepts_scaled_state(32)
}

test rejects_replayed_nullifier() {
  let current_state = state([nullifier])
  let next_state =
    nightpermit.ValidatorState {
      ..current_state,
      consumed_nullifiers: [nullifier, nullifier],
      sequence_number: 1,
    }
  !nightpermit.nightpermit.spend(
    initialization_ref,
    Some(current_state),
    claim(),
    own_ref,
    claim_transaction(current_state, next_state, 75_000_000, 25_000_000),
  )
}

test rejects_value_over_withdrawal() {
  let current_state = state([])
  let next_state =
    nightpermit.ValidatorState {
      ..current_state,
      consumed_nullifiers: [nullifier],
      sequence_number: 1,
    }
  !nightpermit.nightpermit.spend(
    initialization_ref,
    Some(current_state),
    claim(),
    own_ref,
    claim_transaction(current_state, next_state, 74_000_000, 25_000_000),
  )
}

test rejects_wrong_payout_amount() fail {
  let current_state = state([])
  let next_state =
    nightpermit.ValidatorState {
      ..current_state,
      consumed_nullifiers: [nullifier],
      sequence_number: 1,
    }
  nightpermit.nightpermit.spend(
    initialization_ref,
    Some(current_state),
    claim(),
    own_ref,
    claim_transaction(current_state, next_state, 75_000_000, 24_000_000),
  )
}

test rejects_configuration_mutation() fail {
  let current_state = state([])
  let next_state =
    nightpermit.ValidatorState {
      ..current_state,
      permit_policy: permit_v1.PermitPolicy { ..permit_policy(), amount: 1 },
      consumed_nullifiers: [nullifier],
      sequence_number: 1,
    }
  nightpermit.nightpermit.spend(
    initialization_ref,
    Some(current_state),
    claim(),
    own_ref,
    claim_transaction(current_state, next_state, 75_000_000, 25_000_000),
  )
}

test rejects_wrong_validator_binding() fail {
  let current_state =
    nightpermit.ValidatorState {
      ..state([]),
      permit_policy: permit_v1.PermitPolicy {
        ..permit_policy(),
        cardano_validator_hash: #"00000000000000000000000000000000000000000000000000000000",
      },
    }
  let next_state =
    nightpermit.ValidatorState {
      ..current_state,
      consumed_nullifiers: [nullifier],
      sequence_number: 1,
    }
  nightpermit.nightpermit.spend(
    initialization_ref,
    Some(current_state),
    claim(),
    own_ref,
    claim_transaction(current_state, next_state, 75_000_000, 25_000_000),
  )
}

test rejects_duplicate_state_thread_input() fail {
  let current_state = state([])
  let next_state =
    nightpermit.ValidatorState {
      ..current_state,
      consumed_nullifiers: [nullifier],
      sequence_number: 1,
    }
  let transaction =
    claim_transaction(current_state, next_state, 75_000_000, 25_000_000)
  expect [original_input] = transaction.inputs
  let duplicate_input =
    Input {
      ..original_input,
      output_reference: OutputReference {
        transaction_id: #"dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd",
        output_index: 1,
      },
    }
  nightpermit.nightpermit.spend(
    initialization_ref,
    Some(current_state),
    claim(),
    own_ref,
    Transaction { ..transaction, inputs: [original_input, duplicate_input] },
  )
}

test rejects_redirected_payout() fail {
  let current_state = state([])
  let next_state =
    nightpermit.ValidatorState {
      ..current_state,
      consumed_nullifiers: [nullifier],
      sequence_number: 1,
    }
  let transaction =
    claim_transaction(current_state, next_state, 75_000_000, 25_000_000)
  expect [continuing_output, expected_payout] = transaction.outputs
  let redirected_payout =
    Output {
      ..expected_payout,
      address: Address {
        payment_credential: VerificationKey(
          #"00000000000000000000000000000000000000000000000000000000",
        ),
        stake_credential: None,
      },
    }
  nightpermit.nightpermit.spend(
    initialization_ref,
    Some(current_state),
    claim(),
    own_ref,
    Transaction {
      ..transaction,
      outputs: [continuing_output, redirected_payout],
    },
  )
}

test rejects_duplicate_continuing_state() fail {
  let current_state = state([])
  let next_state =
    nightpermit.ValidatorState {
      ..current_state,
      consumed_nullifiers: [nullifier],
      sequence_number: 1,
    }
  let transaction =
    claim_transaction(current_state, next_state, 75_000_000, 25_000_000)
  expect [continuing_output, expected_payout] = transaction.outputs
  nightpermit.nightpermit.spend(
    initialization_ref,
    Some(current_state),
    claim(),
    own_ref,
    Transaction {
      ..transaction,
      outputs: [continuing_output, continuing_output, expected_payout],
    },
  )
}

test rejects_state_thread_mint() fail {
  let current_state = state([])
  let next_state =
    nightpermit.ValidatorState {
      ..current_state,
      consumed_nullifiers: [nullifier],
      sequence_number: 1,
    }
  let transaction =
    claim_transaction(current_state, next_state, 75_000_000, 25_000_000)
  nightpermit.nightpermit.spend(
    initialization_ref,
    Some(current_state),
    claim(),
    own_ref,
    Transaction {
      ..transaction,
      mint: assets.from_asset(
        state_thread_policy_id,
        state_thread_asset_name,
        1,
      ),
    },
  )
}
