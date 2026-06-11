import { test } from "node:test";
import assert from "node:assert/strict";

process.env.DATABASE_URL = `./data/test-metrics-${process.pid}.db`;

const { _resetMetrics, incCounter, observeHistogram, renderMetrics } = await import("../src/services/metrics.js");

test("counter renders in Prometheus format", () => {
  _resetMetrics();
  incCounter("requests_total", { method: "GET", route: "/x" });
  incCounter("requests_total", { method: "GET", route: "/x" });
  const out = renderMetrics();
  assert.ok(out.includes("# TYPE requests_total counter"));
  assert.match(out, /requests_total\{method="GET",route="\/x"\} 2/);
});

test("histogram renders buckets + _sum + _count", () => {
  _resetMetrics();
  observeHistogram("http_request_duration_ms", { route: "/v1/quote" }, 12);
  observeHistogram("http_request_duration_ms", { route: "/v1/quote" }, 80);
  const out = renderMetrics();
  assert.ok(out.includes("# TYPE http_request_duration_ms histogram"));
  assert.match(out, /http_request_duration_ms_bucket\{route="\/v1\/quote",le="25"\} 1/);
  assert.match(out, /http_request_duration_ms_bucket\{route="\/v1\/quote",le="100"\} 2/);
  assert.match(out, /http_request_duration_ms_sum\{route="\/v1\/quote"\} 92/);
  assert.match(out, /http_request_duration_ms_count\{route="\/v1\/quote"\} 2/);
});

test("multiple metrics in one render", () => {
  _resetMetrics();
  incCounter("a_total", {});
  incCounter("b_total", { x: "y" }, 5);
  observeHistogram("c_duration", {}, 30);
  const out = renderMetrics();
  assert.ok(out.includes("a_total"));
  assert.ok(out.includes("b_total"));
  assert.ok(out.includes("c_duration_count"));
});
