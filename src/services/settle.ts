import { randomUUID } from "node:crypto";
import { db, now } from "../db/index.js";
import { getQuote } from "./quote.js";
import { accrueTds, appendEvent, setTxStatus } from "./ledger.js";
import { getOffRamp } from "./offramp.js";
import type { SettleRequest } from "../types.js";

export type SettleResult = {
  transaction_id: string;
  status: string;
  offramp_ref?: string;
  utr?: string;
};

export async function settle(req: SettleRequest): Promise<SettleResult> {
  // Idempotency
  const existing = db().prepare(
    `SELECT id, status, offramp_ref, upi_utr FROM transactions WHERE settle_idempotency_key = ?`
  ).get(req.idempotency_key) as { id: string; status: string; offramp_ref: string | null; upi_utr: string | null } | undefined;
  if (existing) {
    return { transaction_id: existing.id, status: existing.status, offramp_ref: existing.offramp_ref ?? undefined, utr: existing.upi_utr ?? undefined };
  }

  const quote = getQuote(req.quote_id);
  if (!quote) throw new Error("QUOTE_NOT_FOUND");
  if (quote.expires_at < now()) throw new Error("QUOTE_EXPIRED");

  // v0: auth_proof validation is a stub. v1 verifies passkey assertion against user's pubkey.
  if (!req.auth_proof || req.auth_proof.length < 8) throw new Error("INVALID_AUTH_PROOF");

  const txId = `tx_${randomUUID()}`;
  const plan = quote.route_plan;

  db().prepare(
    `INSERT INTO transactions (id, user_id, quote_id, settle_idempotency_key, status, amount_inr,
                               source_asset, source_chain, source_amount, tds_inr, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    txId, quote.user_id, quote.id, req.idempotency_key, "PENDING",
    quote.amount_inr, plan.source_asset, plan.source_chain, plan.source_amount,
    plan.tds_inr, now(), now(),
  );
  appendEvent(txId, null, "PENDING", { plan_steps: plan.steps.length });

  // Simulated on-chain leg. v1: submit UserOp via Pimlico bundler, await receipt.
  await debit(quote.user_id, plan.source_asset, plan.source_chain, plan.source_amount);
  const onchainTx = `0xsim_${randomUUID().replace(/-/g, "").slice(0, 40)}`;
  setTxStatus(txId, "USDC_RECEIVED", { onchain_tx: onchainTx }, { onchain_tx: onchainTx });

  // Off-ramp payout
  const offramp = getOffRamp();
  const payout = await offramp.payout({
    client_ref: quote.id,
    vpa: extractVpa(quote),
    amount_inr: quote.amount_inr - plan.tds_inr,
    note: `stablepay ${quote.id}`,
  });

  if (payout.status === "FAILED") {
    setTxStatus(txId, "REFUND_PENDING", { reason: payout.reason }, { offramp_ref: payout.provider_ref });
    // v1: trigger USDC refund back to user wallet here.
    return { transaction_id: txId, status: "REFUND_PENDING", offramp_ref: payout.provider_ref };
  }

  setTxStatus(txId, "PAYOUT_INITIATED", { provider_ref: payout.provider_ref }, {
    offramp_ref: payout.provider_ref,
    offramp_provider: "mock",
  });

  // TDS accrual happens at payout initiation; reversed if refunded.
  accrueTds(quote.user_id, txId, plan.tds_inr);

  return { transaction_id: txId, status: "PAYOUT_INITIATED", offramp_ref: payout.provider_ref };
}

function extractVpa(quote: ReturnType<typeof getQuote>): string {
  if (!quote) throw new Error("no quote");
  const row = db().prepare(`SELECT payee_identifier FROM quotes WHERE id = ?`).get(quote.id) as { payee_identifier: string };
  return row.payee_identifier;
}

async function debit(userId: string, asset: string, chain: string, amount: string) {
  const row = db().prepare(`SELECT amount FROM balances WHERE user_id = ? AND asset = ? AND chain = ?`)
    .get(userId, asset, chain) as { amount: string } | undefined;
  if (!row) throw new Error("BALANCE_MISSING");
  const current = Number(row.amount);
  const want = Number(amount);
  if (current < want) throw new Error("INSUFFICIENT_FUNDS");
  db().prepare(`UPDATE balances SET amount = ?, updated_at = ? WHERE user_id = ? AND asset = ? AND chain = ?`)
    .run((current - want).toFixed(8), now(), userId, asset, chain);
}
