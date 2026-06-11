import { randomUUID } from "node:crypto";
import { db, now } from "../db/index.js";
import { getReferenceRate } from "./rates.js";
import { quoteUsdPurchase, type FxQuote } from "./fx.js";
import { disposeFifo } from "./cost_basis.js";
import { incCounter } from "./metrics.js";
import { notify } from "./session_keys.js";

export type OnlinePurchase = {
  id: string;
  user_id: string;
  merchant: string;
  merchant_country: string | null;
  usd_amount: string;
  mid_market_inr_per_usd: string;
  our_inr_per_usd: string;
  our_inr_total: number;
  our_fee_inr: number;
  redotpay_inr_total: number;
  saved_inr: number;
  usdc_debited: string;
  status: string;
  network_ref: string | null;
  created_at: number;
  updated_at: number;
};

export type OnlineQuote = FxQuote & {
  usdc_required: string;       // USDC units needed (== usd_amount, 1:1)
  tds_inr: number;             // §194S on the USDC disposal
};

// Quote a USD online purchase. Shows mid-market, our rate, the disclosed fee,
// and the RedotPay comparison so the user sees exactly what they save.
export function quoteOnline(usdAmount: number): OnlineQuote {
  const fx = quoteUsdPurchase(usdAmount);
  // USDC is 1:1 with USD; the user spends `usdAmount` USDC.
  const usdcRequired = usdAmount.toFixed(6);
  // §194S 1% TDS applies on the crypto disposal (the INR value parted with).
  const tdsInr = Math.ceil(fx.our_inr_total * 0.01);
  return { ...fx, usdc_required: usdcRequired, tds_inr: tdsInr };
}

export type ChargeRequest = {
  idempotency_key: string;
  user_id: string;
  merchant: string;
  merchant_country?: string;
  usd_amount: number;
};

export type ChargeResult = {
  id: string;
  status: string;
  usd_amount: number;
  our_inr_total: number;
  saved_inr: number;
  network_ref: string;
};

export function chargeOnline(req: ChargeRequest): ChargeResult {
  // Idempotency
  const existing = db().prepare(
    `SELECT id, status, usd_amount, our_inr_total, saved_inr, network_ref FROM online_purchases WHERE idempotency_key = ?`
  ).get(req.idempotency_key) as any;
  if (existing) {
    return {
      id: existing.id,
      status: existing.status,
      usd_amount: Number(existing.usd_amount),
      our_inr_total: existing.our_inr_total,
      saved_inr: existing.saved_inr,
      network_ref: existing.network_ref,
    };
  }

  const q = quoteOnline(req.usd_amount);
  const usdcNeeded = Number(q.usdc_required);

  const id = `op_${randomUUID()}`;
  const networkRef = `auth_${randomUUID().replace(/-/g, "").slice(0, 18)}`;
  const t = now();

  // Pre-flight balance check OUTSIDE the transaction so a DECLINED audit row
  // survives (a throw inside transaction() rolls back everything).
  const bal = db().prepare(
    `SELECT amount FROM balances WHERE user_id = ? AND asset = 'USDC' AND chain = 'base'`
  ).get(req.user_id) as { amount: string } | undefined;
  const have = bal ? Number(bal.amount) : 0;
  if (have < usdcNeeded) {
    db().prepare(
      `INSERT INTO online_purchases (id, user_id, idempotency_key, merchant, merchant_country,
        usd_amount, mid_market_inr_per_usd, our_inr_per_usd, our_inr_total, our_fee_inr,
        redotpay_inr_total, saved_inr, usdc_debited, status, network_ref, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'DECLINED', ?, ?, ?)`
    ).run(
      id, req.user_id, req.idempotency_key, req.merchant, req.merchant_country ?? null,
      String(req.usd_amount), String(q.mid_market_inr_per_usd), String(q.our_inr_per_usd),
      q.our_inr_total, q.our_fee_inr, q.redotpay_inr_total, q.you_save_inr,
      "0", networkRef, t, t,
    );
    throw new Error("INSUFFICIENT_USDC");
  }

  db().transaction(() => {
    // Re-read inside the transaction to avoid a TOCTOU debit race.
    const cur = db().prepare(
      `SELECT amount FROM balances WHERE user_id = ? AND asset = 'USDC' AND chain = 'base'`
    ).get(req.user_id) as { amount: string };
    const curHave = Number(cur.amount);
    if (curHave < usdcNeeded) throw new Error("INSUFFICIENT_USDC");
    db().prepare(
      `UPDATE balances SET amount = ?, updated_at = ? WHERE user_id = ? AND asset = 'USDC' AND chain = 'base'`
    ).run((curHave - usdcNeeded).toFixed(6), t, req.user_id);

    db().prepare(
      `INSERT INTO online_purchases (id, user_id, idempotency_key, merchant, merchant_country,
        usd_amount, mid_market_inr_per_usd, our_inr_per_usd, our_inr_total, our_fee_inr,
        redotpay_inr_total, saved_inr, usdc_debited, status, network_ref, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'CAPTURED', ?, ?, ?)`
    ).run(
      id, req.user_id, req.idempotency_key, req.merchant, req.merchant_country ?? null,
      String(req.usd_amount), String(q.mid_market_inr_per_usd), String(q.our_inr_per_usd),
      q.our_inr_total, q.our_fee_inr, q.redotpay_inr_total, q.you_save_inr,
      usdcNeeded.toFixed(6), networkRef, t, t,
    );
  })();

  // FIFO cost-basis disposal on the USDC spent (proceeds = INR value).
  try {
    disposeFifo({
      user_id: req.user_id,
      asset: "USDC",
      chain: "base",
      quantity: usdcNeeded.toFixed(6),
      proceeds_inr: q.our_inr_total,
      transaction_id: id,
    });
  } catch { /* informational */ }

  incCounter("stablepay_online_purchase_total", { merchant_country: req.merchant_country ?? "XX" });
  incCounter("stablepay_online_saved_inr_total", {}, q.you_save_inr);

  notify({
    user_id: req.user_id,
    kind: "online_purchase",
    title: `Paid $${req.usd_amount} at ${req.merchant}`,
    body: `₹${q.our_inr_total} · saved ₹${q.you_save_inr} vs RedotPay`,
    ref_id: id,
  });

  return {
    id,
    status: "CAPTURED",
    usd_amount: req.usd_amount,
    our_inr_total: q.our_inr_total,
    saved_inr: q.you_save_inr,
    network_ref: networkRef,
  };
}

export function listOnlinePurchases(userId: string): OnlinePurchase[] {
  return db().prepare(
    `SELECT * FROM online_purchases WHERE user_id = ? ORDER BY created_at DESC LIMIT 50`
  ).all(userId) as OnlinePurchase[];
}

export function totalSavedVsRedotpay(userId: string): { lifetime_saved_inr: number; purchase_count: number } {
  const r = db().prepare(
    `SELECT COALESCE(SUM(saved_inr), 0) AS saved, COUNT(*) AS n
     FROM online_purchases WHERE user_id = ? AND status IN ('CAPTURED','SETTLED')`
  ).get(userId) as { saved: number; n: number };
  return { lifetime_saved_inr: r.saved, purchase_count: r.n };
}
