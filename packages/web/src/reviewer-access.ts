import { validatePassword } from "@midnight-ntwrk/midnight-js-utils";
import { WebFlowError } from "./errors.js";
import type { ReviewerAccess } from "./runtime.js";

export function parseReviewerSecret(access: ReviewerAccess): Uint8Array | undefined {
  try {
    validatePassword(access.privateStoragePassword);
  } catch (cause) {
    throw new WebFlowError("NP_WEB_BAD_STORAGE_PASSWORD", { cause });
  }
  if (access.reviewerSecretHex === undefined) return undefined;
  if (!/^[0-9a-f]{64}$/.test(access.reviewerSecretHex)) {
    throw new WebFlowError("NP_WEB_BAD_REVIEWER_SECRET");
  }
  return Uint8Array.from(access.reviewerSecretHex.match(/.{2}/g)!, (byte) => Number.parseInt(byte, 16));
}
