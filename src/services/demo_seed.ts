// Shared demo-user seeding helper used by both server boot and the
// `npm run seed` script so they can never drift.

import type Database from "better-sqlite3";
import { now } from "../db/index.js";

export const DEMO_USER_ID = "user_demo_1";

export function seedDemoUser(conn: Database.Database): void {
  conn.transaction(() => {
    conn.prepare(`INSERT OR IGNORE INTO users (id, created_at, kyc_status) VALUES (?, ?, ?)`)
      .run(DEMO_USER_ID, now(), "approved");
    const ins = conn.prepare(
      `INSERT OR IGNORE INTO balances (user_id, asset, chain, amount, updated_at) VALUES (?, ?, ?, ?, ?)`
    );
    ins.run(DEMO_USER_ID, "USDC", "base", "1000.000000", now());
    ins.run(DEMO_USER_ID, "USDT", "tron", "500.000000", now());
    ins.run(DEMO_USER_ID, "INR_CREDIT", "internal", "2000.00", now());

    // A couple of historical online purchases so the Savings hero is non-empty
    // on first run (fixed ids + INSERT OR IGNORE => idempotent across boots).
    // Numbers reflect mid-market ~95, our 0.60% spread, RedotPay ~11.5% haircut.
    const op = conn.prepare(
      `INSERT OR IGNORE INTO online_purchases (id, user_id, idempotency_key, merchant, merchant_country,
        usd_amount, mid_market_inr_per_usd, our_inr_per_usd, our_inr_total, our_fee_inr,
        redotpay_inr_total, saved_inr, usdc_debited, status, network_ref, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'CAPTURED', ?, ?, ?)`
    );
    const day = 24 * 60 * 60 * 1000;
    // $40 OpenAI: our ₹3823 vs RedotPay ₹4237 -> save ₹414
    op.run("op_demo_1", DEMO_USER_ID, "seed-op-1", "OpenAI", "US",
      "40", "95.00", "94.43", 3823, 23, 4237, 414, "40.000000", "auth_demo_seed_1", now() - 6 * day, now() - 6 * day);
    // $120 Amazon US: our ₹11468 vs RedotPay ₹12710 -> save ₹1242
    op.run("op_demo_2", DEMO_USER_ID, "seed-op-2", "Amazon US", "US",
      "120", "95.00", "94.43", 11468, 68, 12710, 1242, "120.000000", "auth_demo_seed_2", now() - 2 * day, now() - 2 * day);
  })();
}
