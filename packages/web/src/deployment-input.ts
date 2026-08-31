import type { DeploymentInputs } from "@nightpermit/deployment";

type PublicPolicyInputs = Omit<DeploymentInputs, "validatorCompiledCode" | "initializationRef">;

const stringFields = [
  "policyId",
  "escrowId",
  "milestoneId",
  "beneficiaryPkh",
  "actionId",
  "assetPolicyId",
  "assetName",
  "reviewerOnePublicKey",
  "reviewerTwoPublicKey",
  "relayKeyId",
  "relayPublicKey",
] as const;

export const policyTemplate = JSON.stringify({
  policyId: "",
  escrowId: "",
  milestoneId: "",
  beneficiaryPkh: "",
  actionId: "",
  assetPolicyId: "",
  assetName: "",
  amount: "0",
  reviewerOnePublicKey: "",
  reviewerTwoPublicKey: "",
  relayKeyId: "",
  relayPublicKey: "",
}, null, 2);

export function parsePublicPolicy(value: string): PublicPolicyInputs {
  const parsed: unknown = JSON.parse(value);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("public deployment policy must be a JSON object");
  }
  const record = parsed as Record<string, unknown>;
  const allowed = new Set<string>([...stringFields, "amount"]);
  if (Object.keys(record).some((key) => !allowed.has(key))) {
    throw new Error("public deployment policy contains an unexpected field");
  }
  for (const field of stringFields) {
    if (typeof record[field] !== "string") throw new Error(`${field} must be a string`);
  }
  if (typeof record.amount !== "string" || !/^[1-9][0-9]*$/.test(record.amount)) {
    throw new Error("amount must be a positive integer string");
  }
  return {
    policyId: record.policyId as string,
    escrowId: record.escrowId as string,
    milestoneId: record.milestoneId as string,
    beneficiaryPkh: record.beneficiaryPkh as string,
    actionId: record.actionId as string,
    assetPolicyId: record.assetPolicyId as string,
    assetName: record.assetName as string,
    amount: BigInt(record.amount),
    reviewerOnePublicKey: record.reviewerOnePublicKey as string,
    reviewerTwoPublicKey: record.reviewerTwoPublicKey as string,
    relayKeyId: record.relayKeyId as string,
    relayPublicKey: record.relayPublicKey as string,
  };
}
