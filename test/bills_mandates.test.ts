import { test } from "node:test";
import assert from "node:assert/strict";

process.env.DATABASE_URL = `./data/test-bills-${process.pid}.db`;

const { db, now } = await import("../src/db/index.js");
const { seedBillers, listBillers } = await import("../src/services/billers.js");
const { createMandate, listMandates, revokeMandate, runDueMandates } = await import("../src/services/mandates.js");

function reset() {
  db().exec(`
    DELETE FROM notifications;
    DELETE FROM mandates;
    DELETE FROM billers;
    DELETE FROM tds_accruals;
    DELETE FROM transaction_events;
    DELETE FROM transactions;
    DELETE FROM quotes;
    DELETE FROM balances;
    DELETE FROM users;
  `);
}
function seedUser(id: string) {
  db().prepare(`INSERT OR IGNORE INTO users (id, created_at, kyc_status) VALUES (?, ?, ?)`).run(id, now(), "approved");
  db().prepare(`INSERT INTO balances (user_id, asset, chain, amount, updated_at) VALUES (?, ?, ?, ?, ?)`)
    .run(id, "INR_CREDIT", "internal", "100000", now());
}

test("biller catalogue seeds + filters by category", () => {
  reset();
  seedBillers();
  const all = listBillers();
  assert.ok(all.length >= 13);
  const elec = listBillers("electricity");
  assert.ok(elec.length >= 3);
  assert.ok(elec.every((b) => b.category === "electricity"));
});

test("mandate CRUD: create, list, revoke", () => {
  reset();
  seedUser("u_m1");
  const m = createMandate({
    user_id: "u_m1",
    label: "Netflix",
    payee_vpa: "netflix@billdesk",
    amount_inr: 649,
    cadence: "monthly",
  });
  assert.ok(m.id.startsWith("mnd_"));
  const list = listMandates("u_m1");
  assert.equal(list.length, 1);
  assert.equal(revokeMandate(m.id), true);
  const after = listMandates("u_m1")[0];
  assert.ok(after?.revoked_at);
});

test("executor runs due mandates (3 monthly executions then revoke)", async () => {
  reset();
  seedUser("u_m2");
  const m = createMandate({
    user_id: "u_m2",
    label: "Bill",
    payee_vpa: "bill@hdfc",
    amount_inr: 100,
    cadence: "monthly",
    start_at: Date.now() - 1000, // due immediately
  });

  // Run 3 times, advancing next_run_at back each time
  let txCount = 0;
  for (let i = 0; i < 3; i++) {
    const r = await runDueMandates();
    txCount += r.executed;
    db().prepare(`UPDATE mandates SET next_run_at = ? WHERE id = ?`).run(Date.now() - 1000, m.id);
  }
  assert.equal(txCount, 3);

  revokeMandate(m.id);
  const r4 = await runDueMandates();
  assert.equal(r4.executed, 0);
});

test("executor skips expired mandates", async () => {
  reset();
  seedUser("u_m3");
  createMandate({
    user_id: "u_m3",
    label: "Expired",
    payee_vpa: "x@y",
    amount_inr: 100,
    cadence: "monthly",
    start_at: Date.now() - 1000,
    expires_at: Date.now() - 10000,
  });
  const r = await runDueMandates();
  assert.equal(r.executed, 0);
});

test("executor records last_tx_id and bumps next_run_at", async () => {
  reset();
  seedUser("u_m4");
  const m = createMandate({
    user_id: "u_m4",
    label: "AutoPay",
    payee_vpa: "auto@bank",
    amount_inr: 50,
    cadence: "weekly",
    start_at: Date.now() - 1000,
  });
  await runDueMandates();
  const refreshed = (db().prepare(`SELECT * FROM mandates WHERE id = ?`).get(m.id) as any);
  assert.ok(refreshed.last_tx_id?.startsWith("tx_"));
  assert.ok(refreshed.next_run_at > Date.now());
});
