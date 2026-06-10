import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

process.env.DATABASE_URL = `./data/test-recon-${process.pid}.db`;

const { db, now } = await import("../src/db/index.js");
const { runDailyRecon, MockReconPartner } = await import("../src/services/recon.ts");

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

function insertTx(opts: { id?: string; created_at: number; offramp_ref: string; status: string; utr?: string }) {
  const id = opts.id ?? `tx_${randomUUID()}`;
  const qid = `q_${randomUUID()}`;
  db().prepare(`INSERT OR IGNORE INTO users (id, created_at, kyc_status) VALUES (?, ?, ?)`).run("u_recon", now(), "approved");
  db().prepare(
    `INSERT INTO quotes (id, user_id, idempotency_key, payee_type, payee_identifier, payee_display,
      amount_inr, channel, route_plan, rate_inr_per_unit, expires_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(qid, "u_recon", randomUUID(), "vpa", "x@y", null, 100, "qr", "{}", "1.0", opts.created_at + 60000, opts.created_at);
  db().prepare(
    `INSERT INTO transactions (id, user_id, quote_id, settle_idempotency_key, status, amount_inr,
      source_asset, source_chain, source_amount, tds_inr, offramp_ref, upi_utr, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(id, "u_recon", qid, randomUUID(), opts.status, 100, "USDC", "base", "1.0", 1, opts.offramp_ref, opts.utr ?? null, opts.created_at, opts.created_at);
  return id;
}

test("recon report tallies matched rows", async () => {
  reset();
  // Pick a fixed UTC day
  const day = Date.UTC(2026, 5, 5); // 2026-06-05
  insertTx({ created_at: day + 1000, offramp_ref: "ref_a", status: "SETTLED", utr: "UTR1" });
  insertTx({ created_at: day + 2000, offramp_ref: "ref_b", status: "SETTLED", utr: "UTR2" });
  const r = await runDailyRecon(new MockReconPartner(), new Date(day));
  assert.equal(r.partner_payouts, 2);
  assert.equal(r.matched, 2);
  assert.equal(r.mismatched.length, 0);
});

test("recon flags status mismatch when partner is mocked to disagree", async () => {
  reset();
  const day = Date.UTC(2026, 5, 6);
  // Local says SETTLED but the partner overrides status via custom partner
  insertTx({ created_at: day + 1000, offramp_ref: "ref_c", status: "SETTLED" });
  const customPartner = {
    name: "test",
    async listPayouts() {
      return [{ provider_ref: "ref_c", client_ref: "q", status: "FAILED" as const, utr: undefined }];
    },
  };
  const r = await runDailyRecon(customPartner, new Date(day));
  assert.equal(r.mismatched.length, 1);
  assert.equal(r.mismatched[0]?.reason, "status_disagreement");
});

test("recon flags missing_locally + missing_remotely independently", async () => {
  reset();
  const day = Date.UTC(2026, 5, 7);
  insertTx({ created_at: day + 1000, offramp_ref: "local_only", status: "SETTLED" });
  const customPartner = {
    name: "test",
    async listPayouts() {
      return [{ provider_ref: "partner_only", client_ref: "q", status: "SUCCESS" as const, utr: "UTR99" }];
    },
  };
  const r = await runDailyRecon(customPartner, new Date(day));
  assert.deepEqual(r.missing_locally, ["partner_only"]);
  assert.deepEqual(r.missing_remotely, ["local_only"]);
});
