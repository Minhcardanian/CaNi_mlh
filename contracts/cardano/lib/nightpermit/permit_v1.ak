use aiken/collection/list
use aiken/crypto
use aiken/interval.{Interval}
use aiken/primitive/bytearray
use aiken/primitive/int

const max_permit_bytes = 512

const preview_system_start_ms = 1_666_656_000_000

const preview_slot_length_ms = 1_000

pub type PermitPolicy {
  midnight_contract_id: ByteArray,
  policy_id: ByteArray,
  escrow_id: ByteArray,
  milestone_id: ByteArray,
  beneficiary_pkh: ByteArray,
  action_id: ByteArray,
  asset_policy_id: ByteArray,
  asset_name: ByteArray,
  amount: Int,
  cardano_validator_hash: ByteArray,
  relay_key_id: ByteArray,
  relay_public_key: ByteArray,
}

pub type PermitV1 {
  midnight_contract_id: ByteArray,
  midnight_tx_id: ByteArray,
  authorization_index: Option<Int>,
  policy_id: ByteArray,
  escrow_id: ByteArray,
  milestone_id: ByteArray,
  beneficiary_pkh: ByteArray,
  action_id: ByteArray,
  asset_policy_id: ByteArray,
  asset_name: ByteArray,
  amount: Int,
  nullifier: ByteArray,
  not_before_slot: Option<Int>,
  expires_at_slot: Int,
  cardano_validator_hash: ByteArray,
  relay_key_id: ByteArray,
}

type Cursor {
  bytes: ByteArray,
  offset: Int,
}

fn take_bytes(cursor: Cursor, size: Int) -> (ByteArray, Cursor) {
  expect size >= 0
  expect cursor.offset + size <= bytearray.length(cursor.bytes)
  let value =
    bytearray.slice(
      cursor.bytes,
      start: cursor.offset,
      end: cursor.offset + size - 1,
    )
  (value, Cursor { ..cursor, offset: cursor.offset + size })
}

fn take_int(cursor: Cursor, size: Int) -> (Int, Cursor) {
  let (bytes, next) = take_bytes(cursor, size)
  (int.from_bytearray_big_endian(bytes), next)
}

fn take_optional_int(cursor: Cursor, size: Int) -> (Option<Int>, Cursor) {
  let (marker, next) = take_int(cursor, 1)
  when marker is {
    0 -> (None, next)
    1 -> {
      let (value, after_value) = take_int(next, size)
      (Some(value), after_value)
    }
    _ -> fail @"invalid option marker"
  }
}

pub fn decode(bytes: ByteArray) -> PermitV1 {
  expect bytearray.length(bytes) <= max_permit_bytes
  let cursor = Cursor { bytes, offset: 0 }
  let (magic, cursor) = take_bytes(cursor, 4)
  expect magic == #"4e503031"
  let (version, cursor) = take_int(cursor, 1)
  expect version == 1
  let (domain, cursor) = take_int(cursor, 1)
  expect domain == 1
  let (midnight_network, cursor) = take_int(cursor, 1)
  expect midnight_network == 1
  let (cardano_network_magic, cursor) = take_int(cursor, 4)
  expect cardano_network_magic == 2
  let (midnight_contract_id, cursor) = take_bytes(cursor, 32)
  let (midnight_tx_id, cursor) = take_bytes(cursor, 32)
  let (authorization_index, cursor) = take_optional_int(cursor, 4)
  let (policy_id, cursor) = take_bytes(cursor, 32)
  let (escrow_id, cursor) = take_bytes(cursor, 32)
  let (milestone_id, cursor) = take_bytes(cursor, 32)
  let (beneficiary_pkh, cursor) = take_bytes(cursor, 28)
  let (action_id, cursor) = take_bytes(cursor, 32)
  let (asset_policy_length, cursor) = take_int(cursor, 1)
  expect asset_policy_length == 0 || asset_policy_length == 28
  let (asset_policy_id, cursor) = take_bytes(cursor, asset_policy_length)
  let (asset_name_length, cursor) = take_int(cursor, 1)
  expect asset_name_length <= 32
  let (asset_name, cursor) = take_bytes(cursor, asset_name_length)
  let (amount, cursor) = take_int(cursor, 8)
  let (nullifier, cursor) = take_bytes(cursor, 32)
  let (not_before_slot, cursor) = take_optional_int(cursor, 8)
  let (expires_at_slot, cursor) = take_int(cursor, 8)
  let (cardano_validator_hash, cursor) = take_bytes(cursor, 28)
  let (relay_key_id, cursor) = take_bytes(cursor, 32)
  expect cursor.offset == bytearray.length(bytes)
  when not_before_slot is {
    Some(slot) -> {
      expect slot <= expires_at_slot
    }
    None -> Void
  }

  PermitV1 {
    midnight_contract_id,
    midnight_tx_id,
    authorization_index,
    policy_id,
    escrow_id,
    milestone_id,
    beneficiary_pkh,
    action_id,
    asset_policy_id,
    asset_name,
    amount,
    nullifier,
    not_before_slot,
    expires_at_slot,
    cardano_validator_hash,
    relay_key_id,
  }
}

pub fn verify_signature(
  bytes: ByteArray,
  signature: ByteArray,
  relay_public_key: ByteArray,
) -> Bool {
  expect bytearray.length(signature) == 64
  expect bytearray.length(relay_public_key) == 32
  crypto.verify_ed25519_signature(relay_public_key, bytes, signature)
}

pub fn preview_slot_to_posix_ms(slot: Int) -> Int {
  expect slot >= 0
  preview_system_start_ms + slot * preview_slot_length_ms
}

fn validity_is_within_permit(
  validity_range: Interval<Int>,
  not_before_slot: Option<Int>,
  expires_at_slot: Int,
) -> Bool {
  let is_after_start =
    when not_before_slot is {
      None -> True
      Some(slot) ->
        interval.is_entirely_after(
          validity_range,
          preview_slot_to_posix_ms(slot) - 1,
        )
    }
  let is_before_expiry =
    interval.is_entirely_before(
      validity_range,
      preview_slot_to_posix_ms(expires_at_slot) + 1,
    )
  is_after_start && is_before_expiry
}

pub fn authorizes_claim(
  policy: PermitPolicy,
  permit_bytes: ByteArray,
  signature: ByteArray,
  signatories: List<crypto.VerificationKeyHash>,
  validity_range: Interval<Int>,
  consumed_nullifiers: List<ByteArray>,
) -> Bool {
  let permit = decode(permit_bytes)
  permit.midnight_contract_id == policy.midnight_contract_id && permit.policy_id == policy.policy_id && permit.escrow_id == policy.escrow_id && permit.milestone_id == policy.milestone_id && permit.beneficiary_pkh == policy.beneficiary_pkh && permit.action_id == policy.action_id && permit.asset_policy_id == policy.asset_policy_id && permit.asset_name == policy.asset_name && permit.amount == policy.amount && permit.cardano_validator_hash == policy.cardano_validator_hash && permit.relay_key_id == policy.relay_key_id && list.has(
    signatories,
    permit.beneficiary_pkh,
  ) && !list.has(consumed_nullifiers, permit.nullifier) && validity_is_within_permit(
    validity_range,
    permit.not_before_slot,
    permit.expires_at_slot,
  ) && verify_signature(permit_bytes, signature, policy.relay_public_key)
}
