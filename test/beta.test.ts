import { test } from "node:test";
import assert from "node:assert/strict";

process.env.DATABASE_URL = `./data/test-beta-${process.pid}.db`;

const { db, now } = await import("../src/db/index.js");
const { mintInvite, redeemInvite, listInvites } = await import("../src/services/beta.js");

function reset() {
  db().exec(`DELETE FROM beta_invites; DELETE FROM users;`);
}

test("mintInvite produces a SP-XXXX-XXXX code", () => {
  reset();
  const inv = mintInvite({ cohort: "wave-1" });
  assert.match(inv.code, /^SP-[A-Z0-9]{4}-[A-Z0-9]{4}$/);
  assert.equal(inv.cohort, "wave-1");
  assert.equal(inv.consumed_by_user_id, null);
});

test("redeemInvite succeeds once + flags ALREADY_CONSUMED on retry", () => {
  reset();
  const inv = mintInvite({ cohort: "founder" });
  const r1 = redeemInvite(inv.code, "u_b1");
  assert.equal(r1.ok, true);
  if (r1.ok) assert.equal(r1.cohort, "founder");
  const r2 = redeemInvite(inv.code, "u_b1");
  assert.equal(r2.ok, false);
  if (!r2.ok) assert.equal(r2.reason, "ALREADY_CONSUMED");
});

test("redeemInvite returns NOT_FOUND for bad code", () => {
  reset();
  const r = redeemInvite("SP-XXXX-XXXX", "u_b2");
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.reason, "NOT_FOUND");
});

test("redeemInvite EXPIRED if past expires_at", () => {
  reset();
  const inv = mintInvite({ cohort: "wave-1", ttl_days: 1 });
  // Backdate
  db().prepare(`UPDATE beta_invites SET expires_at = ? WHERE code = ?`).run(Date.now() - 1000, inv.code);
  const r = redeemInvite(inv.code, "u_b3");
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.reason, "EXPIRED");
});

test("listInvites filters by cohort", () => {
  reset();
  mintInvite({ cohort: "wave-1" });
  mintInvite({ cohort: "wave-1" });
  mintInvite({ cohort: "wave-2" });
  assert.equal(listInvites("wave-1").length, 2);
  assert.equal(listInvites("wave-2").length, 1);
});
