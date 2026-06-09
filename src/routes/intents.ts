import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { fromCheckout, parseBharatQr, parseUpiDeeplink, PaymentIntentSchema } from "../services/intent.js";
import { createQuote } from "../services/quote.js";

const ParseSchema = z.object({
  input: z.string().min(1),
  user_id: z.string().min(1),
});

const SubmitSchema = z.object({
  user_id: z.string().min(1),
  intent: PaymentIntentSchema,
  idempotency_key: z.string().uuid(),
});

export async function registerIntentRoutes(app: FastifyInstance) {
  // POST /v1/intents/parse — accepts any of:
  //   - { input: "upi://pay?pa=...&am=500", user_id }
  //   - { input: "<emv bharat-qr string>", user_id }
  //   - { input: "<checkout-body-json>", user_id }
  app.post("/v1/intents/parse", async (req, reply) => {
    const parsed = ParseSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "INVALID_REQUEST", details: parsed.error.flatten() });
    const { input } = parsed.data;
    try {
      let intent;
      if (input.startsWith("upi://")) {
        intent = parseUpiDeeplink(input);
      } else if (input.startsWith("00020")) {
        intent = parseBharatQr(input);
      } else if (input.trim().startsWith("{")) {
        intent = fromCheckout(JSON.parse(input));
      } else {
        return reply.code(400).send({ error: "UNRECOGNIZED_INPUT" });
      }
      return reply.send({ intent: { ...intent, intent_id: randomUUID() } });
    } catch (e: any) {
      return reply.code(400).send({ error: "PARSE_FAILED", message: e.message });
    }
  });

  // POST /v1/intents/submit — takes a canonical PaymentIntent + idem_key,
  // returns a quote (signed downstream by /v1/settle).
  app.post("/v1/intents/submit", async (req, reply) => {
    const parsed = SubmitSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "INVALID_REQUEST", details: parsed.error.flatten() });
    const { user_id, intent, idempotency_key } = parsed.data;
    try {
      const quote = createQuote({
        idempotency_key,
        user_id,
        payee: intent.payee,
        amount_inr: intent.amount.value,
        channel: intent.channel,
        asset_preference: "auto_cheapest",
      });
      return reply.send({
        quote_id: quote.id,
        amount_inr: quote.amount_inr,
        source_asset: quote.route_plan.source_asset,
        source_chain: quote.route_plan.source_chain,
        total_fee_bps: quote.route_plan.total_fee_bps,
        tds_inr: quote.route_plan.tds_inr,
        expires_at: quote.expires_at,
        cost_breakdown: quote.route_plan.cost_breakdown,
      });
    } catch (e: any) {
      return reply.code(400).send({ error: e.message ?? "SUBMIT_FAILED" });
    }
  });
}
