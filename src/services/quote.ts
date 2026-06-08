import { randomUUID } from "node:crypto";
import { db, now } from "../db/index.js";
import { config } from "../config.js";
import type { Asset, Chain, QuoteRequest, RoutePlan } from "../types.js";
import { planRoute } from "./routing.js";
import { quoteRate } from "./rates.js";

export type QuoteRecord = {
  id: string;
  user_id: string;
  amount_inr: number;
  route_plan: RoutePlan;
  rate_inr_per_unit: string;
  expires_at: number;
};

export function createQuote(req: QuoteRequest): QuoteRecord {
  // Idempotency: return existing if seen
  const existing = db().prepare(`SELECT * FROM quotes WHERE idempotency_key = ?`).get(req.idempotency_key) as any;
  if (existing) {
    return {
      id: existing.id,
      user_id: existing.user_id,
      amount_inr: existing.amount_inr,
      route_plan: JSON.parse(existing.route_plan),
      rate_inr_per_unit: existing.rate_inr_per_unit,
      expires_at: existing.expires_at,
    };
  }

  // Load user holdings
  const holdings = db().prepare(
    `SELECT asset, chain, amount FROM balances WHERE user_id = ?`
  ).all(req.user_id) as { asset: Asset; chain: Chain; amount: string }[];

  const holdingsParsed = holdings.map((h) => ({ asset: h.asset, chain: h.chain, amount: Number(h.amount) }));

  const vpa = req.payee.type === "vpa" ? req.payee.identifier : `agent:${req.payee.identifier}`;
  const plan = planRoute(holdingsParsed, req.amount_inr, req.asset_preference, vpa);
  const rate = quoteRate(plan.source_asset, config.SPREAD_BPS);

  const id = `q_${randomUUID()}`;
  const expiresAt = now() + config.QUOTE_TTL_SECONDS * 1000;

  db().prepare(
    `INSERT INTO quotes (id, user_id, idempotency_key, payee_type, payee_identifier, payee_display,
                         amount_inr, channel, route_plan, rate_inr_per_unit, expires_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id, req.user_id, req.idempotency_key,
    req.payee.type, req.payee.identifier, req.payee.display_name ?? null,
    req.amount_inr, req.channel,
    JSON.stringify(plan),
    rate.toFixed(8),
    expiresAt, now(),
  );

  return { id, user_id: req.user_id, amount_inr: req.amount_inr, route_plan: plan, rate_inr_per_unit: rate.toFixed(8), expires_at: expiresAt };
}

export function getQuote(id: string): QuoteRecord | null {
  const row = db().prepare(`SELECT * FROM quotes WHERE id = ?`).get(id) as any;
  if (!row) return null;
  return {
    id: row.id,
    user_id: row.user_id,
    amount_inr: row.amount_inr,
    route_plan: JSON.parse(row.route_plan),
    rate_inr_per_unit: row.rate_inr_per_unit,
    expires_at: row.expires_at,
  };
}
