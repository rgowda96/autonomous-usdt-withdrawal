import type { FastifyInstance } from "fastify";
import { randomUUID } from "node:crypto";
import { db, now } from "../db/index.js";
import { setTxStatus } from "../services/ledger.js";
import { getOffRamp } from "../services/offramp.js";

export async function registerWebhookRoutes(app: FastifyInstance) {
  // Off-ramp partner webhook. Body: { event_id, event_type: "PAYOUT_SUCCESS"|"PAYOUT_FAILED",
  //                                    client_ref (quote_id), provider_ref, utr? }
  app.post("/v1/webhooks/offramp", async (req, reply) => {
    const sig = req.headers["x-signature"]?.toString() ?? "";
    const raw = JSON.stringify(req.body);
    if (!getOffRamp().verifyWebhook(raw, sig)) return reply.code(401).send({ error: "BAD_SIGNATURE" });

    const body = req.body as any;
    const eventId = body.event_id ?? randomUUID();

    // Dedup
    const seen = db().prepare(`SELECT id FROM webhook_events WHERE id = ?`).get(eventId);
    if (seen) return reply.send({ ok: true, dedup: true });

    const tx = db().prepare(`SELECT id FROM transactions WHERE quote_id = ?`).get(body.client_ref) as { id: string } | undefined;
    db().prepare(
      `INSERT INTO webhook_events (id, provider, event_type, transaction_id, payload, received_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(eventId, "offramp", body.event_type, tx?.id ?? null, raw, now());

    if (!tx) return reply.send({ ok: true, orphan: true });

    if (body.event_type === "PAYOUT_SUCCESS") {
      setTxStatus(tx.id, "SETTLED", { utr: body.utr }, { upi_utr: body.utr ?? null });
    } else if (body.event_type === "PAYOUT_FAILED") {
      setTxStatus(tx.id, "REFUND_PENDING", { reason: body.reason });
    }

    db().prepare(`UPDATE webhook_events SET processed_at = ? WHERE id = ?`).run(now(), eventId);
    return reply.send({ ok: true });
  });
}
