import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { getBiller, listBillers } from "../services/billers.js";
import { createMandate, listMandates, revokeMandate } from "../services/mandates.js";

const MandateSchema = z.object({
  label: z.string().min(1).max(100),
  payee_vpa: z.string().min(3),
  amount_inr: z.number().int().positive().max(100_000),
  cadence: z.enum(["monthly", "weekly", "daily"]),
  expires_at: z.number().int().optional().nullable(),
});

export async function registerBillRoutes(app: FastifyInstance) {
  app.get("/v1/billers", async (req, reply) => {
    const { category, region } = req.query as { category?: string; region?: string };
    return reply.send({ billers: listBillers(category, region) });
  });

  app.get("/v1/billers/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const b = getBiller(id);
    if (!b) return reply.code(404).send({ error: "NOT_FOUND" });
    return reply.send(b);
  });

  app.get("/v1/users/:userId/mandates", async (req, reply) => {
    const { userId } = req.params as { userId: string };
    return reply.send({ mandates: listMandates(userId) });
  });

  app.post("/v1/users/:userId/mandates", async (req, reply) => {
    const { userId } = req.params as { userId: string };
    const parsed = MandateSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "INVALID_REQUEST", details: parsed.error.flatten() });
    const m = createMandate({ user_id: userId, ...parsed.data });
    return reply.code(201).send(m);
  });

  app.delete("/v1/users/:userId/mandates/:id", async (req, reply) => {
    const { id } = req.params as { userId: string; id: string };
    const ok = revokeMandate(id);
    if (!ok) return reply.code(404).send({ error: "NOT_FOUND_OR_ALREADY_REVOKED" });
    return reply.send({ ok: true });
  });
}
