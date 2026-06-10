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
  })();
}
