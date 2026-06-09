import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { getKycStatus, submitKyc } from "../services/kyc.js";
import { fiuIndDailyReport, freezeUser, isFrozen, screenAndAutoFreeze } from "../services/kyt.js";

const KycSchema = z.object({
  document_type: z.enum(["aadhaar", "pan", "passport"]),
  document_number: z.string().min(4).max(50),
  full_name: z.string().min(1).max(200),
  date_of_birth: z.string(),
});

const KytSchema = z.object({
  address: z.string().min(4),
  chain: z.string().min(2),
});

export async function registerComplianceRoutes(app: FastifyInstance) {
  app.post("/v1/users/:userId/kyc", async (req, reply) => {
    const { userId } = req.params as { userId: string };
    const parsed = KycSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "INVALID_REQUEST", details: parsed.error.flatten() });
    const r = submitKyc({ user_id: userId, ...parsed.data });
    return reply.code(201).send(r);
  });

  app.get("/v1/users/:userId/kyc", async (req, reply) => {
    const { userId } = req.params as { userId: string };
    const r = getKycStatus(userId);
    if (!r) return reply.code(404).send({ error: "NO_KYC" });
    return reply.send(r);
  });

  app.post("/v1/users/:userId/kyt", async (req, reply) => {
    const { userId } = req.params as { userId: string };
    const parsed = KytSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "INVALID_REQUEST", details: parsed.error.flatten() });
    const r = screenAndAutoFreeze(parsed.data.address, parsed.data.chain, userId);
    return reply.send({ ...r, frozen: isFrozen(userId) });
  });

  app.get("/v1/users/:userId/freeze", async (req, reply) => {
    const { userId } = req.params as { userId: string };
    return reply.send({ user_id: userId, frozen: isFrozen(userId) });
  });

  app.post("/v1/users/:userId/freeze", async (req, reply) => {
    const { userId } = req.params as { userId: string };
    const body = req.body as { reason?: string };
    freezeUser(userId, body.reason ?? "manual", "manual");
    return reply.code(201).send({ ok: true });
  });

  app.get("/v1/compliance/fiu-ind-report", async (req, reply) => {
    const { date } = req.query as { date?: string };
    const d = date ? new Date(date) : new Date();
    if (Number.isNaN(d.getTime())) return reply.code(400).send({ error: "INVALID_DATE" });
    reply.type("text/csv");
    return reply.send(fiuIndDailyReport(d));
  });
}
