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

  app.get("/v1/users/:userId/tds/summary", async (req, reply) => {
    const { userId } = req.params as { userId: string };
    const { fy } = req.query as { fy?: string };
    const where = fy ? `WHERE user_id = ? AND fiscal_year = ?` : `WHERE user_id = ?`;
    const args = fy ? [userId, fy] : [userId];
    const rows = db().prepare(
      `SELECT fiscal_year, quarter, SUM(amount_inr) AS total_inr, COUNT(*) AS tx_count, SUM(filed) AS filed_count
       FROM tds_accruals ${where}
       GROUP BY fiscal_year, quarter
       ORDER BY fiscal_year DESC, quarter DESC`
    ).all(...args) as { fiscal_year: string; quarter: string; total_inr: number; tx_count: number; filed_count: number }[];

    const totalInr = rows.reduce((s, r) => s + r.total_inr, 0);
    const txCount = rows.reduce((s, r) => s + r.tx_count, 0);

    return reply.send({
      user_id: userId,
      filter: fy ?? "all",
      total_inr: totalInr,
      tx_count: txCount,
      by_quarter: rows.map((r) => ({
        fiscal_year: r.fiscal_year,
        quarter: r.quarter,
        total_inr: r.total_inr,
        tx_count: r.tx_count,
        filed: r.filed_count === r.tx_count, // all txns filed in this quarter
      })),
    });
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
