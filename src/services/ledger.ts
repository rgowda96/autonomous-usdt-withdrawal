import { db, now } from "../db/index.js";
import type { TxStatus } from "../types.js";

export function appendEvent(transactionId: string, fromStatus: TxStatus | null, toStatus: TxStatus, detail?: unknown) {
  db().prepare(
    `INSERT INTO transaction_events (transaction_id, from_status, to_status, detail, created_at)
     VALUES (?, ?, ?, ?, ?)`
  ).run(transactionId, fromStatus, toStatus, detail ? JSON.stringify(detail) : null, now());
}

export function setTxStatus(transactionId: string, toStatus: TxStatus, detail?: unknown, patch?: Record<string, string | number | null>) {
  const row = db().prepare(`SELECT status FROM transactions WHERE id = ?`).get(transactionId) as { status: TxStatus } | undefined;
  if (!row) throw new Error(`tx not found: ${transactionId}`);
  const sets = ["status = ?", "updated_at = ?"];
  const args: (string | number | null)[] = [toStatus, now()];
  if (patch) {
    for (const [k, v] of Object.entries(patch)) {
      sets.push(`${k} = ?`);
      args.push(v);
    }
  }
  args.push(transactionId);
  db().prepare(`UPDATE transactions SET ${sets.join(", ")} WHERE id = ?`).run(...args);
  appendEvent(transactionId, row.status, toStatus, detail);
}

export function fiscalYearAndQuarter(ts: number): { fy: string; q: string } {
  const d = new Date(ts);
  const m = d.getUTCMonth() + 1;
  const y = d.getUTCFullYear();
  // India FY: April–March
  const fyStart = m >= 4 ? y : y - 1;
  const fy = `${fyStart}-${(fyStart + 1).toString().slice(2)}`;
  const q = m >= 4 && m <= 6 ? "Q1" : m <= 9 ? "Q2" : m <= 12 ? "Q3" : "Q4";
  return { fy, q };
}

export function accrueTds(userId: string, transactionId: string, amountInr: number) {
  if (amountInr <= 0) return;
  const { fy, q } = fiscalYearAndQuarter(now());
  db().prepare(
    `INSERT INTO tds_accruals (user_id, transaction_id, amount_inr, fiscal_year, quarter, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(userId, transactionId, amountInr, fy, q, now());
}
