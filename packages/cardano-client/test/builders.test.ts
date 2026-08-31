import type { LucidEvolution, TxBuilder, TxSignBuilder } from "@lucid-evolution/lucid";
import { describe, expect, it } from "vitest";
import {
  buildClaimTransaction,
  buildInitializationTransaction,
  createClaimPlan,
  createInitializationPlan,
} from "../src/index.js";
import { fixture, validator } from "./fixtures.js";

type Call = { method: string; args: unknown[] };

function recordingLucid(): { lucid: LucidEvolution; calls: Call[]; completed: TxSignBuilder } {
  const calls: Call[] = [];
  const completed = { marker: "complete" } as unknown as TxSignBuilder;
  let builder: TxBuilder;
  const record = (method: string) => (...args: unknown[]) => {
    calls.push({ method, args });
    return builder;
  };
  builder = {
    collectFrom: record("collectFrom"),
    mintAssets: record("mintAssets"),
    addSignerKey: record("addSignerKey"),
    validFrom: record("validFrom"),
    validTo: record("validTo"),
    pay: {
      ToContract: record("pay.ToContract"),
      ToAddress: record("pay.ToAddress"),
      ToAddressWithData: record("pay.ToAddressWithData"),
    },
    attach: {
      SpendingValidator: record("attach.SpendingValidator"),
      MintingPolicy: record("attach.MintingPolicy"),
    },
    complete: async () => {
      calls.push({ method: "complete", args: [] });
      return completed;
    },
  } as unknown as TxBuilder;
  const lucid = { newTx: () => builder } as unknown as LucidEvolution;
  return { lucid, calls, completed };
}

describe("Lucid transaction assembly", () => {
  it("assembles a claim with state, payout, signer, validity, and validator witnesses", async () => {
    const input = await fixture();
    const plan = await createClaimPlan(input);
    const runtime = recordingLucid();
    expect(await buildClaimTransaction(runtime.lucid, plan)).toBe(runtime.completed);
    expect(runtime.calls.map(({ method }) => method)).toEqual([
      "collectFrom",
      "pay.ToContract",
      "pay.ToAddressWithData",
      "addSignerKey",
      "validFrom",
      "validTo",
      "attach.SpendingValidator",
      "complete",
    ]);
    expect(runtime.calls[0]?.args).toEqual([[input.stateUtxo], plan.claimRedeemer]);
    expect(runtime.calls[2]?.args).toEqual([
      input.beneficiaryAddress,
      { kind: "inline", value: plan.payoutDatum },
      plan.payoutAssets,
    ]);
  });

  it("assembles one-shot initialization around the selected output reference", async () => {
    const input = await fixture();
    const plan = createInitializationPlan(
      validator,
      {
        txHash: "aa".repeat(32),
        outputIndex: 1,
        address: input.beneficiaryAddress,
        assets: { lovelace: 100_000_000n },
      },
      input.state,
      {
        lovelace: 10_000_000n,
        [input.state.permitPolicy.assetPolicyId + input.state.permitPolicy.assetName]: 50_000_000n,
      },
    );
    const runtime = recordingLucid();
    expect(await buildInitializationTransaction(runtime.lucid, plan)).toBe(runtime.completed);
    expect(runtime.calls.map(({ method }) => method)).toEqual([
      "collectFrom",
      "mintAssets",
      "pay.ToContract",
      "attach.MintingPolicy",
      "complete",
    ]);
    expect(runtime.calls[1]?.args).toEqual([{ [plan.stateTokenUnit]: 1n }, plan.mintRedeemer]);
  });
});
