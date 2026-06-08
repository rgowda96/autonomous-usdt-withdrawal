import type { FastifyInstance } from "fastify";
import { QuoteRequestSchema } from "../types.js";
import { createQuote } from "../services/quote.js";

export async function registerQuoteRoutes(app: FastifyInstance) {
  app.post("/v1/quote", async (req, reply) => {
    const parsed = QuoteRequestSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "INVALID_REQUEST", details: parsed.error.flatten() });
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
