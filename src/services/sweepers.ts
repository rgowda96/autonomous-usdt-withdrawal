import { db } from "../db/index.js";

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

// Test-only: run a single sweep against current time
export function _runIdempotencySweepOnce() {
  const now = Date.now();
  db().prepare(
    `UPDATE quotes SET idempotency_key = 'expired:' || id WHERE created_at < ? AND idempotency_key NOT LIKE 'expired:%'`
  ).run(now - TTL_QUOTE_MS);
}
