import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

process.env.DATABASE_URL = `./data/test-fx-${process.pid}.db`;
process.env.ONLINE_SPREAD_BPS = "60";
process.env.REDOTPAY_EFFECTIVE_HAIRCUT_BPS = "1150";

const { db, now } = await import("../src/db/index.ts");
const { quoteUsdPurchase } = await import("../src/services/fx.ts");
const { quoteOnline, chargeOnline, totalSavedVsRedotpay, listOnlinePurchases } = await import("../src/services/online_purchase.ts");
const { _resetRateCache } = await import("../src/services/rates.ts");

function reset() {
  db().exec(`
    DELETE FROM online_purchases;
    DELETE FROM realized_gains;
    DELETE FROM cost_basis_lots;
    DELETE FROM notifications;
    DELETE FROM balances;
    DELETE FROM users;
  `);
}
function seed(id: string, usdc = "1000.000000") {
  db().prepare(`INSERT OR IGNORE INTO users (id, created_at, kyc_status) VALUES (?, ?, ?)`).run(id, now(), "approved");
  db().prepare(`INSERT INTO balances (user_id, asset, chain, amount, updated_at) VALUES (?, 'USDC', 'base', ?, ?)`)
    .run(id, usdc, now());
}

test("FX quote beats RedotPay materially", () => {
  _resetRateCache(); // fall back to 95 mid-market
  const q = quoteUsdPurchase(100);
  // Mid ~95, our spread 60bps, RedotPay haircut 1150bps
  assert.ok(q.mid_market_inr_per_usd > 90 && q.mid_market_inr_per_usd < 100);
  assert.ok(q.our_inr_per_usd > q.redotpay_inr_per_usd, "our rate beats RedotPay");
  assert.ok(q.you_save_inr > 0, "user saves money");
  // RedotPay ~84/$, ours ~94.4/$ -> savings should be ~10% of the redot total
  assert.ok(q.you_save_pct > 8 && q.you_save_pct < 13, `save pct ${q.you_save_pct}`);
});

test("online quote includes TDS + usdc_required", () => {
  _resetRateCache();
  const q = quoteOnline(10);
  assert.equal(q.usdc_required, "10.000000");
  assert.ok(q.tds_inr >= Math.floor(q.our_inr_total * 0.01));
});

test("charge debits USDC and records savings", () => {
  reset();
  _resetRateCache();
  seed("u_fx1", "1000.000000");
  const r = chargeOnline({
    idempotency_key: randomUUID(),
    user_id: "u_fx1",
    merchant: "Amazon US",
    merchant_country: "US",
    usd_amount: 50,
  });
  assert.equal(r.status, "CAPTURED");
  assert.ok(r.saved_inr > 0);

  const bal = db().prepare(`SELECT amount FROM balances WHERE user_id = ? AND asset = 'USDC'`).get("u_fx1") as any;
  assert.equal(Number(bal.amount), 950); // 1000 - 50 USDC

  const totals = totalSavedVsRedotpay("u_fx1");
  assert.equal(totals.purchase_count, 1);
  assert.equal(totals.lifetime_saved_inr, r.saved_inr);
});

test("charge is idempotent", () => {
  reset();
  _resetRateCache();
  seed("u_fx2");
  const idem = randomUUID();
  const a = chargeOnline({ idempotency_key: idem, user_id: "u_fx2", merchant: "AWS", usd_amount: 20 });
  const b = chargeOnline({ idempotency_key: idem, user_id: "u_fx2", merchant: "AWS", usd_amount: 20 });
  assert.equal(a.id, b.id);
  // Only debited once
  const bal = db().prepare(`SELECT amount FROM balances WHERE user_id = ? AND asset = 'USDC'`).get("u_fx2") as any;
  assert.equal(Number(bal.amount), 980);
});

test("charge declines on insufficient USDC", () => {
  reset();
  _resetRateCache();
  seed("u_fx3", "5.000000");
  assert.throws(() => chargeOnline({
    idempotency_key: randomUUID(),
    user_id: "u_fx3",
    merchant: "Steam",
    usd_amount: 50,
  }), /INSUFFICIENT_USDC/);
  // A DECLINED row is recorded for the audit trail
  const rows = listOnlinePurchases("u_fx3");
  assert.equal(rows.length, 1);
  assert.equal(rows[0]?.status, "DECLINED");
});

test("usd_amount must be positive", () => {
  assert.throws(() => quoteUsdPurchase(0));
  assert.throws(() => quoteUsdPurchase(-5));
});
