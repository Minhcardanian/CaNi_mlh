import type { PermitV1 } from "../src/index.js";

const repeat = (byte: string, count: number): string => byte.repeat(count);

export const ordinaryPermit: PermitV1 = {
  version: 1,
  domain: "nightpermit/cardano-preview/v1",
  midnightNetwork: "preprod",
  midnightContractId: repeat("11", 32),
  midnightTxId: repeat("22", 32),
  authorizationIndex: 7,
  policyId: repeat("33", 32),
  escrowId: repeat("44", 32),
  milestoneId: repeat("55", 32),
  beneficiaryPkh: repeat("66", 28),
  actionId: repeat("77", 32),
  entitlement: {
    policyId: repeat("33", 32),
    escrowId: repeat("44", 32),
    milestoneId: repeat("55", 32),
    assetPolicyId: "",
    assetName: "",
    amount: 25_000_000n,
  },
  nullifier: repeat("88", 32),
  notBeforeSlot: 121_500_000n,
  expiresAtSlot: 121_503_600n,
  cardanoValidatorHash: repeat("99", 28),
  relayKeyId: repeat("aa", 32),
};

export const boundaryPermit: PermitV1 = {
  ...ordinaryPermit,
  authorizationIndex: 0xffff_ffff,
  entitlement: {
    ...ordinaryPermit.entitlement,
    assetPolicyId: repeat("ab", 28),
    assetName: repeat("cd", 32),
    amount: 0xffff_ffff_ffff_ffffn,
  },
  notBeforeSlot: 0xffff_ffff_ffff_ffffn,
  expiresAtSlot: 0xffff_ffff_ffff_ffffn,
};
