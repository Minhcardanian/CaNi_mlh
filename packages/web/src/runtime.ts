import type { WalletApi } from "@lucid-evolution/core-types";
import type { ConnectedAPI, InitialAPI } from "@midnight-ntwrk/dapp-connector-api";
import { bech32 } from "@scure/base";
import semver from "semver";
import type { PermitEnvelope } from "@nightpermit/cardano-client";
import { WebFlowError } from "./errors.js";
import type { PublicWallet } from "./state.js";

type CardanoConnector = {
  name?: string;
  enable(): Promise<WalletApi>;
};

export type ConnectedWallet<T> = {
  api: T;
  wallet: PublicWallet;
};

export type ApprovalResult = {
  transactionId: string;
  approvalCount: 1 | 2;
  authorized: boolean;
};

export type ClaimResult = {
  transactionId: string;
  awaitConfirmation(): Promise<void>;
};

export type ReviewerAccess = {
  privateStoragePassword: string;
  reviewerSecretHex?: string;
};

export type ProductBridge = {
  approve(connectedWallet: ConnectedAPI, access: ReviewerAccess): Promise<ApprovalResult>;
  claim(wallet: WalletApi, permit: PermitEnvelope): Promise<ClaimResult>;
};

export type AppRuntime = {
  connectMidnight(): Promise<PublicWallet>;
  connectCardano(walletId?: string): Promise<PublicWallet>;
  approve(access: ReviewerAccess): Promise<ApprovalResult>;
  getPermit(midnightTxId: string): Promise<{ permit: PermitEnvelope; correlationId: string }>;
  claim(permit: PermitEnvelope): Promise<ClaimResult>;
};

function isLocalhost(hostname: string): boolean {
  return hostname === "127.0.0.1" || hostname === "localhost" || hostname === "[::1]";
}

function previewAddressFromHex(value: string): string {
  if (!/^[0-9a-f]+$/i.test(value) || value.length % 2 !== 0) {
    throw new WebFlowError("NP_WEB_WALLET_REJECTED");
  }
  const bytes = Uint8Array.from(value.match(/.{2}/g) ?? [], (byte) => Number.parseInt(byte, 16));
  if (bytes.length < 2 || (bytes[0]! & 0x0f) !== 0) {
    throw new WebFlowError("NP_WEB_WRONG_CARDANO_NETWORK");
  }
  return bech32.encode("addr_test", bech32.toWords(bytes), false);
}

export async function connectMidnightWallet(): Promise<ConnectedWallet<ConnectedAPI>> {
  const connector = Object.values(window.midnight ?? {}).find(
    (candidate): candidate is InitialAPI =>
      Boolean(candidate && semver.satisfies(candidate.apiVersion, "4.x")),
  );
  if (!connector) throw new WebFlowError("NP_WEB_MIDNIGHT_WALLET_MISSING");
  try {
    const api = await connector.connect("preprod");
    const status = await api.getConnectionStatus();
    if (status.status !== "connected") throw new WebFlowError("NP_WEB_WALLET_REJECTED");
    if (status.networkId !== "preprod") throw new WebFlowError("NP_WEB_WRONG_MIDNIGHT_NETWORK");
    return {
      api,
      wallet: { name: connector.name ?? "Midnight Lace", network: "Midnight Preprod" },
    };
  } catch (error) {
    if (error instanceof WebFlowError) throw error;
    throw new WebFlowError("NP_WEB_WALLET_REJECTED", { cause: error });
  }
}

export async function connectCardanoWallet(walletId?: string): Promise<ConnectedWallet<WalletApi>> {
  const entries = (Object.entries(window.cardano ?? {}) as Array<[string, CardanoConnector]>).filter(
    ([, connector]) => typeof connector.enable === "function",
  );
  const selected = walletId ? entries.find(([id]) => id === walletId) : entries[0];
  if (!selected) throw new WebFlowError("NP_WEB_CARDANO_WALLET_MISSING");
  try {
    const api = await selected[1].enable();
    if (await api.getNetworkId() !== 0) throw new WebFlowError("NP_WEB_WRONG_CARDANO_NETWORK");
    const address = previewAddressFromHex(await api.getChangeAddress());
    return {
      api,
      wallet: {
        name: selected[1].name ?? selected[0],
        network: "Cardano Preview",
        address,
      },
    };
  } catch (error) {
    if (error instanceof WebFlowError) throw error;
    throw new WebFlowError("NP_WEB_WALLET_REJECTED", { cause: error });
  }
}

export function relayUrl(value: string, pageUrl = window.location.href): URL {
  const url = new URL(value, pageUrl);
  if (url.username || url.password || url.hash) {
    throw new WebFlowError("NP_WEB_RUNTIME_NOT_CONFIGURED");
  }
  if (url.protocol !== "https:" && !(url.protocol === "http:" && isLocalhost(url.hostname))) {
    throw new WebFlowError("NP_WEB_RUNTIME_NOT_CONFIGURED");
  }
  return url;
}

function parsePermitResponse(value: unknown): { permit: PermitEnvelope; correlationId: string } {
  if (!value || typeof value !== "object") throw new WebFlowError("NP_WEB_UNEXPECTED");
  const record = value as Record<string, unknown>;
  if (typeof record.correlationId !== "string" || !record.permit || typeof record.permit !== "object") {
    throw new WebFlowError("NP_WEB_UNEXPECTED");
  }
  const permit = record.permit as Record<string, unknown>;
  const fields = ["permitBytes", "permitHash", "signature", "relayPublicKey"] as const;
  if (permit.version !== 1 || fields.some((field) => typeof permit[field] !== "string")) {
    throw new WebFlowError("NP_WEB_UNEXPECTED");
  }
  return {
    correlationId: record.correlationId,
    permit: permit as PermitEnvelope,
  };
}

async function fetchJson(url: URL): Promise<unknown> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 5_000);
  try {
    const response = await fetch(url, {
      headers: { accept: "application/json" },
      signal: controller.signal,
    });
    const body = await response.json() as unknown;
    if (!response.ok) {
      const code = typeof body === "object" && body !== null && "error" in body
        ? (body.error as { code?: unknown }).code
        : undefined;
      throw new WebFlowError(typeof code === "string" ? code : "NP_WEB_UNEXPECTED");
    }
    return body;
  } finally {
    window.clearTimeout(timer);
  }
}

export function createBrowserRuntime(baseUrl: URL, bridge?: ProductBridge): AppRuntime {
  let midnightWallet: ConnectedAPI | undefined;
  let cardanoWallet: WalletApi | undefined;
  return {
    async connectMidnight() {
      const connected = await connectMidnightWallet();
      midnightWallet = connected.api;
      return connected.wallet;
    },
    async connectCardano(walletId) {
      const connected = await connectCardanoWallet(walletId);
      cardanoWallet = connected.api;
      return connected.wallet;
    },
    async approve(access) {
      if (!midnightWallet || !bridge) {
        throw new WebFlowError("NP_WEB_RUNTIME_NOT_CONFIGURED");
      }
      return bridge.approve(midnightWallet, access);
    },
    async getPermit(midnightTxId) {
      if (!/^[0-9a-f]{64}$/.test(midnightTxId)) throw new WebFlowError("NP_WEB_UNEXPECTED");
      return parsePermitResponse(await fetchJson(new URL(`/v1/permits/${midnightTxId}`, baseUrl)));
    },
    async claim(permit) {
      if (!cardanoWallet || !bridge) {
        throw new WebFlowError("NP_WEB_RUNTIME_NOT_CONFIGURED");
      }
      return bridge.claim(cardanoWallet, permit);
    },
  };
}
