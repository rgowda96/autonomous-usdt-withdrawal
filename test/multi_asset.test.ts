import { test } from "node:test";
import assert from "node:assert/strict";

process.env.DATABASE_URL = `./data/test-multi-${process.pid}.db`;

const { db, now } = await import("../src/db/index.js");
const { adapterFor, bridgeQuote, creditDeposit } = await import("../src/services/chain_adapters.js");
const { ensureSmartWallet, buildAndSubmitUserOp } = await import("../src/services/wallet.js");

function reset() {
  db().exec(`DELETE FROM balances; DELETE FROM users;`);
}
function seed(id: string) {
  db().prepare(`INSERT OR IGNORE INTO users (id, created_at, kyc_status) VALUES (?, ?, ?)`).run(id, now(), "approved");
}

test("each chain adapter produces deterministic addresses", () => {
  for (const chain of ["base", "solana", "tron", "ethereum", "arbitrum"] as const) {
    const a1 = adapterFor(chain).generateAddress("user_x");
    const a2 = adapterFor(chain).generateAddress("user_x");
    assert.equal(a1, a2);
    assert.ok(a1.length > 30);
  }
});

test("base + ethereum addresses start with 0x; tron with T; solana naked", () => {
  assert.ok(adapterFor("base").generateAddress("u").startsWith("0x"));
  assert.ok(adapterFor("ethereum").generateAddress("u").startsWith("0x"));
  assert.ok(adapterFor("tron").generateAddress("u").startsWith("T"));
  assert.ok(!adapterFor("solana").generateAddress("u").startsWith("0x"));
});

test("bridgeQuote noops on same-chain", () => {
  const q = bridgeQuote("base", "base", "USDC", "1");
  assert.equal(q.est_fee_bps, 0);
  assert.equal(q.est_latency_seconds, 0);
  assert.equal(q.venue, "noop");
});

test("bridgeQuote tron->base has higher fee + latency", () => {
  const q = bridgeQuote("tron", "base", "USDT", "1000");
  assert.ok(q.est_fee_bps > 0);
  assert.ok(q.est_latency_seconds > 30);
});

test("deposit observation credits balance", () => {
  reset();
  seed("u_d1");
  const evt = adapterFor("solana").observeDeposit({ address: "x", asset: "USDC", amount: "100" });
  creditDeposit("u_d1", evt);
  const bal = db().prepare(`SELECT amount FROM balances WHERE user_id = ? AND chain = 'solana'`).get("u_d1") as any;
  assert.equal(parseFloat(bal.amount), 100);
});

test("multiple deposits sum", () => {
  reset();
  seed("u_d2");
  creditDeposit("u_d2", adapterFor("base").observeDeposit({ address: "x", asset: "USDC", amount: "50" }));
  creditDeposit("u_d2", adapterFor("base").observeDeposit({ address: "x", asset: "USDC", amount: "75" }));
  const bal = db().prepare(`SELECT amount FROM balances WHERE user_id = ? AND chain = 'base'`).get("u_d2") as any;
  assert.equal(parseFloat(bal.amount), 125);
});

test("ensureSmartWallet idempotent and persists address", () => {
  reset();
  seed("u_w1");
  const a = ensureSmartWallet("u_w1", "base");
  const b = ensureSmartWallet("u_w1", "base");
  assert.equal(a.address, b.address);
  const u = db().prepare(`SELECT smart_wallet_address FROM users WHERE id = ?`).get("u_w1") as any;
  assert.equal(u.smart_wallet_address, a.address);
});

test("buildAndSubmitUserOp returns tx_hash on the correct chain", async () => {
  reset();
  seed("u_w2");
  const r = await buildAndSubmitUserOp({
    user_id: "u_w2",
    chain: "base",
    to: "0xabc",
    asset: "USDC",
    amount: "10",
  });
  assert.equal(r.chain, "base");
  assert.ok(r.tx_hash.startsWith("0x"));
  assert.ok(r.tx_hash.length > 30);
});
