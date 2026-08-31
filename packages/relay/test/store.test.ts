import { chmod, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { FilePermitStore } from "../src/store.js";
import { PermitService } from "../src/service.js";
import { config, sources, transactionId } from "./fixtures.js";

const directories: string[] = [];

afterEach(async () => {
  const { rm } = await import("node:fs/promises");
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true })));
});

async function statePath(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "nightpermit-relay-store-"));
  directories.push(directory);
  return join(directory, "state.json");
}

describe("FilePermitStore", () => {
  it("preserves the exact permit across a relay restart", async () => {
    const path = await statePath();
    const firstSources = sources();
    const firstService = new PermitService(
      config,
      firstSources.authorizationSource,
      firstSources.slotSource,
      new FilePermitStore(path),
    );
    const issued = await firstService.issue({ midnightTxId: transactionId });

    const secondSources = sources();
    const restartedService = new PermitService(
      config,
      secondSources.authorizationSource,
      secondSources.slotSource,
      new FilePermitStore(path),
    );
    const recovered = await restartedService.issue({ midnightTxId: transactionId });

    expect(recovered).toEqual(issued);
    expect(secondSources.calls).toEqual({ authorization: 0, slot: 0 });
    expect(JSON.parse(await readFile(path, "utf8"))).toMatchObject({ version: 1 });
  });

  it("fails closed when persisted permit bytes are modified", async () => {
    const path = await statePath();
    const source = sources();
    const service = new PermitService(
      config,
      source.authorizationSource,
      source.slotSource,
      new FilePermitStore(path),
    );
    await service.issue({ midnightTxId: transactionId });
    const stored = JSON.parse(await readFile(path, "utf8"));
    stored.permits[transactionId].permitBytes = `ff${stored.permits[transactionId].permitBytes.slice(2)}`;
    await writeFile(path, JSON.stringify(stored));
    await chmod(path, 0o600);

    await expect(service.get(transactionId)).rejects.toMatchObject({
      code: "NP_RELAY_INTERNAL",
    });
  });
});
