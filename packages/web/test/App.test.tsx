// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "../src/App.js";
import type { AppRuntime } from "../src/runtime.js";

afterEach(cleanup);

describe("NightPermit application", () => {
  it("renders the product flow and advances only from runtime confirmations", async () => {
    const permit = {
      version: 1 as const,
      permitBytes: "01",
      permitHash: "02".repeat(32),
      signature: "03".repeat(64),
      relayPublicKey: "04".repeat(32),
    };
    const runtime: AppRuntime = {
      connectMidnight: vi.fn(async () => ({ name: "Lace", network: "Midnight Preprod" as const })),
      connectCardano: vi.fn(async () => ({
        name: "Eternl",
        network: "Cardano Preview" as const,
        address: "addr_test1_example",
      })),
      approve: vi.fn(async () => ({
        transactionId: "11".repeat(32),
        approvalCount: 2 as const,
        authorized: true,
      })),
      getPermit: vi.fn(async () => ({ permit, correlationId: "correlation-01" })),
      claim: vi.fn(async () => ({
        transactionId: "12".repeat(32),
        awaitConfirmation: async () => undefined,
      })),
    };
    render(<App runtime={runtime} />);
    expect(screen.getByRole("heading", { name: /release one milestone/i })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Connect Midnight" }));
    await screen.findByText("Lace");
    fireEvent.click(screen.getByRole("button", { name: "Connect Cardano" }));
    await screen.findByRole("heading", { name: "Approve without publishing identity" });

    fireEvent.click(screen.getByRole("button", { name: "Review and approve on Midnight" }));
    await screen.findByRole("heading", { name: "Claim the exact tranche" });
    expect(screen.getByText("2 / 2")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Get signed permit" }));
    await screen.findByText("Present");
    fireEvent.click(screen.getByRole("button", { name: "Review and claim on Cardano" }));
    await screen.findByRole("heading", { name: "Milestone paid once" });
    await waitFor(() => expect(screen.getAllByText("Confirmed").length).toBeGreaterThan(0));
    expect(runtime.claim).toHaveBeenCalledWith(permit);
  });

  it("shows a deterministic safe error without advancing", async () => {
    const runtime = {
      connectMidnight: vi.fn(async () => { throw { code: "NP_WEB_MIDNIGHT_WALLET_MISSING" }; }),
    } as unknown as AppRuntime;
    render(<App runtime={runtime} />);
    fireEvent.click(screen.getByRole("button", { name: "Connect Midnight" }));
    expect((await screen.findByRole("alert")).textContent).toContain("Install or enable a compatible Midnight Lace wallet");
    expect(screen.getByRole("heading", { name: "Connect the two sides" })).toBeTruthy();
  });
});
