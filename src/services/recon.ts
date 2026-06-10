// Daily reconciliation job against the off-ramp partner.
// Pulls the partner's payout list for the previous UTC day, joins to our
// transactions on quote_id (== client_ref), flags any mismatches.

import { db, now } from "../db/index.js";

export type ReconReport = {
  date: string;
  partner_payouts: number;
  matched: number;
  mismatched: Array<{ provider_ref: string; reason: string; local_status?: string; partner_status?: string }>;
  missing_locally: string[];
  missing_remotely: string[];
};

export interface ReconPartner {
  name: string;
  listPayouts(start: number, end: number): Promise<{ provider_ref: string; client_ref: string; status: "SUCCESS" | "FAILED" | "PENDING"; utr?: string }[]>;
}

// Mock partner used in tests + when no real partner is configured.
export class MockReconPartner implements ReconPartner {
  name = "mock";
  async listPayouts(_start: number, _end: number) {
    return db().prepare(
      `SELECT t.offramp_ref AS provider_ref, t.quote_id AS client_ref, t.status, t.upi_utr AS utr
       FROM transactions t
       WHERE t.offramp_ref IS NOT NULL AND t.created_at >= ? AND t.created_at < ?`
    ).all(_start, _end).map((r: any) => ({
      provider_ref: r.provider_ref,
      client_ref: r.client_ref,
      status: (r.status === "SETTLED" ? "SUCCESS" : r.status === "REFUND_PENDING" || r.status === "REFUNDED" || r.status === "FAILED" ? "FAILED" : "PENDING") as "SUCCESS" | "FAILED" | "PENDING",
      utr: r.utr ?? undefined,
    }));
  }
}

export async function runDailyRecon(partner: ReconPartner, forDate: Date = yesterday()): Promise<ReconReport> {
  const start = Date.UTC(forDate.getUTCFullYear(), forDate.getUTCMonth(), forDate.getUTCDate());
  const end = start + 24 * 60 * 60 * 1000;
  const partnerRows = await partner.listPayouts(start, end);
  const localRows = db().prepare(
    `SELECT id, quote_id, offramp_ref, status, upi_utr FROM transactions
     WHERE offramp_ref IS NOT NULL AND created_at >= ? AND created_at < ?`
  ).all(start, end) as { id: string; quote_id: string; offramp_ref: string; status: string; upi_utr: string | null }[];

  const localByRef = new Map(localRows.map((r) => [r.offramp_ref, r]));
  const partnerByRef = new Map(partnerRows.map((r) => [r.provider_ref, r]));

  let matched = 0;
  const mismatched: ReconReport["mismatched"] = [];
  const missing_locally: string[] = [];
  for (const p of partnerRows) {
    const l = localByRef.get(p.provider_ref);
    if (!l) { missing_locally.push(p.provider_ref); continue; }
    const localOk = l.status === "SETTLED";
    const partnerOk = p.status === "SUCCESS";
    if (localOk === partnerOk) matched++;
    else mismatched.push({
      provider_ref: p.provider_ref,
      reason: "status_disagreement",
      local_status: l.status,
      partner_status: p.status,
    });
  }
  const missing_remotely: string[] = [];
  for (const l of localRows) {
    if (!partnerByRef.has(l.offramp_ref)) missing_remotely.push(l.offramp_ref);
  }

  return {
    date: forDate.toISOString().slice(0, 10),
    partner_payouts: partnerRows.length,
    matched,
    mismatched,
    missing_locally,
    missing_remotely,
  };
}

function yesterday(): Date {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 1);
  return d;
}

let _started = false;
export function startDailyReconJob(partner: ReconPartner, intervalMs: number = 24 * 60 * 60 * 1000) {
  if (_started) return;
  _started = true;
  setInterval(() => { runDailyRecon(partner).catch(() => {}); }, intervalMs).unref?.();
}
