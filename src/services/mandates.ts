import { randomUUID } from "node:crypto";
import { db, now } from "../db/index.js";
import { createQuote } from "./quote.js";
import { settle } from "./settle.js";
import { notify } from "./session_keys.js";

export type Cadence = "monthly" | "weekly" | "daily";
export type Mandate = {
  id: string;
  user_id: string;
  label: string;
  payee_vpa: string;
  amount_inr: number;
  cadence: Cadence;
  next_run_at: number;
  last_run_at: number | null;
  last_tx_id: string | null;
  expires_at: number | null;
  revoked_at: number | null;
  created_at: number;
};

function next(now0: number, cadence: Cadence): number {
  const d = 24 * 60 * 60 * 1000;
  if (cadence === "monthly") return now0 + 30 * d;
  if (cadence === "weekly") return now0 + 7 * d;
  return now0 + d;
}

export function createMandate(opts: {
  user_id: string;
  label: string;
  payee_vpa: string;
  amount_inr: number;
  cadence: Cadence;
  expires_at?: number | null;
  start_at?: number;
}): Mandate {
  const t = now();
  const id = `mnd_${randomUUID()}`;
  const nextRun = opts.start_at ?? next(t, opts.cadence);
  db().prepare(
    `INSERT INTO mandates (id, user_id, label, payee_vpa, amount_inr, cadence, next_run_at,
      last_run_at, last_tx_id, expires_at, revoked_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?, NULL, ?)`
  ).run(id, opts.user_id, opts.label, opts.payee_vpa, opts.amount_inr, opts.cadence, nextRun, opts.expires_at ?? null, t);
  return {
    id, user_id: opts.user_id, label: opts.label, payee_vpa: opts.payee_vpa, amount_inr: opts.amount_inr,
    cadence: opts.cadence, next_run_at: nextRun, last_run_at: null, last_tx_id: null,
    expires_at: opts.expires_at ?? null, revoked_at: null, created_at: t,
  };
}

export function listMandates(userId: string): Mandate[] {
  return db().prepare(
    `SELECT * FROM mandates WHERE user_id = ? ORDER BY created_at DESC`
  ).all(userId) as Mandate[];
}

export function revokeMandate(id: string): boolean {
  const r = db().prepare(`UPDATE mandates SET revoked_at = ? WHERE id = ? AND revoked_at IS NULL`).run(now(), id);
  return r.changes > 0;
}

// Executor: scan due mandates, run one tick of quote+settle for each.
export async function runDueMandates(): Promise<{ executed: number; errors: number }> {
  const t = now();
  const due = db().prepare(
    `SELECT * FROM mandates WHERE revoked_at IS NULL AND next_run_at <= ? AND (expires_at IS NULL OR expires_at > ?)`
  ).all(t, t) as Mandate[];

  let executed = 0;
  let errors = 0;
  for (const m of due) {
    try {
      const quote = createQuote({
        idempotency_key: randomUUID(),
        user_id: m.user_id,
        payee: { type: "vpa", identifier: m.payee_vpa, display_name: m.label },
        amount_inr: m.amount_inr,
        channel: "bill",
        asset_preference: "auto_cheapest",
      });
      const result = await settle({
        idempotency_key: randomUUID(),
        quote_id: quote.id,
        auth_proof: `mandate:${m.id}`,
      });
      db().prepare(
        `UPDATE mandates SET last_run_at = ?, last_tx_id = ?, next_run_at = ? WHERE id = ?`
      ).run(t, result.transaction_id, next(t, m.cadence), m.id);
      notify({
        user_id: m.user_id,
        kind: "mandate_executed",
        title: `${m.label} — paid ₹${m.amount_inr}`,
        body: result.transaction_id,
        ref_id: m.id,
      });
      executed++;
    } catch (e: any) {
      errors++;
      notify({
        user_id: m.user_id,
        kind: "mandate_failed",
        title: `${m.label} — payment failed`,
        body: e.message ?? "unknown",
        ref_id: m.id,
      });
    }
  }
  return { executed, errors };
}

let _started = false;
export function startMandateExecutor(intervalMs: number = 60 * 1000) {
  if (_started) return;
  _started = true;
  setInterval(() => { runDueMandates().catch(() => {}); }, intervalMs).unref?.();
}
