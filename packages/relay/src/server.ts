import { randomUUID } from "node:crypto";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { asRelayError, RelayError } from "./errors.js";
import type { RelayLogger } from "./logger.js";
import { jsonLogger } from "./logger.js";
import type { PermitService } from "./service.js";

const MAX_REQUEST_BYTES = 2_048;
const CORRELATION_PATTERN = /^[A-Za-z0-9_-]{8,64}$/;

export function createRelayServer(service: PermitService, logger: RelayLogger = jsonLogger): Server {
  return createServer((request, response) => {
    void route(service, logger, request, response);
  });
}

async function route(
  service: PermitService,
  logger: RelayLogger,
  request: IncomingMessage,
  response: ServerResponse,
): Promise<void> {
  const started = performance.now();
  const correlationId = correlation(request);
  response.setHeader("content-type", "application/json; charset=utf-8");
  response.setHeader("x-correlation-id", correlationId);
  try {
    const url = new URL(request.url ?? "/", "http://relay.local");
    if (request.method === "GET" && url.pathname === "/health") {
      send(response, 200, { status: "ok", service: "nightpermit-relay", version: 1 });
    } else if (request.method === "POST" && url.pathname === "/v1/permits") {
      const permitRequest = service.parseRequest(await readJson(request));
      send(response, 200, { correlationId, permit: await service.issue(permitRequest) });
    } else if (request.method === "GET" && url.pathname.startsWith("/v1/permits/")) {
      const transactionId = decodeURIComponent(url.pathname.slice("/v1/permits/".length));
      const permitRequest = service.parseRequest({ midnightTxId: transactionId });
      send(response, 200, { correlationId, permit: await service.get(permitRequest.midnightTxId) });
    } else {
      throw new RelayError("NP_RELAY_PERMIT_NOT_FOUND", "route was not found", 404);
    }
    logger.write({
      level: "info",
      event: "relay_request_completed",
      correlationId,
      elapsedMs: Math.round(performance.now() - started),
    });
  } catch (error) {
    const relayError = asRelayError(error);
    send(response, relayError.httpStatus, {
      correlationId,
      error: { code: relayError.code, message: relayError.message },
    });
    logger.write({
      level: "error",
      event: "relay_request_failed",
      correlationId,
      code: relayError.code,
      elapsedMs: Math.round(performance.now() - started),
    });
  }
}

async function readJson(request: IncomingMessage): Promise<unknown> {
  const chunks: Uint8Array[] = [];
  let length = 0;
  for await (const chunk of request) {
    const bytes = typeof chunk === "string" ? new TextEncoder().encode(chunk) : chunk;
    length += bytes.length;
    if (length > MAX_REQUEST_BYTES) {
      throw new RelayError("NP_RELAY_BAD_REQUEST", "request body exceeds 2048 bytes", 413);
    }
    chunks.push(bytes);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch (error) {
    throw new RelayError("NP_RELAY_BAD_REQUEST", "request body must contain valid JSON", 400, {
      cause: error,
    });
  }
}

function correlation(request: IncomingMessage): string {
  const supplied = request.headers["x-correlation-id"];
  return typeof supplied === "string" && CORRELATION_PATTERN.test(supplied) ? supplied : randomUUID();
}

function send(response: ServerResponse, status: number, body: unknown): void {
  response.statusCode = status;
  response.end(JSON.stringify(body));
}
