// Minimal OpenTelemetry-shaped tracing facade. Real OTel SDK lands when
// OTEL_EXPORTER_OTLP_ENDPOINT is set (env-gated). v0 provides a no-op
// implementation so service code can call span/withSpan today and the
// real exporter swaps in later without changes.

import { randomUUID } from "node:crypto";

export type SpanLike = {
  id: string;
  trace_id: string;
  parent_id?: string;
  name: string;
  started_at: number;
  ended_at?: number;
  attributes: Record<string, string | number | boolean>;
  status: "ok" | "error";
  error?: string;
};

const SPANS: SpanLike[] = [];
const MAX_SPANS = 1000;

export function startSpan(name: string, parent?: SpanLike, attributes: Record<string, string | number | boolean> = {}): SpanLike {
  const span: SpanLike = {
    id: randomUUID(),
    trace_id: parent?.trace_id ?? randomUUID(),
    parent_id: parent?.id,
    name,
    started_at: Date.now(),
    attributes,
    status: "ok",
  };
  SPANS.push(span);
  if (SPANS.length > MAX_SPANS) SPANS.splice(0, SPANS.length - MAX_SPANS);
  return span;
}

export function endSpan(span: SpanLike, status: "ok" | "error" = "ok", error?: string) {
  span.ended_at = Date.now();
  span.status = status;
  if (error) span.error = error;
}

export async function withSpan<T>(name: string, fn: (span: SpanLike) => Promise<T> | T, parent?: SpanLike): Promise<T> {
  const span = startSpan(name, parent);
  try {
    const r = await fn(span);
    endSpan(span, "ok");
    return r;
  } catch (e: any) {
    endSpan(span, "error", e?.message ?? String(e));
    throw e;
  }
}

// Inspection (used by /debug/spans + future OTLP exporter)
export function recentSpans(limit = 100): SpanLike[] {
  return SPANS.slice(-limit);
}

export function _resetSpans() { SPANS.length = 0; }
