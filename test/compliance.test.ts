import { test } from "node:test";
import assert from "node:assert/strict";

process.env.DATABASE_URL = `./data/test-compliance-${process.pid}.db`;

const { db, now } = await import("../src/db/index.js");
const { submitKyc, getKycStatus } = await import("../src/services/kyc.js");
const { screen, screenAndAutoFreeze, isFrozen, freezeUser, fiuIndDailyReport } = await import("../src/services/kyt.js");

function reset() {
  db().exec(`
    DELETE FROM compliance_freezes;
    DELETE FROM kyt_screenings;
    DELETE FROM kyc_records;
    DELETE FROM tds_accruals;
    DELETE FROM transaction_events;
    DELETE FROM transactions;
    DELETE FROM quotes;
    DELETE FROM balances;
    DELETE FROM users;
  `);
}
function seed(id: string) {
  db().prepare(`INSERT OR IGNORE INTO users (id, created_at, kyc_status) VALUES (?, ?, ?)`).run(id, now(), "pending");
}

test("submitKyc approves valid Aadhaar", () => {
  reset();
  seed("u_k1");
  const r = submitKyc({
    user_id: "u_k1",
    document_type: "aadhaar",
    document_number: "123456789012",
    full_name: "Test User",
    date_of_birth: "1990-01-01",
  });
  assert.equal(r.status, "approved");
  assert.equal(r.document_last4, "9012");
});

test("submitKyc rejects malformed PAN", () => {
  reset();
  seed("u_k2");
  const r = submitKyc({
    user_id: "u_k2",
    document_type: "pan",
    document_number: "not-a-pan",
    full_name: "Test User",
    date_of_birth: "1990-01-01",
  });
  assert.equal(r.status, "rejected");
});

test("getKycStatus returns latest record", () => {
  reset();
  seed("u_k3");
  submitKyc({
    user_id: "u_k3", document_type: "aadhaar", document_number: "111111111111",
    full_name: "X", date_of_birth: "1990-01-01",
  });
  const r = getKycStatus("u_k3");
  assert.equal(r?.status, "approved");
});

test("screen returns deterministic risk + sanctions flag", () => {
  reset();
  const a = screen("0x8589427373D6D84e98730D7795D8f6f8731fda16", "ethereum");
  assert.equal(a.sanctions_hit, true);
  assert.equal(a.risk_score, 100);

  const b = screen("0xclean000000000000000000000000000000000000", "ethereum");
  assert.equal(b.sanctions_hit, false);
  assert.ok(b.risk_score < 30);
});

test("screenAndAutoFreeze freezes user on sanctions match", () => {
  reset();
  seed("u_k4");
  const r = screenAndAutoFreeze("0x8589427373D6D84e98730D7795D8f6f8731fda16", "ethereum", "u_k4");
  assert.equal(r.sanctions_hit, true);
  assert.equal(isFrozen("u_k4"), true);
});

test("clean address does not freeze", () => {
  reset();
  seed("u_k5");
  screenAndAutoFreeze("0xclean000000000000000000000000000000000001", "ethereum", "u_k5");
  assert.equal(isFrozen("u_k5"), false);
});

test("FIU-IND report renders CSV header", () => {
  reset();
  const csv = fiuIndDailyReport(new Date());
  const lines = csv.split("\n");
  assert.equal(lines[0], "timestamp,transaction_id,user_id,amount_inr,source_asset,payee_vpa,status,tds_inr");
});

test("manual freeze + isFrozen round trip", () => {
  reset();
  seed("u_k6");
  freezeUser("u_k6", "manual_review", "manual");
  assert.equal(isFrozen("u_k6"), true);
});
