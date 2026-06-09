import { test } from "node:test";
import assert from "node:assert/strict";

process.env.DATABASE_URL = `./data/test-cb2-${process.pid}.db`;

const { db, now } = await import("../src/db/index.js");
const { recordAcquisition, disposeFifo, estimateCgTax, totalRealizedGain } = await import("../src/services/cost_basis.js");

function reset() {
  db().exec(`DELETE FROM realized_gains; DELETE FROM cost_basis_lots; DELETE FROM users;`);
}
function seed(id: string) {
  db().prepare(`INSERT OR IGNORE INTO users (id, created_at, kyc_status) VALUES (?, ?, ?)`).run(id, now(), "approved");
}

test("FIFO consumes oldest lot first", () => {
  reset();
  seed("u_cb_1");
  // Acquired 100 USDC at ₹95, then 100 USDC at ₹98
  recordAcquisition({ user_id: "u_cb_1", asset: "USDC", chain: "base", quantity: "100", cost_inr_per_unit: "95", acquired_at: 100 });
  recordAcquisition({ user_id: "u_cb_1", asset: "USDC", chain: "base", quantity: "100", cost_inr_per_unit: "98", acquired_at: 200 });

  // Dispose 50 USDC for 5000 INR (₹100/unit) -- all from lot 1, cost basis = 50*95 = 4750, gain = 250
  const r = disposeFifo({ user_id: "u_cb_1", asset: "USDC", chain: "base", quantity: "50", proceeds_inr: 5000 });
  assert.equal(r.cost_basis_inr, 4750);
  assert.equal(r.gain_inr, 250);
});

test("FIFO spans multiple lots when needed", () => {
  reset();
  seed("u_cb_2");
  recordAcquisition({ user_id: "u_cb_2", asset: "USDC", chain: "base", quantity: "100", cost_inr_per_unit: "95", acquired_at: 100 });
  recordAcquisition({ user_id: "u_cb_2", asset: "USDC", chain: "base", quantity: "100", cost_inr_per_unit: "98", acquired_at: 200 });

  // Dispose 150 USDC: 100 from lot1 (9500) + 50 from lot2 (4900) = 14400 cost basis
  const r = disposeFifo({ user_id: "u_cb_2", asset: "USDC", chain: "base", quantity: "150", proceeds_inr: 15000 });
  assert.equal(r.cost_basis_inr, 14400);
  assert.equal(r.gain_inr, 600);

  // Lot 2 should have 50 remaining
  const lot2 = db().prepare(`SELECT remaining_quantity FROM cost_basis_lots WHERE acquired_at = 200`).get() as any;
  assert.equal(parseFloat(lot2.remaining_quantity), 50);
});

test("estimateCgTax returns 30% of gain", () => {
  reset();
  seed("u_cb_3");
  recordAcquisition({ user_id: "u_cb_3", asset: "ETH", chain: "base", quantity: "1", cost_inr_per_unit: "100000", acquired_at: 100 });
  const t = estimateCgTax({ user_id: "u_cb_3", asset: "ETH", chain: "base", quantity: "1", proceeds_inr: 200000 });
  assert.equal(t.estimated_gain_inr, 100000);
  assert.equal(t.estimated_tax_inr, 30000);
});

test("estimateCgTax clamps negative gain to 0", () => {
  reset();
  seed("u_cb_4");
  recordAcquisition({ user_id: "u_cb_4", asset: "ETH", chain: "base", quantity: "1", cost_inr_per_unit: "300000", acquired_at: 100 });
  const t = estimateCgTax({ user_id: "u_cb_4", asset: "ETH", chain: "base", quantity: "1", proceeds_inr: 250000 });
  // Loss; tax 0
  assert.equal(t.estimated_gain_inr, 0);
  assert.equal(t.estimated_tax_inr, 0);
});

test("totalRealizedGain sums gains within FY window", () => {
  reset();
  seed("u_cb_5");
  recordAcquisition({ user_id: "u_cb_5", asset: "USDC", chain: "base", quantity: "1000", cost_inr_per_unit: "95", acquired_at: 100 });
  disposeFifo({ user_id: "u_cb_5", asset: "USDC", chain: "base", quantity: "100", proceeds_inr: 10000 });
  const g = totalRealizedGain("u_cb_5", 0, Date.now() + 1000);
  assert.equal(g, 500); // 100*100 - 100*95 = 500
});
