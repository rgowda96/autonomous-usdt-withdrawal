import { test } from "node:test";
import assert from "node:assert/strict";

process.env.DATABASE_URL = `./data/test-deposit-${process.pid}.db`;

const { db, now } = await import("../src/db/index.ts");
const { ensureSmartWallet } = await import("../src/services/wallet.ts");
const { _primeDeposit, pollOnce } = await import("../src/services/deposit_watcher.ts");
const { getAaveAdapter } = await import("../src/services/aave_adapter.ts");
const { detectBackend } = await import("../src/db/backend.ts");
const { recordIfNew, startIdempotencyTableCleanup } = await import("../src/services/idempotency.ts");

function reset() {
  db().exec(`
    DELETE FROM idempotency_keys;
    DELETE FROM realized_gains;
    DELETE FROM cost_basis_lots;
    DELETE FROM balances;
    DELETE FROM users;
  `);
}

test("deposit watcher credits balance + records acquisition", async () => {
  reset();
  db().prepare(`INSERT OR IGNORE INTO users (id, created_at, kyc_status) VALUES (?, ?, ?)`).run("u_dep", now(), "approved");
  const sw = ensureSmartWallet("u_dep", "base");
  _primeDeposit("base", sw.address, "USDC", "250");

  const r = await pollOnce();
  assert.equal(r.credited, 1);

  const bal = db().prepare(`SELECT amount FROM balances WHERE user_id = ? AND asset = 'USDC' AND chain = 'base'`).get("u_dep") as any;
  assert.equal(parseFloat(bal.amount), 250);

  const lots = db().prepare(`SELECT COUNT(*) AS n FROM cost_basis_lots WHERE user_id = ? AND asset = 'USDC'`).get("u_dep") as any;
  assert.equal(lots.n, 1);
});

test("deposit watcher dedups same tx_hash", async () => {
  reset();
  db().prepare(`INSERT OR IGNORE INTO users (id, created_at, kyc_status) VALUES (?, ?, ?)`).run("u_dep2", now(), "approved");
  const sw = ensureSmartWallet("u_dep2", "base");
  _primeDeposit("base", sw.address, "USDC", "10");
  await pollOnce();
  // No re-primed event; second poll should credit nothing
  const r = await pollOnce();
  assert.equal(r.credited, 0);
});

test("Aave adapter returns canonical reserve shape", async () => {
  const a = getAaveAdapter();
  const r = await a.getReserve("USDC");
  assert.ok(r);
  assert.equal(r!.asset, "USDC");
  assert.ok(r!.liquidityRate > 0);
  const supply = await a.buildSupplyOp("USDC", "100", "0xdeadbeef");
  assert.ok(supply.to.startsWith("0x"));
  assert.ok(supply.data.includes("supply_USDC_100"));
});

test("detectBackend distinguishes sqlite vs postgres URLs", () => {
  assert.equal(detectBackend("./data/x.db"), "sqlite");
  assert.equal(detectBackend("postgres://u:p@host/db"), "postgres");
  assert.equal(detectBackend("postgresql://u:p@host/db"), "postgres");
});

test("idempotency_keys recordIfNew returns hit on second call with cached response", () => {
  reset();
  const r1 = recordIfNew({ key: "key-1", scope: "intent", ref_id: "intent_1", response: { foo: 42 } });
  assert.equal(r1.hit, false);
  const r2 = recordIfNew<{ foo: number }>({ key: "key-1", scope: "intent", ref_id: "intent_xxx" });
  assert.equal(r2.hit, true);
  if (r2.hit) {
    assert.equal(r2.ref_id, "intent_1");
    assert.equal(r2.response?.foo, 42);
  }
});

test("idempotency cleanup removes expired rows", () => {
  reset();
  db().prepare(
    `INSERT INTO idempotency_keys (key, scope, ref_id, user_id, response_blob, created_at, expires_at)
     VALUES (?, ?, ?, ?, NULL, ?, ?)`
  ).run("old", "intent", "r", null, Date.now() - 90_000, Date.now() - 1000);
  startIdempotencyTableCleanup(1);
  // Run a manual sweep
  db().prepare(`DELETE FROM idempotency_keys WHERE expires_at < ?`).run(Date.now());
  const count = (db().prepare(`SELECT COUNT(*) AS n FROM idempotency_keys WHERE key = ?`).get("old") as any).n;
  assert.equal(count, 0);
});
