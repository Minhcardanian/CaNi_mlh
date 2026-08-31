import {
  CostModel,
  QueryContext,
  createConstructorContext,
  sampleContractAddress,
} from "@midnight-ntwrk/midnight-js-protocol/compact-runtime";
import {
  Contract,
  createPrivateState,
  nightPermitPrivateStateKey,
  pureCircuits,
  witnesses,
} from "@nightpermit/midnight-contract";
import { of } from "rxjs";
import { describe, expect, it, vi } from "vitest";
import {
  NightPermitAPI,
  joinNightPermit,
  type DeployedNightPermitContract,
  type NightPermitProviders,
} from "../src/index.js";

const contractSdk = vi.hoisted(() => ({ findDeployedContract: vi.fn() }));
vi.mock("@midnight-ntwrk/midnight-js-contracts", async (importOriginal) => ({
  ...await importOriginal<typeof import("@midnight-ntwrk/midnight-js-contracts")>(),
  findDeployedContract: contractSdk.findDeployedContract,
}));

const bytes = (value: number, length = 32) => new Uint8Array(length).fill(value);

describe("NightPermit approval API", () => {
  it("returns only public scalars derived from the exact transaction state", async () => {
    const secret = bytes(0x11);
    const contract = new Contract(witnesses);
    const initial = contract.initialState(
      createConstructorContext(createPrivateState(secret), "0".repeat(64)),
      bytes(0x41), bytes(0x42), bytes(0x43), bytes(0x44, 28), bytes(0x45),
      bytes(0x46, 28), bytes(0x47), 25_000_000n, bytes(0x48, 28),
      pureCircuits.reviewerKey(secret), pureCircuits.reviewerKey(bytes(0x22)),
    );
    const context = {
      currentPrivateState: initial.currentPrivateState,
      currentZswapLocalState: initial.currentZswapLocalState,
      costModel: CostModel.initialCostModel(),
      currentQueryContext: new QueryContext(initial.currentContractState.data, sampleContractAddress()),
    };
    const approved = contract.impureCircuits.approve(context).context.currentQueryContext.state;
    const contractAddress = "0".repeat(64);
    const observable = vi.fn(() => of({ data: approved } as never));
    const providers = {
      publicDataProvider: {
        queryContractState: vi.fn(async () => initial.currentContractState),
        contractStateObservable: observable,
      },
      privateStateProvider: {
        setContractAddress: vi.fn(),
        get: vi.fn(async (key) => key === nightPermitPrivateStateKey ? createPrivateState(secret) : null),
      },
    } as unknown as NightPermitProviders;
    const deployed = {
      deployTxData: { public: { contractAddress } },
      callTx: { approve: vi.fn(async () => ({ public: { txId: "ab".repeat(32) } })) },
    } as unknown as DeployedNightPermitContract;

    const result = await new NightPermitAPI(deployed, providers).approve();
    expect(result).toEqual({ transactionId: "ab".repeat(32), approvalCount: 1, authorized: false });
    expect(observable).toHaveBeenCalledWith(contractAddress, {
      type: "txId",
      txId: "ab".repeat(32),
      inclusive: true,
    });
    expect(Object.keys(result).sort()).toEqual(["approvalCount", "authorized", "transactionId"]);
  });

  it("reuses provisioned reviewer state without replacing it from caller input", async () => {
    const provisionedSecret = bytes(0x11);
    const differentSecret = bytes(0x22);
    const contract = new Contract(witnesses);
    const initial = contract.initialState(
      createConstructorContext(createPrivateState(provisionedSecret), "0".repeat(64)),
      bytes(0x41), bytes(0x42), bytes(0x43), bytes(0x44, 28), bytes(0x45),
      bytes(0x46, 28), bytes(0x47), 25_000_000n, bytes(0x48, 28),
      pureCircuits.reviewerKey(provisionedSecret), pureCircuits.reviewerKey(differentSecret),
    );
    const contractAddress = "10".repeat(32);
    const deployed = {
      deployTxData: { public: { contractAddress } },
      callTx: {},
    } as unknown as DeployedNightPermitContract;
    contractSdk.findDeployedContract.mockResolvedValueOnce(deployed);
    const get = vi.fn(async () => createPrivateState(provisionedSecret));
    const providers = {
      publicDataProvider: { queryContractState: vi.fn(async () => initial.currentContractState) },
      privateStateProvider: { setContractAddress: vi.fn(), get },
    } as unknown as NightPermitProviders;

    const api = await joinNightPermit(providers, contractAddress, differentSecret);
    expect(api.contractAddress).toBe(contractAddress);
    expect(get).toHaveBeenCalledOnce();
    const joinOptions = contractSdk.findDeployedContract.mock.calls[0]![1] as Record<string, unknown>;
    expect(joinOptions).not.toHaveProperty("initialPrivateState");
  });
});
