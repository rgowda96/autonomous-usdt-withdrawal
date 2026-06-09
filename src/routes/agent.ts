import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { createQuote } from "../services/quote.js";
import { settle } from "../services/settle.js";
import { checkPolicy, logUsage, notify, resolveSessionKey } from "../services/session_keys.js";

const PayUpiSchema = z.object({
  vpa: z.string().min(3),
  amount_inr: z.number().int().positive().max(100_000),
  note: z.string().max(280).optional(),
  idempotency_key: z.string().uuid().optional(),
});

export async function registerAgentRoutes(app: FastifyInstance) {
  app.post("/v1/agent/pay-upi", async (req, reply) => {
    const auth = req.headers.authorization;
    const token = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
    if (!token) return reply.code(401).send({ error: "MISSING_BEARER" });
    const sk = resolveSessionKey(token);
    if (!sk) return reply.code(401).send({ error: "INVALID_TOKEN" });

    const parsed = PayUpiSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "INVALID_REQUEST", details: parsed.error.flatten() });
    const { vpa, amount_inr } = parsed.data;

    const policy = checkPolicy(sk, vpa, amount_inr);
    if (!policy.allowed) {
      const outcome = ({
        REVOKED: "REJECTED_REVOKED",
        EXPIRED: "REJECTED_EXPIRED",
        PER_TXN_CAP: "REJECTED_CAP",
        DAILY_CAP: "REJECTED_CAP",
        VPA_NOT_ALLOWED: "REJECTED_ALLOWLIST",
      } as const)[policy.reason];
      logUsage({ session_key_id: sk.id, transaction_id: null, amount_inr, vpa, outcome });
      notify({
        user_id: sk.user_id,
        kind: "agent_rejected",
        title: `Agent payment blocked: ${policy.reason}`,
        body: `${sk.label} tried to pay ₹${amount_inr} to ${vpa}`,
        ref_id: sk.id,
      });
      return reply.code(403).send({ error: "POLICY_DENIED", reason: policy.reason });
    }

    try {
      const idem = parsed.data.idempotency_key ?? randomUUID();
      const quote = createQuote({
        idempotency_key: idem,
        user_id: sk.user_id,
        payee: { type: "vpa", identifier: vpa },
        amount_inr,
        channel: "agent",
        asset_preference: "auto_cheapest",
      });
      const result = await settle({
        idempotency_key: randomUUID(),
        quote_id: quote.id,
        auth_proof: `session-key:${sk.id}`,
      });
      logUsage({ session_key_id: sk.id, transaction_id: result.transaction_id, amount_inr, vpa, outcome: "ALLOWED" });
      notify({
        user_id: sk.user_id,
        kind: "agent_payment",
        title: `Agent paid ₹${amount_inr} to ${vpa}`,
        body: `${sk.label} · ${result.transaction_id}`,
        ref_id: result.transaction_id,
      });
      return reply.send({
        transaction_id: result.transaction_id,
        status: result.status,
        source_asset: quote.route_plan.source_asset,
        total_fee_bps: quote.route_plan.total_fee_bps,
        tds_inr: quote.route_plan.tds_inr,
      });
    } catch (e: any) {
      return reply.code(400).send({ error: e.message ?? "AGENT_PAY_FAILED" });
    }
  });

  app.get("/v1/agent/whoami", async (req, reply) => {
    const auth = req.headers.authorization;
    const token = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
    if (!token) return reply.code(401).send({ error: "MISSING_BEARER" });
    const sk = resolveSessionKey(token);
    if (!sk) return reply.code(401).send({ error: "INVALID_TOKEN" });
    return reply.send({
      session_key_id: sk.id,
      user_id: sk.user_id,
      label: sk.label,
      daily_cap_inr: sk.daily_cap_inr,
      per_txn_cap_inr: sk.per_txn_cap_inr,
      vpa_allowlist: sk.vpa_allowlist,
      expires_at: sk.expires_at,
      revoked: !!sk.revoked_at,
    });
  });
}
