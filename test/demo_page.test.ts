import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

test("demo page exists and references core endpoints", () => {
  const html = readFileSync(resolve(process.cwd(), "src/public/index.html"), "utf8");
  assert.ok(html.includes("<title>StablePay Demo</title>"));
  assert.ok(html.includes("/v1/quote"));
  assert.ok(html.includes("/v1/settle"));
  assert.ok(html.includes("/v1/webhooks/offramp"));
  assert.ok(html.includes("user_demo_1"));
});
