// Cross-checks that the mobile-side parser (apps/mobile/src/upi.ts) and the
// backend parser (src/services/intent.ts) stay in lock-step on the common
// cases.  Both are deliberately tiny so this guard is the cheapest way to
// detect drift.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = process.cwd();

test("mobile and backend UPI parsers list the same allowed currency", () => {
  const backend = readFileSync(resolve(ROOT, "src/services/intent.ts"), "utf8");
  const mobile = readFileSync(resolve(ROOT, "apps/mobile/src/upi.ts"), "utf8");
  // Both must reject anything that isn't INR.
  assert.ok(backend.includes('cu !== "INR"'));
  assert.ok(mobile.includes('cu !== "INR"'));
});

test("mobile and backend UPI parsers expose 'pa' as required field", () => {
  const backend = readFileSync(resolve(ROOT, "src/services/intent.ts"), "utf8");
  const mobile = readFileSync(resolve(ROOT, "apps/mobile/src/upi.ts"), "utf8");
  assert.ok(backend.includes('"pa"') && backend.includes("payee VPA"));
  assert.ok(mobile.includes('"pa"') && mobile.includes("payee VPA"));
});

test("mobile parser uses the canonical upi://pay regex", () => {
  const mobile = readFileSync(resolve(ROOT, "apps/mobile/src/upi.ts"), "utf8");
  assert.match(mobile, /\^upi:\\\/\\\/pay\\\?\(\.\+\)\$/);
});
