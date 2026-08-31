import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { Hex } from "@nightpermit/permit";
import { RelayError } from "./errors.js";
import type { PermitEnvelope } from "./service.js";
import { exactKeys, hex, integer, object, variableHex } from "./validation.js";

export interface PermitStore {
  get(transactionId: Hex): Promise<PermitEnvelope | undefined>;
  putIfAbsent(transactionId: Hex, envelope: PermitEnvelope): Promise<PermitEnvelope>;
}

export class MemoryPermitStore implements PermitStore {
  private readonly records = new Map<Hex, PermitEnvelope>();

  async get(transactionId: Hex): Promise<PermitEnvelope | undefined> {
    return this.records.get(transactionId);
  }

  async putIfAbsent(transactionId: Hex, envelope: PermitEnvelope): Promise<PermitEnvelope> {
    const existing = this.records.get(transactionId);
    if (existing !== undefined) {
      return existing;
    }
    this.records.set(transactionId, envelope);
    return envelope;
  }
}

export class FilePermitStore implements PermitStore {
  private writes: Promise<void> = Promise.resolve();

  constructor(private readonly path: string) {}

  async get(transactionId: Hex): Promise<PermitEnvelope | undefined> {
    return (await this.read()).get(transactionId);
  }

  async putIfAbsent(transactionId: Hex, envelope: PermitEnvelope): Promise<PermitEnvelope> {
    let result = envelope;
    const operation = this.writes.then(async () => {
      const records = await this.read();
      const existing = records.get(transactionId);
      if (existing !== undefined) {
        result = existing;
        return;
      }
      records.set(transactionId, envelope);
      await mkdir(dirname(this.path), { recursive: true, mode: 0o700 });
      const temporary = `${this.path}.${process.pid}.tmp`;
      await writeFile(temporary, serialize(records), { encoding: "utf8", mode: 0o600 });
      await rename(temporary, this.path);
    });
    this.writes = operation.catch(() => undefined);
    try {
      await operation;
      return result;
    } catch (error) {
      throw storageError(error);
    }
  }

  private async read(): Promise<Map<Hex, PermitEnvelope>> {
    let raw: string;
    try {
      raw = await readFile(this.path, "utf8");
    } catch (error) {
      if (isNotFound(error)) {
        return new Map();
      }
      throw storageError(error);
    }
    try {
      const root = object(JSON.parse(raw), "relay state");
      exactKeys(root, ["version", "permits"], "relay state");
      integer(root.version, 1, 1, "relay state.version");
      const permits = object(root.permits, "relay state.permits");
      const records = new Map<Hex, PermitEnvelope>();
      for (const [transactionId, value] of Object.entries(permits)) {
        records.set(hex(transactionId, 32, "stored transaction id"), parseEnvelope(value));
      }
      return records;
    } catch (error) {
      throw storageError(error);
    }
  }
}

function parseEnvelope(value: unknown): PermitEnvelope {
  const record = object(value, "stored permit");
  exactKeys(
    record,
    ["version", "permitBytes", "permitHash", "signature", "relayPublicKey"],
    "stored permit",
  );
  integer(record.version, 1, 1, "stored permit.version");
  return {
    version: 1,
    permitBytes: variableHex(record.permitBytes, 512, "stored permit.permitBytes"),
    permitHash: hex(record.permitHash, 32, "stored permit.permitHash"),
    signature: hex(record.signature, 64, "stored permit.signature"),
    relayPublicKey: hex(record.relayPublicKey, 32, "stored permit.relayPublicKey"),
  };
}

function serialize(records: ReadonlyMap<Hex, PermitEnvelope>): string {
  return `${JSON.stringify({ version: 1, permits: Object.fromEntries(records) })}\n`;
}

function isNotFound(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}

function storageError(cause: unknown): RelayError {
  return new RelayError("NP_RELAY_INTERNAL", "relay state is unavailable", 500, { cause });
}
