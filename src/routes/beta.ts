import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { listInvites, mintInvite, redeemInvite } from "../services/beta.js";

const MintSchema = z.object({
  cohort: z.string().min(1).max(50),
  invited_by: z.string().optional(),
  email: z.string().email().optional(),
  ttl_days: z.number().int().positive().max(365).optional(),
});

const RedeemSchema = z.object({
  code: z.string().min(4),
  user_id: z.string().min(1),
});

export async function registerBetaRoutes(app: FastifyInstance) {
  app.post("/v1/beta/invites", async (req, reply) => {
    const parsed = MintSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "INVALID_REQUEST", details: parsed.error.flatten() });
    const inv = mintInvite(parsed.data);
    return reply.code(201).send(inv);
  });

  app.get("/v1/beta/invites", async (req, reply) => {
    const { cohort } = req.query as { cohort?: string };
    return reply.send({ invites: listInvites(cohort) });
  });

  app.post("/v1/beta/redeem", async (req, reply) => {
    const parsed = RedeemSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "INVALID_REQUEST", details: parsed.error.flatten() });
    const r = redeemInvite(parsed.data.code, parsed.data.user_id);
    if (!r.ok) return reply.code(400).send({ error: r.reason });
    return reply.send(r);
  });
}
