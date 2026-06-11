import { test } from "node:test";
import assert from "node:assert/strict";

process.env.DATABASE_URL = `./data/test-intent-${process.pid}.db`;

const { parseUpiDeeplink, parseBharatQr, fromCheckout } = await import("../src/services/intent.js");

test("parseUpiDeeplink — minimal", () => {
  const i = parseUpiDeeplink("upi://pay?pa=swiggy@hdfc&pn=Swiggy&am=500&cu=INR");
  assert.equal(i.payee.identifier, "swiggy@hdfc");
  assert.equal(i.payee.display_name, "Swiggy");
  assert.equal(i.amount.value, 500);
  assert.equal(i.channel, "qr");
});

test("parseUpiDeeplink — note + ref", () => {
  const i = parseUpiDeeplink("upi://pay?pa=x@y&am=100&cu=INR&tn=Coffee&tr=ORD123");
  assert.equal(i.metadata?.note, "Coffee");
  assert.equal(i.metadata?.txn_ref, "ORD123");
});

test("parseUpiDeeplink rejects non-INR", () => {
  assert.throws(() => parseUpiDeeplink("upi://pay?pa=x@y&am=10&cu=USD"));
});

test("parseUpiDeeplink rejects missing amount", () => {
  assert.throws(() => parseUpiDeeplink("upi://pay?pa=x@y&cu=INR"));
});

test("parseUpiDeeplink rejects non-UPI input", () => {
  assert.throws(() => parseUpiDeeplink("https://example.com/pay"));
});

test("fromCheckout maps merchant body", () => {
  const i = fromCheckout({ merchant: { vpa: "shop@hdfc", name: "Shop" }, amount_inr: 250, order_ref: "ORD-9" });
  assert.equal(i.payee.identifier, "shop@hdfc");
  assert.equal(i.amount.value, 250);
  assert.equal(i.channel, "checkout");
  assert.equal(i.metadata?.order_ref, "ORD-9");
});

test("parseBharatQr — minimal EMV string", () => {
  // Construct a minimal EMV: payload format 00 02 01, merchant template
  // 26 with sub-tag 01 = VPA, name 59 = "Acme", amount 54 = "500".
  const sub = tlv("01", "merchant@bank");
  const emv =
    tlv("00", "01") + // payload format
    tlv("01", "11") + // point-of-initiation
    tlv("26", sub) +
    tlv("52", "5411") + // mcc
    tlv("53", "356") + // INR
    tlv("54", "500") +
    tlv("59", "Acme") +
    tlv("60", "IN");
  const i = parseBharatQr(emv);
  assert.equal(i.payee.identifier, "merchant@bank");
  assert.equal(i.payee.display_name, "Acme");
  assert.equal(i.amount.value, 500);
});

function tlv(tag: string, value: string): string {
  const len = String(value.length).padStart(2, "0");
  return `${tag}${len}${value}`;
}
