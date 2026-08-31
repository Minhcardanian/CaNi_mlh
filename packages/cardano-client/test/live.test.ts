import type { LucidEvolution, TxSignBuilder } from "@lucid-evolution/lucid";
import { describe, expect, it, vi } from "vitest";
import { createWalletClaimPlan, submitWalletClaim } from "../src/index.js";
import { currentSlot, fixture } from "./fixtures.js";

describe("live wallet claim adapter", () => {
  it("discovers and decodes the unique state UTxO", async () => {
    const input = await fixture();
    const lucid = {
      currentSlot: () => Number(currentSlot),
      utxosAtWithUnit: vi.fn(async () => [input.stateUtxo]),
      wallet: () => ({ address: async () => input.beneficiaryAddress }),
    } as unknown as LucidEvolution;
    const plan = await createWalletClaimPlan(lucid, input.envelope, input.validator);
    expect(plan.stateUtxo).toEqual(input.stateUtxo);
    expect(plan.currentState).toEqual(input.state);
    expect(lucid.utxosAtWithUnit).toHaveBeenCalledOnce();
  });

  it("fails closed when the state token lookup is ambiguous", async () => {
    const input = await fixture();
    const lucid = {
      utxosAtWithUnit: async () => [input.stateUtxo, input.stateUtxo],
    } as unknown as LucidEvolution;
    await expect(createWalletClaimPlan(lucid, input.envelope, input.validator)).rejects.toMatchObject({
      code: "NP_CARDANO_BAD_UTXO",
    });
  });

  it("signs, submits canonically, and exposes confirmation as the terminal step", async () => {
    const input = await fixture();
    const submit = vi.fn(async () => "ab".repeat(32));
    const completeSigned = vi.fn(async () => ({ submit }));
    const completeBuilt = vi.fn(async () => ({
      sign: { withWallet: () => ({ complete: completeSigned }) },
    } as unknown as TxSignBuilder));
    let builder: Record<string, unknown>;
    const chain = () => builder;
    builder = {
      collectFrom: chain,
      addSignerKey: chain,
      validFrom: chain,
      validTo: chain,
      pay: { ToContract: chain, ToAddressWithData: chain },
      attach: { SpendingValidator: chain },
      complete: completeBuilt,
    };
    const awaitTxConfirmation = vi.fn(async () => ({ status: "confirmed" }));
    const lucid = {
      currentSlot: () => Number(currentSlot),
      utxosAtWithUnit: async () => [input.stateUtxo],
      wallet: () => ({ address: async () => input.beneficiaryAddress }),
      newTx: () => builder,
      awaitTxConfirmation,
    } as unknown as LucidEvolution;

    const result = await submitWalletClaim(lucid, input.envelope, input.validator);
    expect(result.transactionId).toBe("ab".repeat(32));
    expect(submit).toHaveBeenCalledWith({ canonical: true });
    expect(awaitTxConfirmation).not.toHaveBeenCalled();
    await result.awaitConfirmation();
    expect(awaitTxConfirmation).toHaveBeenCalledWith(result.transactionId);
  });
});
