import { test } from "node:test";
import assert from "node:assert/strict";

process.env.DATABASE_URL = `./data/test-bs-${process.pid}.db`;
delete process.env.PIMLICO_API_KEY;

const { sendBaseSepolia, sponsorWithPimlico, USDC_ADDRESS } = await import("../src/services/base_sepolia.ts");

test("sendBaseSepolia stub mode returns deterministic 0x tx_hash", async () => {
  const r = await sendBaseSepolia({
    user_smart_wallet: "0xstubwallet",
    to: "0xmerchant",
    asset: "USDC",
    amount: "10",
  });
  assert.equal(r.chain, "base");
  assert.equal(r.mode, "stub");
  assert.ok(r.tx_hash.startsWith("0x"));
});

test("sendBaseSepolia throws when PIMLICO_API_KEY is set but SDK not wired", async () => {
  process.env.PIMLICO_API_KEY = "test-key";
  await assert.rejects(
    () => sendBaseSepolia({
      user_smart_wallet: "0xw", to: "0xt", asset: "USDC", amount: "1",
    }),
    /PIMLICO_API_KEY is set/
  );
  delete process.env.PIMLICO_API_KEY;
});

test("sponsorWithPimlico stub returns canonical paymaster fields", async () => {
  delete process.env.PIMLICO_API_KEY;
  const sp = await sponsorWithPimlico({});
  assert.ok(sp.paymasterAndData.startsWith("0x"));
  assert.ok(sp.preVerificationGas.startsWith("0x"));
});

test("USDC contract address is the Base Sepolia canonical", () => {
  assert.equal(USDC_ADDRESS, "0x036CbD53842c5426634e7929541eC2318f3dCF7e");
});
