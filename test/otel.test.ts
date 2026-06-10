import { test } from "node:test";
import assert from "node:assert/strict";

process.env.DATABASE_URL = `./data/test-otel-${process.pid}.db`;

const { startSpan, endSpan, withSpan, recentSpans, _resetSpans } = await import("../src/services/otel.ts");

test("span captures start/end timing and ok status", async () => {
  _resetSpans();
  const s = startSpan("op_a", undefined, { user_id: "u_o1" });
  await new Promise((r) => setTimeout(r, 5));
  endSpan(s, "ok");
  assert.ok(s.ended_at !== undefined);
  assert.equal(s.status, "ok");
  assert.equal(s.attributes.user_id, "u_o1");
});

test("child span inherits trace_id", () => {
  _resetSpans();
  const root = startSpan("root");
  const child = startSpan("child", root);
  assert.equal(child.trace_id, root.trace_id);
  assert.equal(child.parent_id, root.id);
});

test("withSpan captures error status on throw", async () => {
  _resetSpans();
  await assert.rejects(() => withSpan("bad", () => { throw new Error("boom"); }));
  const spans = recentSpans();
  const bad = spans.find((x) => x.name === "bad");
  assert.equal(bad?.status, "error");
  assert.equal(bad?.error, "boom");
});

test("recentSpans returns most-recent in insertion order", () => {
  _resetSpans();
  startSpan("a"); startSpan("b"); startSpan("c");
  const r = recentSpans(2);
  assert.equal(r.length, 2);
  assert.equal(r[1]?.name, "c");
});
