export type Hex = string;

export const PERMIT_VERSION = 1 as const;
export const PERMIT_DOMAIN = "nightpermit/cardano-preview/v1" as const;
export const MIDNIGHT_NETWORK = "preprod" as const;
export const CARDANO_NETWORK_MAGIC = 2 as const;

export type Entitlement = {
  policyId: Hex;
  escrowId: Hex;
  milestoneId: Hex;
  assetPolicyId: Hex;
  assetName: Hex;
  amount: bigint;
};

export type PermitV1 = {
  version: typeof PERMIT_VERSION;
  domain: typeof PERMIT_DOMAIN;
  midnightNetwork: typeof MIDNIGHT_NETWORK;
  midnightContractId: Hex;
  midnightTxId: Hex;
  authorizationIndex?: number;
  policyId: Hex;
  escrowId: Hex;
  milestoneId: Hex;
  beneficiaryPkh: Hex;
  actionId: Hex;
  entitlement: Entitlement;
  nullifier: Hex;
  notBeforeSlot?: bigint;
  expiresAtSlot: bigint;
  cardanoValidatorHash: Hex;
  relayKeyId: Hex;
};

export type SignedPermit = {
  permit: PermitV1;
  permitBytes: Hex;
  permitHash: Hex;
  signature: Hex;
};
