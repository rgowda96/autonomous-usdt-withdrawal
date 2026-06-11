import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { checkRateLimit } from "../services/rate_limit.js";
import {
  chargeOnline,
  listOnlinePurchases,
  quoteOnline,
  totalSavedVsRedotpay,
} from "../services/online_purchase.js";

const QuoteSchema = z.object({
  usd_amount: z.number().positive().max(100_000),
});

const ChargeSchema = z.object({
  idempotency_key: z.string().uuid(),
  user_id: z.string().min(1),
  merchant: z.string().min(1).max(120),
  merchant_country: z.string().length(2).optional(),
  usd_amount: z.number().positive().max(100_000),
});

export async function registerOnlineRoutes(app: FastifyInstance) {
  // Transparent FX quote for a USD online purchase.
  app.post("/v1/online/quote", async (req, reply) => {
    const parsed = QuoteSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "INVALID_REQUEST", details: parsed.error.flatten() });
    try {
      return reply.send(quoteOnline(parsed.data.usd_amount));
    } catch (e: any) {
      return reply.code(400).send({ error: e.message });
    }
  });

  // Charge a USD online purchase against the user's USDC balance.
  app.post("/v1/online/charge", async (req, reply) => {
    const parsed = ChargeSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "INVALID_REQUEST", details: parsed.error.flatten() });
    const rl = checkRateLimit(`online:${parsed.data.user_id}`, { windowMs: 60_000, max: 10 });
    if (!rl.allowed) {
      reply.header("Retry-After", Math.ceil((rl.resetAt - Date.now()) / 1000));
      return reply.code(429).send({ error: "RATE_LIMITED", reset_at: rl.resetAt });
    }
    try {
      return reply.send(chargeOnline(parsed.data));
    } catch (e: any) {
      const code = e.message === "INSUFFICIENT_USDC" ? 402 : 400;
      return reply.code(code).send({ error: e.message });
    }
  });

  app.get("/v1/users/:userId/online-purchases", async (req, reply) => {
    const { userId } = req.params as { userId: string };
    return reply.send({ user_id: userId, purchases: listOnlinePurchases(userId) });
  });

  // Lifetime "you saved vs RedotPay" headline.
  app.get("/v1/users/:userId/savings", async (req, reply) => {
    const { userId } = req.params as { userId: string };
    return reply.send({ user_id: userId, ...totalSavedVsRedotpay(userId) });
  });
}
