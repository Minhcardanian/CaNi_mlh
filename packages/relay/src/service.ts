import {
  MIDNIGHT_NETWORK,
  PERMIT_DOMAIN,
  PERMIT_VERSION,
  getRelayPublicKey,
  decodeHex,
  decodePermit,
  encodeHex,
  hashPermit,
  signPermit,
  verifyPermitSignature,
  type Hex,
  type PermitV1,
  type SignedPermit,
} from "@nightpermit/permit";
import type { EntitlementPolicy, RelayConfig } from "./config.js";
import { RelayError } from "./errors.js";
import type { AuthorizationSnapshot, AuthorizationSource } from "./midnight.js";
import type { SlotSource } from "./ogmios.js";
import { MemoryPermitStore, type PermitStore } from "./store.js";
import { exactKeys, hex, object } from "./validation.js";

export const MAX_ENVELOPE_BYTES = 2_048;

export type PermitRequest = {
  midnightTxId: Hex;
};

export type PermitEnvelope = {
  version: 1;
  permitBytes: Hex;
  permitHash: Hex;
  signature: Hex;
  relayPublicKey: Hex;
};

export class PermitService {
  private readonly pending = new Map<Hex, Promise<PermitEnvelope>>();
  private relayPublicKeyPromise: Promise<Hex> | undefined;

  constructor(
    private readonly config: RelayConfig,
    private readonly authorizations: AuthorizationSource,
    private readonly slots: SlotSource,
    private readonly store: PermitStore = new MemoryPermitStore(),
  ) {}

  parseRequest(input: unknown): PermitRequest {
    const value = object(input, "request");
    exactKeys(value, ["midnightTxId"], "request");
    return { midnightTxId: hex(value.midnightTxId, 32, "midnightTxId") };
  }

  async get(midnightTxId: Hex): Promise<PermitEnvelope> {
    const record = await this.store.get(midnightTxId);
    if (record === undefined) {
      throw new RelayError("NP_RELAY_PERMIT_NOT_FOUND", "permit was not issued", 404);
    }
    await this.validateStored(record, midnightTxId);
    return record;
  }

  async issue(request: PermitRequest): Promise<PermitEnvelope> {
    const existing = await this.store.get(request.midnightTxId);
    if (existing !== undefined) {
      await this.validateStored(existing, request.midnightTxId);
      return existing;
    }
    const inFlight = this.pending.get(request.midnightTxId);
    if (inFlight !== undefined) {
      return inFlight;
    }
    const operation = this.issueOnce(request).finally(() => {
      this.pending.delete(request.midnightTxId);
    });
    this.pending.set(request.midnightTxId, operation);
    return operation;
  }

  private async issueOnce(request: PermitRequest): Promise<PermitEnvelope> {
    const authorization = await this.authorizations.readAtTransaction(request.midnightTxId);
    const policy = this.validateAuthorization(authorization, request.midnightTxId);
    const notBeforeSlot = await this.slots.currentSlot();
    const permit: PermitV1 = {
      version: PERMIT_VERSION,
      domain: PERMIT_DOMAIN,
      midnightNetwork: MIDNIGHT_NETWORK,
      midnightContractId: this.config.midnightContractId,
      midnightTxId: request.midnightTxId,
      policyId: policy.policyId,
      escrowId: policy.escrowId,
      milestoneId: policy.milestoneId,
      beneficiaryPkh: policy.beneficiaryPkh,
      actionId: policy.actionId,
      entitlement: {
        policyId: policy.policyId,
        escrowId: policy.escrowId,
        milestoneId: policy.milestoneId,
        assetPolicyId: policy.assetPolicyId,
        assetName: policy.assetName,
        amount: policy.amount,
      },
      nullifier: authorization.authorizationNullifier,
      notBeforeSlot,
      expiresAtSlot: notBeforeSlot + this.config.permitTtlSlots,
      cardanoValidatorHash: policy.cardanoValidatorHash,
      relayKeyId: this.config.relayKeyId,
    };
    const [signed, relayPublicKey] = await Promise.all([
      signPermit(permit, this.config.relaySigningSeed),
      this.relayPublicKey(),
    ]);
    const envelope = toEnvelope(signed, relayPublicKey);
    if (new TextEncoder().encode(JSON.stringify(envelope)).length > MAX_ENVELOPE_BYTES) {
      throw new RelayError("NP_RELAY_INTERNAL", "signed permit exceeds the transport budget", 500);
    }
    return this.store.putIfAbsent(request.midnightTxId, envelope);
  }

  private relayPublicKey(): Promise<Hex> {
    this.relayPublicKeyPromise ??= getRelayPublicKey(this.config.relaySigningSeed);
    return this.relayPublicKeyPromise;
  }

  private async validateStored(envelope: PermitEnvelope, transactionId: Hex): Promise<void> {
    try {
      const bytes = decodeHex(envelope.permitBytes, "stored permit bytes");
      const permit = decodePermit(bytes);
      const relayPublicKey = await this.relayPublicKey();
      const valid =
        permit.midnightTxId === transactionId &&
        permit.midnightContractId === this.config.midnightContractId &&
        permit.relayKeyId === this.config.relayKeyId &&
        envelope.relayPublicKey === relayPublicKey &&
        envelope.permitHash === encodeHex(hashPermit(bytes)) &&
        (await verifyPermitSignature(bytes, envelope.signature, relayPublicKey));
      if (!valid) {
        throw new Error("stored permit validation failed");
      }
    } catch (error) {
      throw new RelayError("NP_RELAY_INTERNAL", "stored permit failed integrity validation", 500, {
        cause: error,
      });
    }
  }

  private validateAuthorization(authorization: AuthorizationSnapshot, transactionId: Hex): EntitlementPolicy {
    if (
      authorization.contractId !== this.config.midnightContractId ||
      authorization.transactionId !== transactionId ||
      authorization.approvalCount !== 2n ||
      !authorization.authorized ||
      authorization.authorizationNullifier === "00".repeat(32)
    ) {
      rejected();
    }
    const policy = this.config.policies.get(authorization.policyId);
    if (policy === undefined) {
      rejected();
    }
    const bindings = [
      [authorization.escrowId, policy.escrowId],
      [authorization.milestoneId, policy.milestoneId],
      [authorization.beneficiaryPkh, policy.beneficiaryPkh],
      [authorization.actionId, policy.actionId],
      [authorization.assetPolicyId, policy.assetPolicyId],
      [authorization.assetName, policy.assetName],
      [authorization.amount, policy.amount],
      [authorization.cardanoValidatorHash, policy.cardanoValidatorHash],
    ] as const;
    if (bindings.some(([actual, expected]) => actual !== expected)) {
      rejected();
    }
    return policy;
  }
}

function toEnvelope(signed: SignedPermit, relayPublicKey: Hex): PermitEnvelope {
  return {
    version: 1,
    permitBytes: signed.permitBytes,
    permitHash: signed.permitHash,
    signature: signed.signature,
    relayPublicKey,
  };
}

function rejected(): never {
  throw new RelayError(
    "NP_RELAY_AUTHORIZATION_REJECTED",
    "Midnight authorization does not satisfy the configured policy",
    422,
  );
}
