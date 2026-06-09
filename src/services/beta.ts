import { randomBytes, randomUUID } from "node:crypto";
import { db, now } from "../db/index.js";

export type BetaInvite = {
  code: string;
  invited_by: string | null;
  cohort: string;
  email: string | null;
  consumed_by_user_id: string | null;
  consumed_at: number | null;
  expires_at: number | null;
  created_at: number;
};

function newCode(): string {
  // Human-friendly: SP-XXXX-XXXX (Crockford base32-ish, no ambiguous chars)
  const alpha = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const raw = randomBytes(8);
  let out = "";
  for (let i = 0; i < 8; i++) out += alpha[raw[i]! % alpha.length];
  return `SP-${out.slice(0, 4)}-${out.slice(4, 8)}`;
}

export function mintInvite(opts: { cohort: string; invited_by?: string; email?: string; ttl_days?: number }): BetaInvite {
  const code = newCode();
  const t = now();
  const expires_at = opts.ttl_days ? t + opts.ttl_days * 24 * 60 * 60 * 1000 : null;
  db().prepare(
    `INSERT INTO beta_invites (code, invited_by, cohort, email, consumed_by_user_id, consumed_at, expires_at, created_at)
     VALUES (?, ?, ?, ?, NULL, NULL, ?, ?)`
  ).run(code, opts.invited_by ?? null, opts.cohort, opts.email ?? null, expires_at, t);
  return {
    code, invited_by: opts.invited_by ?? null, cohort: opts.cohort, email: opts.email ?? null,
    consumed_by_user_id: null, consumed_at: null, expires_at, created_at: t,
  };
}

export type RedeemResult =
  | { ok: true; cohort: string; user_id: string }
  | { ok: false; reason: "NOT_FOUND" | "EXPIRED" | "ALREADY_CONSUMED" };

export function redeemInvite(code: string, userId: string): RedeemResult {
  const row = db().prepare(`SELECT * FROM beta_invites WHERE code = ?`).get(code) as BetaInvite | undefined;
  if (!row) return { ok: false, reason: "NOT_FOUND" };
  if (row.consumed_at) return { ok: false, reason: "ALREADY_CONSUMED" };
  if (row.expires_at && row.expires_at < now()) return { ok: false, reason: "EXPIRED" };

  // Ensure user exists FIRST so the FK on beta_invites.consumed_by_user_id holds
  db().prepare(`INSERT OR IGNORE INTO users (id, created_at, kyc_status) VALUES (?, ?, ?)`)
    .run(userId, now(), "pending");

  db().prepare(`UPDATE beta_invites SET consumed_by_user_id = ?, consumed_at = ? WHERE code = ?`)
    .run(userId, now(), code);

  return { ok: true, cohort: row.cohort, user_id: userId };
}

export function listInvites(cohort?: string): BetaInvite[] {
  if (cohort) {
    return db().prepare(`SELECT * FROM beta_invites WHERE cohort = ? ORDER BY created_at DESC`).all(cohort) as BetaInvite[];
  }
  return db().prepare(`SELECT * FROM beta_invites ORDER BY created_at DESC LIMIT 200`).all() as BetaInvite[];
}
