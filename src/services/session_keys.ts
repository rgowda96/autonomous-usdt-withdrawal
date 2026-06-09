import { createHash, randomBytes, randomUUID } from "node:crypto";
import { db, now } from "../db/index.js";

export type SessionKey = {
  id: string;
  user_id: string;
  label: string;
  daily_cap_inr: number;
  per_txn_cap_inr: number;
  vpa_allowlist: string[] | null;
  expires_at: number;
  revoked_at: number | null;
  created_at: number;
};

export type CreatedSessionKey = SessionKey & { token: string };

function hash(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function createSessionKey(opts: {
  user_id: string;
  label: string;
  daily_cap_inr: number;
  per_txn_cap_inr: number;
  vpa_allowlist?: string[];
  ttl_days: number;
}): CreatedSessionKey {
  const id = `sk_${randomUUID()}`;
  const token = `stp_${randomBytes(24).toString("hex")}`;
  const tokenHash = hash(token);
  const createdAt = now();
  const expiresAt = createdAt + opts.ttl_days * 24 * 60 * 60 * 1000;

  db().prepare(
    `INSERT INTO session_keys (id, user_id, label, token_hash, daily_cap_inr, per_txn_cap_inr,
       vpa_allowlist, expires_at, revoked_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, ?)`
  ).run(
    id, opts.user_id, opts.label, tokenHash,
    opts.daily_cap_inr, opts.per_txn_cap_inr,
    opts.vpa_allowlist ? JSON.stringify(opts.vpa_allowlist) : null,
    expiresAt, createdAt
  );

  return {
    id, user_id: opts.user_id, label: opts.label,
    daily_cap_inr: opts.daily_cap_inr, per_txn_cap_inr: opts.per_txn_cap_inr,
    vpa_allowlist: opts.vpa_allowlist ?? null,
    expires_at: expiresAt, revoked_at: null, created_at: createdAt,
    token,
  };
}

export function listSessionKeys(userId: string): SessionKey[] {
  const rows = db().prepare(
    `SELECT id, user_id, label, daily_cap_inr, per_txn_cap_inr, vpa_allowlist,
            expires_at, revoked_at, created_at
     FROM session_keys WHERE user_id = ? ORDER BY created_at DESC`
  ).all(userId) as any[];
  return rows.map((r) => ({ ...r, vpa_allowlist: r.vpa_allowlist ? JSON.parse(r.vpa_allowlist) : null }));
}

export function revokeSessionKey(id: string): boolean {
  const r = db().prepare(`UPDATE session_keys SET revoked_at = ? WHERE id = ? AND revoked_at IS NULL`)
    .run(now(), id);
  return r.changes > 0;
}

export function resolveSessionKey(bearerToken: string): SessionKey | null {
  const row = db().prepare(
    `SELECT id, user_id, label, daily_cap_inr, per_txn_cap_inr, vpa_allowlist,
            expires_at, revoked_at, created_at
     FROM session_keys WHERE token_hash = ?`
  ).get(hash(bearerToken)) as any;
  if (!row) return null;
  return { ...row, vpa_allowlist: row.vpa_allowlist ? JSON.parse(row.vpa_allowlist) : null };
}

export type PolicyCheck =
  | { allowed: true }
  | { allowed: false; reason: "REVOKED" | "EXPIRED" | "PER_TXN_CAP" | "DAILY_CAP" | "VPA_NOT_ALLOWED" };

const DAY_MS = 24 * 60 * 60 * 1000;

export function checkPolicy(sk: SessionKey, vpa: string, amountInr: number): PolicyCheck {
  if (sk.revoked_at) return { allowed: false, reason: "REVOKED" };
  if (sk.expires_at < now()) return { allowed: false, reason: "EXPIRED" };
  if (amountInr > sk.per_txn_cap_inr) return { allowed: false, reason: "PER_TXN_CAP" };
  if (sk.vpa_allowlist && sk.vpa_allowlist.length > 0 && !sk.vpa_allowlist.includes(vpa)) {
    return { allowed: false, reason: "VPA_NOT_ALLOWED" };
  }
  const since = now() - DAY_MS;
  const row = db().prepare(
    `SELECT COALESCE(SUM(amount_inr), 0) AS total FROM session_key_usage
     WHERE session_key_id = ? AND outcome = 'ALLOWED' AND created_at > ?`
  ).get(sk.id, since) as { total: number };
  if (row.total + amountInr > sk.daily_cap_inr) return { allowed: false, reason: "DAILY_CAP" };
  return { allowed: true };
}

export function logUsage(opts: {
  session_key_id: string;
  transaction_id: string | null;
  amount_inr: number;
  vpa: string;
  outcome: "ALLOWED" | "REJECTED_CAP" | "REJECTED_ALLOWLIST" | "REJECTED_EXPIRED" | "REJECTED_REVOKED";
}) {
  db().prepare(
    `INSERT INTO session_key_usage (session_key_id, transaction_id, amount_inr, vpa, outcome, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(opts.session_key_id, opts.transaction_id, opts.amount_inr, opts.vpa, opts.outcome, now());
}

export function notify(opts: { user_id: string; kind: string; title: string; body: string; ref_id?: string }) {
  db().prepare(
    `INSERT INTO notifications (user_id, kind, title, body, ref_id, created_at) VALUES (?, ?, ?, ?, ?, ?)`
  ).run(opts.user_id, opts.kind, opts.title, opts.body, opts.ref_id ?? null, now());
}
