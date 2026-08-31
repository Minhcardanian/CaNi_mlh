import {
  applyParamsToScript,
  type OutRef,
  type Script,
  validatorToScriptHash,
} from "@lucid-evolution/lucid";
import { assertPlutusV3, encodeOutputReference } from "./data.js";

export const STATE_TOKEN_NAME = "4e505f5354415445";

export function parameterizeValidator(compiledCode: string, initializationRef: OutRef): Script {
  if (!/^[0-9a-f]{64}$/.test(initializationRef.txHash)) {
    throw new TypeError("initialization transaction hash must contain 32 lowercase hexadecimal bytes");
  }
  if (!Number.isInteger(initializationRef.outputIndex) || initializationRef.outputIndex < 0) {
    throw new TypeError("initialization output index must be a non-negative integer");
  }
  const validator: Script = {
    type: "PlutusV3",
    script: applyParamsToScript(compiledCode, [
      encodeOutputReference(initializationRef.txHash, initializationRef.outputIndex),
    ]),
  };
  assertPlutusV3(validator);
  return validator;
}

export function validatorHash(validator: Script): string {
  assertPlutusV3(validator);
  return validatorToScriptHash(validator);
}
