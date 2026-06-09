import type { FastifyInstance } from "fastify";
import { QuoteRequestSchema } from "../types.js";
import { createQuote, getQuote } from "../services/quote.js";
import { checkRateLimit } from "../services/rate_limit.js";

export async function registerQuoteRoutes(app: FastifyInstance) {
  app.get("/v1/quotes/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const q = getQuote(id);
    if (!q) return reply.code(404).send({ error: "QUOTE_NOT_FOUND" });
    return reply.send({
      quote_id: q.id,
      user_id: q.user_id,
      amount_inr: q.amount_inr,
      source_asset: q.route_plan.source_asset,
      source_chain: q.route_plan.source_chain,
      source_amount: q.route_plan.source_amount,
      rate_inr_per_unit: q.rate_inr_per_unit,
      total_fee_bps: q.route_plan.total_fee_bps,
      tds_inr: q.route_plan.tds_inr,
      expires_at: q.expires_at,
      expired: q.expires_at < Date.now(),
      steps: q.route_plan.steps,
    });
  });

  app.post("/v1/quote", async (req, reply) => {
    const parsed = QuoteRequestSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "INVALID_REQUEST", details: parsed.error.flatten() });
    const rl = checkRateLimit(`quote:${parsed.data.user_id}`, { windowMs: 60_000, max: 10 });
    if (!rl.allowed) {
      reply.header("Retry-After", Math.ceil((rl.resetAt - Date.now()) / 1000));
      return reply.code(429).send({ error: "RATE_LIMITED", reset_at: rl.resetAt });
    }
    try {
      const quote = createQuote(parsed.data);
      return reply.send({
        quote_id: quote.id,
        amount_inr: quote.amount_inr,
        source_asset: quote.route_plan.source_asset,
        source_chain: quote.route_plan.source_chain,
        source_amount: quote.route_plan.source_amount,
        rate_inr_per_unit: quote.rate_inr_per_unit,
        total_fee_bps: quote.route_plan.total_fee_bps,
        tds_inr: quote.route_plan.tds_inr,
        expires_at: quote.expires_at,
        steps: quote.route_plan.steps,
      });
    } catch (e: any) {
      return reply.code(400).send({ error: e.message });
    }
  });
}
