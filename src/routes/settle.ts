import type { FastifyInstance } from "fastify";
import { SettleRequestSchema } from "../types.js";
import { settle } from "../services/settle.js";

export async function registerSettleRoutes(app: FastifyInstance) {
  app.post("/v1/settle", async (req, reply) => {
    const parsed = SettleRequestSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "INVALID_REQUEST", details: parsed.error.flatten() });
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
