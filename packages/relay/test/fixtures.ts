import type { EntitlementPolicy, RelayConfig } from "../src/config.js";
import type { AuthorizationSnapshot, AuthorizationSource } from "../src/midnight.js";
import type { SlotSource } from "../src/ogmios.js";
import { getRelayPublicKey } from "@nightpermit/permit";

export const signingSeed = "10".repeat(32);
export const relayPublicKey = await getRelayPublicKey(signingSeed);
export const transactionId = "20".repeat(32);

export const policy: EntitlementPolicy = {
  policyId: "31".repeat(32),
  escrowId: "32".repeat(32),
  milestoneId: "33".repeat(32),
  beneficiaryPkh: "34".repeat(28),
  actionId: "35".repeat(32),
  assetPolicyId: "36".repeat(28),
  assetName: "37".repeat(32),
  amount: 25_000_000n,
  cardanoValidatorHash: "38".repeat(28),
};

export const config: RelayConfig = {
  host: "127.0.0.1",
  port: 8787,
  midnightNetwork: "preprod",
  midnightIndexerUrl: new URL("https://indexer.preprod.midnight.network/api/v4/graphql"),
  midnightIndexerWsUrl: new URL("wss://indexer.preprod.midnight.network/api/v4/graphql/ws"),
  midnightContractId: "40".repeat(32),
  ogmiosUrl: new URL("http://127.0.0.1:1337"),
  relayKeyId: "41".repeat(32),
  relayPublicKey,
  relaySigningSeed: signingSeed,
  relayStateFile: "/tmp/nightpermit-relay-test-state.json",
  permitTtlSlots: 600n,
  providerTimeoutMs: 500,
  providerMaxAttempts: 2,
  policies: new Map([[policy.policyId, policy]]),
};

export const authorization: AuthorizationSnapshot = {
  contractId: config.midnightContractId,
  transactionId,
  policyId: policy.policyId,
  escrowId: policy.escrowId,
  milestoneId: policy.milestoneId,
  beneficiaryPkh: policy.beneficiaryPkh,
  actionId: policy.actionId,
  assetPolicyId: policy.assetPolicyId,
  assetName: policy.assetName,
  amount: policy.amount,
  cardanoValidatorHash: policy.cardanoValidatorHash,
  approvalCount: 2n,
  authorized: true,
  authorizationNullifier: "42".repeat(32),
};

export function sources(snapshot: AuthorizationSnapshot = authorization): {
  authorizationSource: AuthorizationSource;
  slotSource: SlotSource;
  calls: { authorization: number; slot: number };
} {
  const calls = { authorization: 0, slot: 0 };
  return {
    calls,
    authorizationSource: {
      async readAtTransaction() {
        calls.authorization += 1;
        return snapshot;
      },
    },
    slotSource: {
      async currentSlot() {
        calls.slot += 1;
        return 121_500_000n;
      },
    },
  };
}
