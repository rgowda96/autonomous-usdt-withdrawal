import { test } from "node:test";
import assert from "node:assert/strict";

process.env.DATABASE_URL = `./data/test-agent-${process.pid}.db`;

const { db, now } = await import("../src/db/index.js");
const { createSessionKey, checkPolicy, listSessionKeys, revokeSessionKey, resolveSessionKey } = await import("../src/services/session_keys.js");
const { registerSessionKeyRoutes } = await import("../src/routes/session_keys.js");
const { registerAgentRoutes } = await import("../src/routes/agent.js");
const { registerQuoteRoutes } = await import("../src/routes/quote.js");
const { registerSettleRoutes } = await import("../src/routes/settle.js");
const Fastify = (await import("fastify")).default;

function reset() {
  db().exec(`
    DELETE FROM notifications;
    DELETE FROM session_key_usage;
    DELETE FROM session_keys;
    DELETE FROM webhook_events;
    DELETE FROM tds_accruals;
    DELETE FROM transaction_events;
    DELETE FROM transactions;
    DELETE FROM quotes;
    DELETE FROM balances;
    DELETE FROM users;
  `);
}
function seed(id: string) {
  db().prepare(`INSERT OR IGNORE INTO users (id, created_at, kyc_status) VALUES (?, ?, ?)`).run(id, now(), "approved");
  db().prepare(`INSERT INTO balances (user_id, asset, chain, amount, updated_at) VALUES (?, ?, ?, ?, ?)`)
    .run(id, "INR_CREDIT", "internal", "100000", now());
}

async function buildApp() {
  const app = Fastify();
  await registerSessionKeyRoutes(app);
  await registerAgentRoutes(app);
  await registerQuoteRoutes(app);
  await registerSettleRoutes(app);
  return app;
}

test("create + list + revoke session key", async () => {
  reset();
  seed("u_a");
  const app = await buildApp();
  const create = await app.inject({
    method: "POST",
    url: "/v1/users/u_a/session-keys",
    payload: {
      label: "Claude Desktop",
      daily_cap_inr: 1000,
      per_txn_cap_inr: 200,
      vpa_allowlist: ["swiggy@hdfc"],
      ttl_days: 30,
    },
  });
  assert.equal(create.statusCode, 201);
  const sk = create.json();
  assert.ok(sk.token.startsWith("stp_"));

  const list = await app.inject({ method: "GET", url: "/v1/users/u_a/session-keys" });
  assert.equal(list.json().session_keys.length, 1);

  const del = await app.inject({ method: "DELETE", url: `/v1/users/u_a/session-keys/${sk.id}` });
  assert.equal(del.statusCode, 200);

  const after = listSessionKeys("u_a");
  assert.ok(after[0]?.revoked_at);
});

test("agent pays within bounds 3 times, 4th over per-txn cap rejected", async () => {
  reset();
  seed("u_agent_x");
  const app = await buildApp();
  const sk = createSessionKey({
    user_id: "u_agent_x",
    label: "Test agent",
    daily_cap_inr: 1000,
    per_txn_cap_inr: 200,
    ttl_days: 30,
  });
  for (let i = 0; i < 3; i++) {
    const r = await app.inject({
      method: "POST",
      url: "/v1/agent/pay-upi",
      headers: { authorization: `Bearer ${sk.token}` },
      payload: { vpa: "swiggy@hdfc", amount_inr: 150 },
    });
    assert.equal(r.statusCode, 200, `payment ${i} should succeed`);
  }
  const over = await app.inject({
    method: "POST",
    url: "/v1/agent/pay-upi",
    headers: { authorization: `Bearer ${sk.token}` },
    payload: { vpa: "swiggy@hdfc", amount_inr: 300 },
  });
  assert.equal(over.statusCode, 403);
  assert.equal(over.json().reason, "PER_TXN_CAP");
});

test("agent payment rejected when vpa not in allowlist", async () => {
  reset();
  seed("u_agent_y");
  const sk = createSessionKey({
    user_id: "u_agent_y",
    label: "Restricted",
    daily_cap_inr: 1000,
    per_txn_cap_inr: 500,
    vpa_allowlist: ["swiggy@hdfc"],
    ttl_days: 30,
  });
  const app = await buildApp();
  const r = await app.inject({
    method: "POST",
    url: "/v1/agent/pay-upi",
    headers: { authorization: `Bearer ${sk.token}` },
    payload: { vpa: "evil@bank", amount_inr: 100 },
  });
  assert.equal(r.statusCode, 403);
  assert.equal(r.json().reason, "VPA_NOT_ALLOWED");
});

test("missing bearer returns 401", async () => {
  reset();
  const app = await buildApp();
  const r = await app.inject({
    method: "POST",
    url: "/v1/agent/pay-upi",
    payload: { vpa: "x@y", amount_inr: 1 },
  });
  assert.equal(r.statusCode, 401);
});

test("revoked key rejected", async () => {
  reset();
  seed("u_rev");
  const sk = createSessionKey({ user_id: "u_rev", label: "X", daily_cap_inr: 1000, per_txn_cap_inr: 500, ttl_days: 30 });
  revokeSessionKey(sk.id);
  const app = await buildApp();
  const r = await app.inject({
    method: "POST",
    url: "/v1/agent/pay-upi",
    headers: { authorization: `Bearer ${sk.token}` },
    payload: { vpa: "x@y", amount_inr: 50 },
  });
  assert.equal(r.statusCode, 403);
  assert.equal(r.json().reason, "REVOKED");
});

test("daily cap respected across multiple payments", async () => {
  reset();
  seed("u_daily");
  const sk = createSessionKey({
    user_id: "u_daily",
    label: "Cap test",
    daily_cap_inr: 300,
    per_txn_cap_inr: 200,
    ttl_days: 30,
  });
  const app = await buildApp();
  const ok1 = await app.inject({
    method: "POST",
    url: "/v1/agent/pay-upi",
    headers: { authorization: `Bearer ${sk.token}` },
    payload: { vpa: "x@y", amount_inr: 150 },
  });
  assert.equal(ok1.statusCode, 200);
  const ok2 = await app.inject({
    method: "POST",
    url: "/v1/agent/pay-upi",
    headers: { authorization: `Bearer ${sk.token}` },
    payload: { vpa: "x@y", amount_inr: 150 },
  });
  assert.equal(ok2.statusCode, 200);
  const cap = await app.inject({
    method: "POST",
    url: "/v1/agent/pay-upi",
    headers: { authorization: `Bearer ${sk.token}` },
    payload: { vpa: "x@y", amount_inr: 50 },
  });
  assert.equal(cap.statusCode, 403);
  assert.equal(cap.json().reason, "DAILY_CAP");
});

test("whoami returns bounds", async () => {
  reset();
  seed("u_who");
  const sk = createSessionKey({ user_id: "u_who", label: "L", daily_cap_inr: 500, per_txn_cap_inr: 100, ttl_days: 30 });
  const app = await buildApp();
  const r = await app.inject({
    method: "GET",
    url: "/v1/agent/whoami",
    headers: { authorization: `Bearer ${sk.token}` },
  });
  assert.equal(r.statusCode, 200);
  const b = r.json();
  assert.equal(b.user_id, "u_who");
  assert.equal(b.daily_cap_inr, 500);
  assert.equal(b.label, "L");
});
