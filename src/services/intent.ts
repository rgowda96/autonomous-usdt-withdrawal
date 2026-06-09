// Intent normalizer: takes any of (UPI deeplink, merchant-checkout body,
// agent MCP call, raw VPA + amount) and emits a canonical PaymentIntent
// the rest of the system consumes uniformly.

import { z } from "zod";
import type { Channel } from "../types.js";

export const PaymentIntentSchema = z.object({
  intent_id: z.string().uuid().optional(),
  channel: z.enum(["qr", "checkout", "agent", "p2p", "bill"]),
  payee: z.object({
    type: z.enum(["vpa", "merchant_id", "biller", "wallet"]),
    identifier: z.string().min(3),
    display_name: z.string().optional(),
  }),
  amount: z.object({
    currency: z.literal("INR"),
    value: z.number().int().positive(),
  }),
  metadata: z.record(z.string(), z.union([z.string(), z.number()])).optional(),
});
export type PaymentIntent = z.infer<typeof PaymentIntentSchema>;

const UPI_DEEPLINK_RE = /^upi:\/\/pay\?(.+)$/i;

export function parseUpiDeeplink(s: string): PaymentIntent {
  const m = s.match(UPI_DEEPLINK_RE);
  if (!m) throw new Error("Not a UPI deeplink");
  const params = new URLSearchParams(m[1]!);
  const pa = params.get("pa");
  if (!pa) throw new Error("UPI deeplink missing 'pa' (payee VPA)");
  const am = params.get("am");
  const amountInr = am ? Math.round(parseFloat(am)) : 0;
  if (!amountInr || amountInr < 1) throw new Error("UPI deeplink missing or invalid amount (am)");
  const cu = (params.get("cu") ?? "INR").toUpperCase();
  if (cu !== "INR") throw new Error(`UPI currency ${cu} not supported (only INR)`);
  const pn = params.get("pn") ?? undefined;
  const tn = params.get("tn") ?? undefined;
  const tr = params.get("tr") ?? undefined;
  return {
    channel: "qr",
    payee: { type: "vpa", identifier: pa, display_name: pn },
    amount: { currency: "INR", value: amountInr },
    metadata: {
      ...(tn ? { note: tn } : {}),
      ...(tr ? { txn_ref: tr } : {}),
    },
  };
}

// Bharat QR / EMV string parser (subset for static + dynamic UPI).
// Reads TLV (tag-length-value) fields. The UPI VPA lives under tag 26 (or 27/28)
// with sub-tag "01" for the VPA itself, and the amount under tag "54".
export function parseBharatQr(s: string): PaymentIntent {
  if (!/^00020[12]/.test(s)) throw new Error("Not an EMV/Bharat QR");
  const fields = readEmv(s);
  // The merchant account information templates are 26..51. We look for the one
  // containing a "01" sub-tag whose value looks like a VPA.
  let vpa: string | undefined;
  let pn: string | undefined;
  for (let tag = 26; tag <= 51; tag++) {
    const raw = fields[String(tag).padStart(2, "0")];
    if (!raw) continue;
    const sub = readEmv(raw);
    const candidate = sub["01"];
    if (candidate && candidate.includes("@")) {
      vpa = candidate;
      break;
    }
  }
  if (!vpa) throw new Error("Bharat QR has no UPI VPA");
  pn = fields["59"];
  const am = fields["54"];
  const amountInr = am ? Math.round(parseFloat(am)) : 0;
  if (!amountInr || amountInr < 1) throw new Error("Bharat QR missing or invalid amount (54)");
  return {
    channel: "qr",
    payee: { type: "vpa", identifier: vpa, display_name: pn },
    amount: { currency: "INR", value: amountInr },
  };
}

function readEmv(s: string): Record<string, string> {
  const out: Record<string, string> = {};
  let i = 0;
  while (i + 4 <= s.length) {
    const tag = s.slice(i, i + 2);
    const lenStr = s.slice(i + 2, i + 4);
    const len = parseInt(lenStr, 10);
    if (!Number.isFinite(len) || len < 0) break;
    const value = s.slice(i + 4, i + 4 + len);
    if (value.length !== len) break;
    out[tag] = value;
    i += 4 + len;
  }
  return out;
}

export type CheckoutBody = {
  merchant: { vpa: string; name?: string };
  amount_inr: number;
  order_ref?: string;
};

export function fromCheckout(body: CheckoutBody): PaymentIntent {
  if (!body?.merchant?.vpa) throw new Error("checkout missing merchant.vpa");
  if (!body?.amount_inr || body.amount_inr < 1) throw new Error("checkout missing amount_inr");
  return {
    channel: "checkout",
    payee: { type: "vpa", identifier: body.merchant.vpa, display_name: body.merchant.name },
    amount: { currency: "INR", value: Math.round(body.amount_inr) },
    metadata: body.order_ref ? { order_ref: body.order_ref } : undefined,
  };
}

export function intentChannel(intent: PaymentIntent): Channel {
  return intent.channel;
}
