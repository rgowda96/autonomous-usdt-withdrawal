import type { FastifyInstance } from "fastify";
import { db } from "../db/index.js";

export async function registerWalletRoutes(app: FastifyInstance) {
  app.get("/v1/users/:userId/balances", async (req, reply) => {
    const { userId } = req.params as { userId: string };
    const rows = db().prepare(
      `SELECT asset, chain, amount FROM balances WHERE user_id = ?`
    ).all(userId);
    return reply.send({ user_id: userId, balances: rows });
  });

  app.get("/v1/users/:userId/transactions", async (req, reply) => {
    const { userId } = req.params as { userId: string };
    const rows = db().prepare(
      `SELECT id, status, amount_inr, source_asset, source_chain, source_amount, tds_inr,
              offramp_ref, upi_utr, onchain_tx, created_at, updated_at
       FROM transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT 50`
    ).all(userId);
    return reply.send({ user_id: userId, transactions: rows });
  });

  app.get("/v1/transactions/:txId", async (req, reply) => {
    const { txId } = req.params as { txId: string };
    const tx = db().prepare(
      `SELECT t.*, q.payee_identifier, q.payee_display, q.channel, q.rate_inr_per_unit, q.route_plan
       FROM transactions t JOIN quotes q ON q.id = t.quote_id
       WHERE t.id = ?`
    ).get(txId) as any;
    if (!tx) return reply.code(404).send({ error: "TX_NOT_FOUND" });

    const events = db().prepare(
      `SELECT from_status, to_status, detail, created_at
       FROM transaction_events WHERE transaction_id = ? ORDER BY created_at ASC`
    ).all(txId) as any[];

    return reply.send({
      id: tx.id,
      user_id: tx.user_id,
      status: tx.status,
      amount_inr: tx.amount_inr,
      payee: { identifier: tx.payee_identifier, display_name: tx.payee_display },
      channel: tx.channel,
      source: { asset: tx.source_asset, chain: tx.source_chain, amount: tx.source_amount },
      rate_inr_per_unit: tx.rate_inr_per_unit,
      tds_inr: tx.tds_inr,
      offramp_ref: tx.offramp_ref,
      upi_utr: tx.upi_utr,
      onchain_tx: tx.onchain_tx,
      route_plan: tx.route_plan ? JSON.parse(tx.route_plan) : null,
      created_at: tx.created_at,
      updated_at: tx.updated_at,
      timeline: events.map((e) => ({
        from: e.from_status,
        to: e.to_status,
        at: e.created_at,
        detail: e.detail ? JSON.parse(e.detail) : null,
      })),
    });
  });
}
