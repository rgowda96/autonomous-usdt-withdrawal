import { test } from "node:test";
import assert from "node:assert/strict";

process.env.DATABASE_URL = `./data/test-demoseed-${process.pid}.db`;

const { db } = await import("../src/db/index.ts");
const { seedDemoUser, DEMO_USER_ID } = await import("../src/services/demo_seed.ts");
const { totalSavedVsRedotpay } = await import("../src/services/online_purchase.ts");

test("demo seed populates non-empty lifetime savings", () => {
  db().exec(`DELETE FROM online_purchases; DELETE FROM balances; DELETE FROM users;`);
  seedDemoUser(db());
  const s = totalSavedVsRedotpay(DEMO_USER_ID);
  assert.equal(s.purchase_count, 2);
  assert.equal(s.lifetime_saved_inr, 414 + 1242);
});

test("demo seed is idempotent across repeated boots", () => {
  db().exec(`DELETE FROM online_purchases; DELETE FROM balances; DELETE FROM users;`);
  seedDemoUser(db());
  seedDemoUser(db());
  seedDemoUser(db());
  const s = totalSavedVsRedotpay(DEMO_USER_ID);
  assert.equal(s.purchase_count, 2); // not 6
});
