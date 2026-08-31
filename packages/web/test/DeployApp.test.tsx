// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DeployApp } from "../src/DeployApp.js";
import type { DeploymentRuntime } from "../src/deployment-runtime.js";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function publicPolicy(): string {
  return JSON.stringify({
    policyId: "10".repeat(32),
    escrowId: "11".repeat(32),
    milestoneId: "12".repeat(32),
    beneficiaryPkh: "13".repeat(28),
    actionId: "14".repeat(32),
    assetPolicyId: "15".repeat(28),
    assetName: "16".repeat(4),
    amount: "25000000",
    reviewerOnePublicKey: "17".repeat(32),
    reviewerTwoPublicKey: "18".repeat(32),
    relayKeyId: "19".repeat(32),
    relayPublicKey: "20".repeat(32),
  });
}

describe("deployment ceremony", () => {
  it("shows elapsed time and a single-shot boundary during wallet work", async () => {
    vi.useFakeTimers();
    let resolveConnection!: (wallet: { name: string; network: "Midnight Preprod" }) => void;
    const runtime = {
      connectMidnight: vi.fn(() => new Promise((resolve) => { resolveConnection = resolve; })),
    } as unknown as DeploymentRuntime;
    render(<DeployApp loadRuntime={async () => runtime} />);
    fireEvent.click(screen.getByRole("button", { name: "Connect Midnight" }));
    expect(screen.getByRole("status").textContent).toContain("does not retry it automatically");
    await act(async () => { vi.advanceTimersByTime(1_000); });
    expect(screen.getByRole("status").textContent).toContain("1.0s elapsed");
    await act(async () => { resolveConnection({ name: "Lace", network: "Midnight Preprod" }); });
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("orders confirmed chain operations and renders only public artifacts", async () => {
    const calls: string[] = [];
    const deployMidnight = vi.fn(async () => {
      calls.push("midnight");
      return { contractId: "22".repeat(32), transactionId: "23".repeat(32), blockHeight: 42 };
    });
    const initializeCardano = vi.fn(async () => {
      calls.push("cardano-submit");
      return {
        transactionId: "24".repeat(32),
        awaitConfirmation: async () => { calls.push("cardano-confirm"); },
      };
    });
    const runtime: DeploymentRuntime = {
      connectMidnight: async () => ({ name: "Lace", network: "Midnight Preprod" }),
      connectCardano: async () => ({ name: "Eternl", network: "Cardano Preview", address: "addr_test1_operator" }),
      initializationCandidates: async () => [{ txHash: "21".repeat(32), outputIndex: 0, lovelace: "10000000", assetCount: 2 }],
      prepare: vi.fn(async () => ({ validatorHash: "25".repeat(28), validatorAddress: "addr_test1_validator" })),
      deployMidnight,
      initializeCardano,
      artifacts: async () => ({
        browserEnvironment: { VITE_MIDNIGHT_CONTRACT_ID: "22".repeat(32) },
        relayEnvironment: { MIDNIGHT_CONTRACT_ID: "22".repeat(32) },
        relayPolicy: { version: 1, policies: [] },
      }),
    };
    render(<DeployApp loadRuntime={async () => runtime} />);

    fireEvent.click(screen.getByRole("button", { name: "Connect Midnight" }));
    await screen.findByText("Lace");
    fireEvent.click(screen.getByRole("button", { name: "Connect Cardano" }));
    await screen.findByText("Eternl");
    fireEvent.click(screen.getByRole("button", { name: "Review public policy" }));
    await screen.findByRole("heading", { name: "Prepare the cross-chain binding" });
    fireEvent.change(screen.getByLabelText("Public policy JSON"), { target: { value: publicPolicy() } });
    fireEvent.click(screen.getByRole("button", { name: "Validate and prepare" }));
    await screen.findByRole("heading", { name: "Deploy the private approval contract" });

    const password = "Correct-Horse-2026";
    const secret = "17".repeat(32);
    fireEvent.change(screen.getByLabelText("Encrypted storage password"), { target: { value: password } });
    fireEvent.change(screen.getByLabelText("Deploying reviewer secret"), { target: { value: secret } });
    fireEvent.click(screen.getByRole("button", { name: "Deploy with Midnight wallet" }));
    await screen.findByRole("heading", { name: "Initialize the public escrow state" });
    fireEvent.click(screen.getByRole("button", { name: "Initialize with Cardano wallet" }));
    await screen.findByRole("heading", { name: "Deployment confirmed on both chains" });

    expect(calls).toEqual(["midnight", "cardano-submit", "cardano-confirm"]);
    expect(deployMidnight).toHaveBeenCalledWith({ privateStoragePassword: password, reviewerSecretHex: secret });
    expect(initializeCardano).toHaveBeenCalledWith(5_000_000n);
    expect(document.body.textContent).toContain("VITE_MIDNIGHT_CONTRACT_ID");
    expect(document.body.textContent).not.toContain(password);
    expect(document.body.textContent).not.toContain(secret);
  });
});
