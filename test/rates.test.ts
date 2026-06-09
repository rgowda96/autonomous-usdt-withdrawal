import { test } from "node:test";
import assert from "node:assert/strict";

process.env.DATABASE_URL = `./data/test-rates-${process.pid}.db`;

const { getReferenceRate, quoteRate, _resetRateCache } = await import("../src/services/rates.js");

test("getReferenceRate returns fallback when cache empty", () => {
  _resetRateCache();
  const usdc = getReferenceRate("USDC");
  assert.ok(usdc > 0, "USDC rate positive");
  assert.ok(usdc > 50 && usdc < 200, "USDC plausible vs INR");
});

test("INR_CREDIT always 1.0", () => {
  _resetRateCache();
  assert.equal(getReferenceRate("INR_CREDIT"), 1.0);
});

test("quoteRate applies spread bps", () => {
  _resetRateCache();
  const r = getReferenceRate("USDC");
  const q = quoteRate("USDC", 100); // 1%
  assert.ok(Math.abs(q - r * 0.99) < 1e-6);
});
