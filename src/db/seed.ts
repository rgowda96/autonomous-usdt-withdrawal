import { db, now } from "./index.js";
import { randomUUID } from "node:crypto";

const userId = "user_demo_1";
const conn = db();

conn.prepare(`INSERT OR IGNORE INTO users (id, created_at, kyc_status) VALUES (?, ?, ?)`)
  .run(userId, now(), "approved");

const upsertBal = conn.prepare(
  `INSERT INTO balances (user_id, asset, chain, amount, updated_at)
   VALUES (?, ?, ?, ?, ?)
   ON CONFLICT (user_id, asset, chain) DO UPDATE SET amount = excluded.amount, updated_at = excluded.updated_at`
);

upsertBal.run(userId, "USDC", "base", "1000.000000", now());
upsertBal.run(userId, "USDT", "tron", "500.000000", now());
upsertBal.run(userId, "INR_CREDIT", "internal", "2000.00", now());

console.log("Seeded user:", userId);
console.log("idempotency demo key:", randomUUID());
