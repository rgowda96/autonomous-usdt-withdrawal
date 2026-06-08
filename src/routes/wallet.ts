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
}
