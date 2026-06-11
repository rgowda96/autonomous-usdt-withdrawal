import { test } from "node:test";
import assert from "node:assert/strict";

process.env.DATABASE_URL = `./data/test-yield-${process.pid}.db`;

const { db, now } = await import("../src/db/index.js");
const { openPosition, unwindPosition, accruePosition, listOpenPositions, setYieldPref, getYieldPref } = await import("../src/services/yield.js");

function reset() {
  db().exec(`
    DELETE FROM yield_snapshots;
    DELETE FROM yield_positions;
    DELETE FROM yield_prefs;
    DELETE FROM balances;
    DELETE FROM users;
  `);
}
function seed(id: string, asset = "USDC", chain = "base", amount = "1000.00000000") {
  db().prepare(`INSERT OR IGNORE INTO users (id, created_at, kyc_status) VALUES (?, ?, ?)`).run(id, now(), "approved");
  db().prepare(`INSERT INTO balances (user_id, asset, chain, amount, updated_at) VALUES (?, ?, ?, ?, ?)`)
    .run(id, asset, chain, amount, now());
}

test("open position debits balance and records principal", () => {
  reset();
  seed("u_y1");
  const pos = openPosition("u_y1", "USDC", "base", "100");
  const bal = db().prepare(`SELECT amount FROM balances WHERE user_id = ? AND asset = 'USDC'`).get("u_y1") as any;
  assert.equal(parseFloat(bal.amount).toFixed(2), "900.00");
  assert.equal(pos.principal, "100");
  assert.equal(pos.current_value, "100");
});

test("accrue interest grows current_value", () => {
  reset();
  seed("u_y2");
  const pos = openPosition("u_y2", "USDC", "base", "1000");

  // Backdate the position by 1 year
  db().prepare(`UPDATE yield_positions SET updated_at = ? WHERE id = ?`).run(Date.now() - 365 * 24 * 60 * 60 * 1000, pos.id);

  accruePosition(pos.id);
  const after = db().prepare(`SELECT current_value FROM yield_positions WHERE id = ?`).get(pos.id) as any;
  // 5% APY -> ~1050
  const v = parseFloat(after.current_value);
  assert.ok(v > 1049 && v < 1051, `expected ~1050, got ${v}`);
});

test("unwind closes position and credits balance with yield", () => {
  reset();
  seed("u_y3");
  const pos = openPosition("u_y3", "USDC", "base", "1000");
  // 6 months elapsed -> ~2.5% gain
  db().prepare(`UPDATE yield_positions SET updated_at = ? WHERE id = ?`).run(Date.now() - 182 * 24 * 60 * 60 * 1000, pos.id);

  const credited = unwindPosition(pos.id);
  const bal = db().prepare(`SELECT amount FROM balances WHERE user_id = ? AND asset = 'USDC'`).get("u_y3") as any;
  const fromBal = parseFloat(bal.amount);
  // started 1000, opened 1000 -> bal 0; unwind ~1024.66 credited
  assert.ok(fromBal > 1020 && fromBal < 1030, `bal=${fromBal}`);
  assert.ok(parseFloat(credited) > 1020);
});

test("listOpenPositions excludes closed positions", () => {
  reset();
  seed("u_y4");
  const a = openPosition("u_y4", "USDC", "base", "100");
  const b = openPosition("u_y4", "USDC", "base", "200");
  unwindPosition(a.id);
  const open = listOpenPositions("u_y4");
  assert.equal(open.length, 1);
  assert.equal(open[0]?.id, b.id);
});

test("yield_prefs round-trip", () => {
  reset();
  seed("u_y5");
  assert.equal(getYieldPref("u_y5", "USDC", "base"), false);
  setYieldPref("u_y5", "USDC", "base", true);
  assert.equal(getYieldPref("u_y5", "USDC", "base"), true);
  setYieldPref("u_y5", "USDC", "base", false);
  assert.equal(getYieldPref("u_y5", "USDC", "base"), false);
});

test("opening with insufficient balance throws", () => {
  reset();
  seed("u_y6", "USDC", "base", "50.00000000");
  assert.throws(() => openPosition("u_y6", "USDC", "base", "100"));
});

test("non-yield asset rejected", () => {
  reset();
  seed("u_y7", "INR_CREDIT", "internal", "10000.00");
  assert.throws(() => openPosition("u_y7", "INR_CREDIT", "internal", "100"));
});
