import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { createSessionKey, listSessionKeys, revokeSessionKey } from "../services/session_keys.js";

const CreateSchema = z.object({
  label: z.string().min(1).max(100),
  daily_cap_inr: z.number().int().positive().max(100_000),
  per_txn_cap_inr: z.number().int().positive().max(100_000),
  vpa_allowlist: z.array(z.string().min(1)).max(50).optional(),
  ttl_days: z.number().int().positive().max(365).default(30),
});

export async function registerSessionKeyRoutes(app: FastifyInstance) {
  app.post("/v1/users/:userId/session-keys", async (req, reply) => {
    const { userId } = req.params as { userId: string };
    const parsed = CreateSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "INVALID_REQUEST", details: parsed.error.flatten() });
    if (parsed.data.per_txn_cap_inr > parsed.data.daily_cap_inr) {
      return reply.code(400).send({ error: "PER_TXN_CAP_EXCEEDS_DAILY" });
    }
    const sk = createSessionKey({ user_id: userId, ...parsed.data });
    // Token returned ONCE on create — never persisted in plaintext.
    return reply.code(201).send({ ...sk });
  });

  app.get("/v1/users/:userId/session-keys", async (req, reply) => {
    const { userId } = req.params as { userId: string };
    return reply.send({ user_id: userId, session_keys: listSessionKeys(userId) });
  });

  app.delete("/v1/users/:userId/session-keys/:id", async (req, reply) => {
    const { id } = req.params as { userId: string; id: string };
    const revoked = revokeSessionKey(id);
    if (!revoked) return reply.code(404).send({ error: "NOT_FOUND_OR_ALREADY_REVOKED" });
    return reply.send({ ok: true });
  });
}
