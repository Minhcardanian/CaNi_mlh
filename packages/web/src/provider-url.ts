import { WebFlowError } from "./errors.js";

export function secureProviderEndpoint(value: string, websocket = false): string {
  const url = new URL(value);
  const local = url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "[::1]";
  const secure = websocket ? url.protocol === "wss:" : url.protocol === "https:";
  const localProtocol = websocket ? url.protocol === "ws:" : url.protocol === "http:";
  if (url.username || url.password || url.hash || (!secure && !(local && localProtocol))) {
    throw new WebFlowError("NP_WEB_RUNTIME_NOT_CONFIGURED");
  }
  return url.href;
}
