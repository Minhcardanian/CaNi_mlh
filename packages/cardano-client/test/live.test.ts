import type { LucidEvolution, TxSignBuilder } from "@lucid-evolution/lucid";
import { describe, expect, it, vi } from "vitest";
import {
  createWalletClaimPlan,
  createWalletInitializationPlan,
  submitWalletClaim,
  submitWalletInitialization,
} from "../src/index.js";
import { currentSlot, fixture, rawValidatorCode } from "./fixtures.js";

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

describe("live wallet initialization adapter", () => {
  const initialInventory = (input: Awaited<ReturnType<typeof fixture>>) => ({
    lovelace: 10_000_000n,
    [input.state.permitPolicy.assetPolicyId + input.state.permitPolicy.assetName]: 50_000_000n,
  });

  it("requires the parameterization output reference to belong to the connected wallet", async () => {
    const input = await fixture();
    const initializationRef = { txHash: "aa".repeat(32), outputIndex: 1 };
    const initializationUtxo = {
      ...initializationRef,
      address: input.beneficiaryAddress,
      assets: { lovelace: 100_000_000n },
    };
    const lucid = {
      utxosByOutRef: async () => [initializationUtxo],
      wallet: () => ({ getUtxos: async () => [initializationUtxo] }),
    } as unknown as LucidEvolution;
    const plan = await createWalletInitializationPlan(lucid, {
      compiledCode: rawValidatorCode,
      initializationRef,
      initialState: input.state,
      inventory: initialInventory(input),
    });
    expect(plan.initializationUtxo).toEqual(initializationUtxo);

    const unrelated = {
      ...lucid,
      wallet: () => ({ getUtxos: async () => [] }),
    } as unknown as LucidEvolution;
    await expect(createWalletInitializationPlan(unrelated, {
      compiledCode: rawValidatorCode,
      initializationRef,
      initialState: input.state,
      inventory: initialInventory(input),
    })).rejects.toMatchObject({ code: "NP_CARDANO_BAD_UTXO" });
  });

  it("signs and submits initialization once while exposing confirmation separately", async () => {
    const input = await fixture();
    const initializationRef = { txHash: "aa".repeat(32), outputIndex: 1 };
    const initializationUtxo = {
      ...initializationRef,
      address: input.beneficiaryAddress,
      assets: { lovelace: 100_000_000n },
    };
    const submit = vi.fn(async () => "cd".repeat(32));
    const completeSigned = vi.fn(async () => ({ submit }));
    const completeBuilt = vi.fn(async () => ({
      sign: { withWallet: () => ({ complete: completeSigned }) },
    } as unknown as TxSignBuilder));
    let builder: Record<string, unknown>;
    const chain = () => builder;
    builder = {
      collectFrom: chain,
      mintAssets: chain,
      pay: { ToContract: chain },
      attach: { MintingPolicy: chain },
      complete: completeBuilt,
    };
    const awaitTxConfirmation = vi.fn(async () => ({ status: "confirmed" }));
    const lucid = {
      utxosByOutRef: async () => [initializationUtxo],
      wallet: () => ({ getUtxos: async () => [initializationUtxo] }),
      newTx: () => builder,
      awaitTxConfirmation,
    } as unknown as LucidEvolution;

    const result = await submitWalletInitialization(lucid, {
      compiledCode: rawValidatorCode,
      initializationRef,
      initialState: input.state,
      inventory: initialInventory(input),
    });
    expect(result.transactionId).toBe("cd".repeat(32));
    expect(submit).toHaveBeenCalledWith({ canonical: true });
    expect(awaitTxConfirmation).not.toHaveBeenCalled();
    await result.awaitConfirmation();
    expect(awaitTxConfirmation).toHaveBeenCalledWith(result.transactionId);
  });
});
