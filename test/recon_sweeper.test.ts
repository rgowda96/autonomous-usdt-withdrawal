import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

process.env.DATABASE_URL = `./data/test-recon-${process.pid}.db`;

const { db, now } = await import("../src/db/index.js");
const { _runReconciliationSweepOnce } = await import("../src/services/sweepers.js");

function reset() {
  db().exec(`
    DELETE FROM webhook_events;
    DELETE FROM tds_accruals;
    DELETE FROM transaction_events;
    DELETE FROM transactions;
    DELETE FROM quotes;
    DELETE FROM balances;
    DELETE FROM users;
  `);
}

function insertOrphanTx(opts: { id?: string; updated_at: number; status: string }): string {
  const id = opts.id ?? `tx_${randomUUID()}`;
  const qid = `q_${randomUUID()}`;
  db().prepare(`INSERT OR IGNORE INTO users (id, created_at, kyc_status) VALUES (?, ?, ?)`)
    .run("u_r", now(), "approved");
  db().prepare(
    `INSERT INTO quotes (id, user_id, idempotency_key, payee_type, payee_identifier, payee_display,
      amount_inr, channel, route_plan, rate_inr_per_unit, expires_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(qid, "u_r", randomUUID(), "vpa", "x@y", null, 100, "qr", "{}", "1.0", now() + 60000, now());
  db().prepare(
    `INSERT INTO transactions (id, user_id, quote_id, settle_idempotency_key, status, amount_inr,
      source_asset, source_chain, source_amount, tds_inr, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(id, "u_r", qid, randomUUID(), opts.status, 100, "USDC", "base", "1.0", 1, now(), opts.updated_at);
  return id;
}

test("recon sweeps orphan USDC_RECEIVED > 10min", () => {
  reset();
  const old = insertOrphanTx({ updated_at: Date.now() - 15 * 60 * 1000, status: "USDC_RECEIVED" });
  const fresh = insertOrphanTx({ updated_at: Date.now() - 1 * 60 * 1000, status: "USDC_RECEIVED" });
  const settled = insertOrphanTx({ updated_at: Date.now() - 60 * 60 * 1000, status: "SETTLED" });

  const swept = _runReconciliationSweepOnce();
  assert.equal(swept, 1);

  const oldStatus = (db().prepare(`SELECT status FROM transactions WHERE id = ?`).get(old) as any).status;
  const freshStatus = (db().prepare(`SELECT status FROM transactions WHERE id = ?`).get(fresh) as any).status;
  const settledStatus = (db().prepare(`SELECT status FROM transactions WHERE id = ?`).get(settled) as any).status;
  assert.equal(oldStatus, "REFUND_PENDING");
  assert.equal(freshStatus, "USDC_RECEIVED");
  assert.equal(settledStatus, "SETTLED");
});
