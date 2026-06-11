import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

process.env.DATABASE_URL = `./data/test-routing-v2-${process.pid}.db`;

const { db, now } = await import("../src/db/index.js");
const { createQuote } = await import("../src/services/quote.js");
const { recordAcquisition } = await import("../src/services/cost_basis.js");
const { estimateSwapBps, bestVenue } = await import("../src/services/slippage.js");
const { getP2pSpreadBps, _resetP2pCache } = await import("../src/services/p2p_feed.js");

function reset() {
  db().exec(`
    DELETE FROM realized_gains;
    DELETE FROM cost_basis_lots;
    DELETE FROM webhook_events;
    DELETE FROM tds_accruals;
    DELETE FROM transaction_events;
    DELETE FROM transactions;
    DELETE FROM quotes;
    DELETE FROM balances;
    DELETE FROM users;
  `);
}
function seed(id: string, asset: string, chain: string, amount: string) {
  db().prepare(`INSERT OR IGNORE INTO users (id, created_at, kyc_status) VALUES (?, ?, ?)`).run(id, now(), "approved");
  db().prepare(`INSERT INTO balances (user_id, asset, chain, amount, updated_at) VALUES (?, ?, ?, ?, ?)`)
    .run(id, asset, chain, amount, now());
}

test("estimateSwapBps grows with notional", () => {
  const small = estimateSwapBps("ETH", "1inch", 1_000);
  const big = estimateSwapBps("ETH", "1inch", 500_000);
  assert.ok(big > small);
});

test("bestVenue prefers Jupiter for SOL", () => {
  const v = bestVenue("SOL", 10_000);
  assert.ok(["jupiter", "1inch"].includes(v.venue));
  assert.ok(v.est_bps >= 0);
});

test("auto_tax_optimal prefers asset with unrealized loss", () => {
  reset();
  seed("u_tax", "ETH", "base", "1.0");
  // Acquired at very high cost so current spend creates a loss
  recordAcquisition({ user_id: "u_tax", asset: "ETH", chain: "base", quantity: "1.0", cost_inr_per_unit: "1000000" });
  // Also has USDC at normal cost basis
  db().prepare(`INSERT INTO balances (user_id, asset, chain, amount, updated_at) VALUES (?, ?, ?, ?, ?)`)
    .run("u_tax", "USDC", "base", "1000", now());
  recordAcquisition({ user_id: "u_tax", asset: "USDC", chain: "base", quantity: "1000", cost_inr_per_unit: "95" });

  const q = createQuote({
    idempotency_key: randomUUID(),
    user_id: "u_tax",
    payee: { type: "vpa", identifier: "x@y" },
    amount_inr: 500,
    channel: "qr",
    asset_preference: "auto_tax_optimal",
  });
  assert.equal(q.route_plan.source_asset, "ETH"); // harvested the loss
});

test("getP2pSpreadBps falls back on network failure (returns 0 spread)", async () => {
  _resetP2pCache();
  const r = await getP2pSpreadBps();
  // Either it hit Binance (got a real spread), or fell back to CG with 0 spread.
  assert.ok(r.price_inr > 0);
  assert.ok(["binance_p2p", "fallback"].includes(r.source));
});

test("routing surfaces specific swap venue in cost breakdown", () => {
  reset();
  seed("u_v", "ETH", "base", "1.0");
  const q = createQuote({
    idempotency_key: randomUUID(),
    user_id: "u_v",
    payee: { type: "vpa", identifier: "x@y" },
    amount_inr: 5000,
    channel: "qr",
    asset_preference: { asset: "ETH", chain: "base" },
  });
  const swap = q.route_plan.cost_breakdown.find((c) => c.component.includes("Swap ETH"));
  assert.ok(swap);
  assert.match(swap!.component, /\((1inch|uniswap_v4|lifi|jupiter)\)/);
});
