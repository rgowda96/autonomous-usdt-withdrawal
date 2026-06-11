import { db } from "../db/index.js";
import { setTxStatus } from "./ledger.js";

// Idempotency keys persisted in quotes.idempotency_key and
// transactions.settle_idempotency_key. After 24h, the chance of legitimate
// retry on the same key is effectively zero. Prune ancient rows' keys to
// reclaim uniqueness for the next 24h cycle. We DELETE the quote rows older
// than 90 days entirely (the tx row holds the durable record).

const TTL_QUOTE_MS = 24 * 60 * 60 * 1000;       // 24h: free up quote idem keys
const TTL_QUOTE_DELETE_MS = 90 * 24 * 60 * 60 * 1000; // 90d: full row purge

let _started = false;

export function startIdempotencyCleanup(intervalMs: number = 60 * 60 * 1000) {
  if (_started) return;
  _started = true;
  const tick = () => {
    try {
      const now = Date.now();
      // Free up old quote idem keys (set to a sentinel so the unique index doesn't collide)
      db().prepare(
        `UPDATE quotes SET idempotency_key = 'expired:' || id WHERE created_at < ? AND idempotency_key NOT LIKE 'expired:%'`
      ).run(now - TTL_QUOTE_MS);
      // Purge very old quote rows
      db().prepare(
        `DELETE FROM quotes WHERE created_at < ? AND id NOT IN (SELECT quote_id FROM transactions)`
      ).run(now - TTL_QUOTE_DELETE_MS);
    } catch {
      // best-effort sweeper; never crashes the process
    }
  };
  setInterval(tick, intervalMs).unref?.();
  // Also tick once at boot
  tick();
}

// Reconciliation: any tx stuck in USDC_RECEIVED for >10 min didn't make it to
// PAYOUT_INITIATED. The off-ramp call likely failed or timed out. Move to
// REFUND_PENDING so the operator/refund job can return the USDC to the user.
const ORPHAN_USDC_MS = 10 * 60 * 1000;

export function startReconciliationSweeper(intervalMs: number = 5 * 60 * 1000) {
  const tick = () => {
    try {
      const cutoff = Date.now() - ORPHAN_USDC_MS;
      const orphans = db().prepare(
        `SELECT id FROM transactions WHERE status = 'USDC_RECEIVED' AND updated_at < ?`
      ).all(cutoff) as { id: string }[];
      for (const o of orphans) {
        setTxStatus(o.id, "REFUND_PENDING", { reason: "orphan_usdc_no_payout", swept_at: Date.now() });
      }
    } catch {
      // sweeper never crashes the process
    }
  };
  setInterval(tick, intervalMs).unref?.();
  tick();
}

// Test-only single-shot
export function _runReconciliationSweepOnce() {
  const cutoff = Date.now() - ORPHAN_USDC_MS;
  const orphans = db().prepare(
    `SELECT id FROM transactions WHERE status = 'USDC_RECEIVED' AND updated_at < ?`
  ).all(cutoff) as { id: string }[];
  for (const o of orphans) {
    setTxStatus(o.id, "REFUND_PENDING", { reason: "orphan_usdc_no_payout", swept_at: Date.now() });
  }
  return orphans.length;
}

// Test-only: run a single sweep against current time
export function _runIdempotencySweepOnce() {
  const now = Date.now();
  db().prepare(
    `UPDATE quotes SET idempotency_key = 'expired:' || id WHERE created_at < ? AND idempotency_key NOT LIKE 'expired:%'`
  ).run(now - TTL_QUOTE_MS);
}
