import { RelayError } from "./errors.js";
import { exactKeys, object } from "./validation.js";

export interface SlotSource {
  currentSlot(): Promise<bigint>;
}

export type OgmiosSlotSourceOptions = {
  url: URL;
  timeoutMs: number;
  maxAttempts: number;
};

export function createOgmiosSlotSource(options: OgmiosSlotSourceOptions): SlotSource {
  return {
    async currentSlot() {
      let lastError: unknown;
      for (let attempt = 1; attempt <= options.maxAttempts; attempt += 1) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), options.timeoutMs);
        try {
          const response = await fetch(options.url, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ jsonrpc: "2.0", method: "queryNetwork/tip", id: "nightpermit" }),
            signal: controller.signal,
          });
          if (!response.ok) {
            throw new Error(`Ogmios returned HTTP ${response.status}`);
          }
          const body = object(await response.json(), "Ogmios response");
          exactKeys(body, ["jsonrpc", "id", "result"], "Ogmios response");
          const result = object(body.result, "Ogmios response.result");
          const slot = result.slot;
          if (typeof slot !== "number" || !Number.isSafeInteger(slot) || slot < 0) {
            throw new Error("Ogmios tip did not contain a valid slot");
          }
          return BigInt(slot);
        } catch (error) {
          lastError = error;
        } finally {
          clearTimeout(timeoutId);
        }
      }
      throw new RelayError(
        "NP_RELAY_PROVIDER_UNAVAILABLE",
        "Cardano slot provider is unavailable",
        503,
        { cause: lastError },
      );
    },
  };
}
