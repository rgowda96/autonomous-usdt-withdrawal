import { createHash, randomUUID } from "node:crypto";
import { db, now } from "../db/index.js";

// Chainalysis KYT (mock for v0). Returns a deterministic risk score derived
// from the address hash so tests are reproducible. Hardcoded sanctions list
// mirrors a small subset of OFAC SDN addresses for demonstration.

const SANCTIONED: Set<string> = new Set([
  // Real OFAC SDN addresses (Lazarus Group etc.) for demo only
  "0x8589427373d6d84e98730d7795d8f6f8731fda16".toLowerCase(),
  "0xdd4c48c0b24039969fc16d1cdf626eab821d3384".toLowerCase(),
  "tron-sanctioned-test-address".toLowerCase(),
]);

const HIGH_RISK_CATEGORIES = new Set(["mixer", "darknet", "sanctions", "ransomware"]);

export type KytResult = {
  id: string;
  address: string;
  chain: string;
  risk_score: number;       // 0..100
  category: string | null;
  sanctions_hit: boolean;
  provider: string;
  screened_at: number;
};

export function screen(address: string, chain: string, userId?: string): KytResult {
  const id = `kyt_${randomUUID()}`;
  const addrLc = address.toLowerCase();
  const sanctions = SANCTIONED.has(addrLc);
  const hashHex = createHash("sha256").update(addrLc).digest("hex");
  const hashNum = parseInt(hashHex.slice(0, 6), 16);
  const baseScore = hashNum % 30; // 0..29 baseline
  const score = sanctions ? 100 : baseScore;
  const category = sanctions ? "sanctions" : (baseScore >= 25 ? "exchange" : null);

  const t = now();
  db().prepare(
    `INSERT INTO kyt_screenings (id, user_id, address, chain, risk_score, category, sanctions_hit,
       provider, raw_response, screened_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(id, userId ?? null, address, chain, score, category, sanctions ? 1 : 0,
        process.env.CHAINALYSIS_TOKEN ? "chainalysis" : "mock",
        JSON.stringify({ address, chain }), t);

  return { id, address, chain, risk_score: score, category, sanctions_hit: sanctions, provider: "mock", screened_at: t };
}

export function freezeUser(userId: string, reason: string, source: string, refId?: string): void {
  const id = `frz_${randomUUID()}`;
  db().prepare(
    `INSERT INTO compliance_freezes (id, user_id, reason, source, ref_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(id, userId, reason, source, refId ?? null, now());
}

export function isFrozen(userId: string): boolean {
  const r = db().prepare(
    `SELECT 1 FROM compliance_freezes WHERE user_id = ? AND released_at IS NULL LIMIT 1`
  ).get(userId);
  return !!r;
}

export function screenAndAutoFreeze(address: string, chain: string, userId: string): KytResult {
  const r = screen(address, chain, userId);
  if (r.sanctions_hit) {
    freezeUser(userId, "sanctions_match", "kyt", r.id);
  } else if (r.risk_score >= 80) {
    freezeUser(userId, "high_kyt_risk", "kyt", r.id);
  }
  return r;
}

export function fiuIndDailyReport(forDate: Date = new Date()): string {
  // CSV format: timestamp, transaction_id, user_id, amount_inr, source_asset,
  // payee_vpa, status, tds_inr — a reasonable starter for FIU-IND filings.
  const start = Date.UTC(forDate.getUTCFullYear(), forDate.getUTCMonth(), forDate.getUTCDate());
  const end = start + 24 * 60 * 60 * 1000;
  const rows = db().prepare(
    `SELECT t.created_at, t.id AS transaction_id, t.user_id, t.amount_inr,
            t.source_asset, q.payee_identifier AS payee_vpa, t.status, t.tds_inr
     FROM transactions t JOIN quotes q ON q.id = t.quote_id
     WHERE t.created_at >= ? AND t.created_at < ?
     ORDER BY t.created_at`
  ).all(start, end) as any[];

  const header = "timestamp,transaction_id,user_id,amount_inr,source_asset,payee_vpa,status,tds_inr";
  const csv = rows.map((r) =>
    [new Date(r.created_at).toISOString(), r.transaction_id, r.user_id, r.amount_inr,
     r.source_asset, r.payee_vpa, r.status, r.tds_inr].join(",")
  ).join("\n");
  return header + "\n" + csv;
}
