import { CompiledContract } from "@midnight-ntwrk/midnight-js-protocol/compact-js";
import { Contract } from "./managed/nightpermit/contract/index.js";
import { witnesses, type NightPermitPrivateState } from "./witnesses.js";

export * from "./managed/nightpermit/contract/index.js";
export {
  createPrivateState,
  nightPermitPrivateStateKey,
  witnesses,
  type NightPermitPrivateState,
} from "./witnesses.js";

export const compiledContract = CompiledContract.make<Contract<NightPermitPrivateState>>(
  "NightPermit",
  Contract<NightPermitPrivateState>,
).pipe(
  CompiledContract.withWitnesses(witnesses),
  CompiledContract.withCompiledFileAssets("./managed/nightpermit"),
);
