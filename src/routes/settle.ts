import type { FastifyInstance } from "fastify";
import { SettleRequestSchema } from "../types.js";
import { settle } from "../services/settle.js";
import { checkRateLimit } from "../services/rate_limit.js";
import { db } from "../db/index.js";

export async function registerSettleRoutes(app: FastifyInstance) {
  app.post("/v1/settle", async (req, reply) => {
    const parsed = SettleRequestSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "INVALID_REQUEST", details: parsed.error.flatten() });
    const q = db().prepare(`SELECT user_id FROM quotes WHERE id = ?`).get(parsed.data.quote_id) as { user_id: string } | undefined;
    const rlKey = `settle:${q?.user_id ?? "anon"}`;
    const rl = checkRateLimit(rlKey, { windowMs: 60_000, max: 5 });
    if (!rl.allowed) {
      reply.header("Retry-After", Math.ceil((rl.resetAt - Date.now()) / 1000));
      return reply.code(429).send({ error: "RATE_LIMITED", reset_at: rl.resetAt });
    }
    try {
      const result = await settle(parsed.data);
      return reply.send(result);
    } catch (e: any) {
      const code = e.message === "QUOTE_EXPIRED" ? 409
        : e.message === "QUOTE_NOT_FOUND" ? 404
        : e.message === "INSUFFICIENT_FUNDS" ? 402
        : 400;
      return reply.code(code).send({ error: e.message });
    }
  });
}
