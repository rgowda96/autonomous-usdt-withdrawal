// Dedicated idempotency_keys table with scope + TTL. Closes 004.05.
//
// The original implementation embedded the key into per-table unique
// columns (quotes.idempotency_key, transactions.settle_idempotency_key).
// That works but couples key lifetimes to the row, complicating cleanup.
// This service provides a uniform `recordIfNew()` helper for new endpoints
// (the intent gateway is the first user). The two existing in-table keys
// stay where they are — the sweeper already rotates them.

import { db, now } from "../db/index.js";

const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000; // 24h

export type Scope = "quote" | "settle" | "intent" | "agent_pay";

export type RecordOutcome<T> =
  | { hit: false }
  | { hit: true; ref_id: string; response: T | null };

export function recordIfNew<T>(opts: {
  key: string;
  scope: Scope;
  ref_id: string;
  response?: T;
  user_id?: string;
  ttl_ms?: number;
}): RecordOutcome<T> {
  const t = now();
  const expires = t + (opts.ttl_ms ?? DEFAULT_TTL_MS);
  const existing = db().prepare(
    `SELECT ref_id, response_blob FROM idempotency_keys WHERE key = ? AND scope = ?`
  ).get(opts.key, opts.scope) as { ref_id: string; response_blob: string | null } | undefined;
  if (existing) {
    return {
      hit: true,
      ref_id: existing.ref_id,
      response: existing.response_blob ? (JSON.parse(existing.response_blob) as T) : null,
    };
  }
  db().prepare(
    `INSERT INTO idempotency_keys (key, scope, ref_id, user_id, response_blob, created_at, expires_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(opts.key, opts.scope, opts.ref_id, opts.user_id ?? null, opts.response ? JSON.stringify(opts.response) : null, t, expires);
  return { hit: false };
}

export function startIdempotencyTableCleanup(intervalMs: number = 60 * 60 * 1000) {
  const tick = () => {
    try {
      db().prepare(`DELETE FROM idempotency_keys WHERE expires_at < ?`).run(now());
    } catch { /* best-effort */ }
  };
  setInterval(tick, intervalMs).unref?.();
  tick();
}
