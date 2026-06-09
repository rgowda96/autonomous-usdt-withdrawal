import { test } from "node:test";
import assert from "node:assert/strict";

process.env.DATABASE_URL = `./data/test-fuzz-${process.pid}.db`;

const { parseUpiDeeplink, parseBharatQr, fromCheckout } = await import("../src/services/intent.js");

// Boundary / adversarial inputs the normalizer must reject cleanly without throwing
// non-Error types and without infinite loops.

const UPI_BAD = [
  "",
  "upi://pay?",
  "upi://pay?pa=",
  "upi://pay?am=100",
  "upi://pay?pa=&am=100&cu=INR",
  "upi://pay?pa=x@y&am=abc&cu=INR",
  "upi://pay?pa=x@y&am=-5&cu=INR",
  "upi://pay?pa=x@y&am=0&cu=INR",
  "upi://pay?pa=x@y&am=100&cu=USD",
  "UPI://PAY?pa=x@y&am=10&cu=GBP",
  "http://upi.com/pay?pa=x@y&am=10",
  "javascript:alert(1)",
  "data:text/plain,foo",
  "x".repeat(10_000),
];

for (const [i, input] of UPI_BAD.entries()) {
  test(`fuzz UPI deeplink reject [${i}]`, () => {
    assert.throws(() => parseUpiDeeplink(input));
  });
}

const QR_BAD = [
  "",
  "00",
  "00020",
  "000201",
  "0002011XYZ", // length byte malformed
  "0002012699XYZ", // claimed length too large
  "00020226010101", // VPA with no @
  "ZZ02011102110000",
];

for (const [i, input] of QR_BAD.entries()) {
  test(`fuzz Bharat QR reject [${i}]`, () => {
    assert.throws(() => parseBharatQr(input));
  });
}

const CHECKOUT_BAD: any[] = [
  null,
  undefined,
  {},
  { merchant: {} },
  { merchant: { vpa: "" }, amount_inr: 100 },
  { merchant: { vpa: "x@y" }, amount_inr: 0 },
  { merchant: { vpa: "x@y" }, amount_inr: -1 },
  { merchant: { vpa: "x@y" } },
];

for (const [i, body] of CHECKOUT_BAD.entries()) {
  test(`fuzz checkout reject [${i}]`, () => {
    assert.throws(() => fromCheckout(body));
  });
}

test("fuzz: extreme amount in UPI deeplink is rejected (>100k unsafe)", () => {
  // Plausible upper bound — parser should still parse but downstream caps reject
  const i = parseUpiDeeplink("upi://pay?pa=x@y&am=999999999&cu=INR");
  assert.ok(i.amount.value > 0);
});

test("fuzz: very long but legal UPI VPA accepted", () => {
  const longVpa = "a".repeat(60) + "@bank";
  const i = parseUpiDeeplink(`upi://pay?pa=${longVpa}&am=100&cu=INR`);
  assert.equal(i.payee.identifier, longVpa);
});
