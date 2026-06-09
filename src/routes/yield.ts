import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { getYieldPref, listOpenPositions, openPosition, setYieldPref, unwindPosition } from "../services/yield.js";

const PrefSchema = z.object({ asset: z.string(), chain: z.string(), enabled: z.boolean() });
const OpenSchema = z.object({ asset: z.string(), chain: z.string(), principal: z.string() });

export async function registerYieldRoutes(app: FastifyInstance) {
  app.get("/v1/users/:userId/yield", async (req, reply) => {
    const { userId } = req.params as { userId: string };
    return reply.send({ user_id: userId, positions: listOpenPositions(userId) });
  });

  app.post("/v1/users/:userId/yield/pref", async (req, reply) => {
    const { userId } = req.params as { userId: string };
    const parsed = PrefSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "INVALID_REQUEST", details: parsed.error.flatten() });
    setYieldPref(userId, parsed.data.asset, parsed.data.chain, parsed.data.enabled);
    return reply.send({ ok: true });
  });

  app.get("/v1/users/:userId/yield/pref", async (req, reply) => {
    const { userId } = req.params as { userId: string };
    const { asset, chain } = req.query as { asset?: string; chain?: string };
    if (!asset || !chain) return reply.code(400).send({ error: "MISSING_ASSET_OR_CHAIN" });
    return reply.send({ enabled: getYieldPref(userId, asset, chain) });
  });

  app.post("/v1/users/:userId/yield/open", async (req, reply) => {
    const { userId } = req.params as { userId: string };
    const parsed = OpenSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "INVALID_REQUEST", details: parsed.error.flatten() });
    try {
      const pos = openPosition(userId, parsed.data.asset, parsed.data.chain, parsed.data.principal);
      return reply.code(201).send(pos);
    } catch (e: any) {
      return reply.code(400).send({ error: e.message });
    }
  });

  app.post("/v1/users/:userId/yield/unwind/:positionId", async (req, reply) => {
    const { positionId } = req.params as { userId: string; positionId: string };
    try {
      const credited = unwindPosition(positionId);
      return reply.send({ ok: true, credited });
    } catch (e: any) {
      return reply.code(400).send({ error: e.message });
    }
  });
}
