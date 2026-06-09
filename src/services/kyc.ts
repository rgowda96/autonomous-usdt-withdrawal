import { randomUUID } from "node:crypto";
import { db, now } from "../db/index.js";

export type KycStatus = "pending" | "approved" | "rejected" | "expired";

export type KycRecord = {
  id: string;
  user_id: string;
  provider: string;
  status: KycStatus;
  document_type: string | null;
  document_last4: string | null;
  risk_level: string | null;
  created_at: number;
  reviewed_at: number | null;
};

export type KycSubmission = {
  user_id: string;
  document_type: "aadhaar" | "pan" | "passport";
  document_number: string;
  full_name: string;
  date_of_birth: string;
};

// Sumsub adapter interface — real production credentials live behind
// SUMSUB_TOKEN env var. v0 uses a deterministic mock that approves docs
// matching realistic Aadhaar/PAN regexes and rejects others.

const AADHAAR_RE = /^\d{12}$/;
const PAN_RE = /^[A-Z]{5}\d{4}[A-Z]$/;
const PASSPORT_RE = /^[A-Z][0-9]{7}$/;

export function submitKyc(s: KycSubmission): KycRecord {
  const id = `kyc_${randomUUID()}`;
  const t = now();
  const isReal = process.env.SUMSUB_TOKEN && process.env.SUMSUB_TOKEN.length > 0;
  let status: KycStatus = "pending";
  let risk: string = "medium";
  const last4 = s.document_number.slice(-4);

  if (isReal) {
    // Real Sumsub integration. Marked [B] in roadmap until creds arrive.
    // For now treat as pending and let manual review take over.
    status = "pending";
  } else {
    if (s.document_type === "aadhaar" && AADHAAR_RE.test(s.document_number)) { status = "approved"; risk = "low"; }
    else if (s.document_type === "pan" && PAN_RE.test(s.document_number)) { status = "approved"; risk = "low"; }
    else if (s.document_type === "passport" && PASSPORT_RE.test(s.document_number)) { status = "approved"; risk = "low"; }
    else { status = "rejected"; risk = "high"; }
  }

  db().prepare(
    `INSERT INTO kyc_records (id, user_id, provider, status, document_type, document_last4,
       risk_level, raw_response, reviewed_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(id, s.user_id, isReal ? "sumsub" : "mock", status, s.document_type, last4, risk,
        JSON.stringify({ submitted_at: t }), status === "pending" ? null : t, t);

  // Update user.kyc_status to track the latest decision
  if (status !== "pending") {
    db().prepare(`UPDATE users SET kyc_status = ? WHERE id = ?`).run(status, s.user_id);
  }

  return {
    id, user_id: s.user_id, provider: isReal ? "sumsub" : "mock", status,
    document_type: s.document_type, document_last4: last4, risk_level: risk,
    created_at: t, reviewed_at: status === "pending" ? null : t,
  };
}

export function getKycStatus(userId: string): KycRecord | null {
  return (db().prepare(
    `SELECT * FROM kyc_records WHERE user_id = ? ORDER BY created_at DESC LIMIT 1`
  ).get(userId) as KycRecord | undefined) ?? null;
}
