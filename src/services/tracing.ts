// Lightweight correlation-id middleware. Each request gets a stable
// x-correlation-id that downstream logs include for traceability.
// Real OpenTelemetry SDK integration in a follow-up (needs OTEL_EXPORTER_OTLP_ENDPOINT).

import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { incCounter, observeHistogram } from "./metrics.js";

const HEADER = "x-correlation-id";

export function installTracing(app: FastifyInstance) {
  app.addHook("onRequest", async (req, reply) => {
    const incoming = req.headers[HEADER];
    const cid = (Array.isArray(incoming) ? incoming[0] : incoming) ?? randomUUID();
    (req as any).cid = cid;
    reply.header(HEADER, cid);
    (req as any).__startTime = Date.now();
  });
  app.addHook("onResponse", async (req, reply) => {
    const dur = Date.now() - ((req as any).__startTime ?? Date.now());
    const route = (req as any).routeOptions?.url ?? (req as any).routerPath ?? req.url;
    const code = String(reply.statusCode);
    incCounter("http_requests_total", { method: req.method, route, code });
    observeHistogram("http_request_duration_ms", { method: req.method, route }, dur);
  });
}
