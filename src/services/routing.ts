import type { Asset, AssetPreference, Chain, CostComponent, RoutePlan, RouteStep } from "../types.js";
import { quoteRate } from "./rates.js";
import { config } from "../config.js";
import { bestVenue } from "./slippage.js";
import { db } from "../db/index.js";

type Holding = { asset: Asset; chain: Chain; amount: number };

// Per-step fee model. Numbers tuned to real-world (Q2 2026) costs.
const SWAP_BPS: Record<Asset, number> = {
  USDC: 0, USDT: 10, ETH: 5, SOL: 8, BTC: 20, INR_CREDIT: 0,
};
const BRIDGE_BPS: Partial<Record<Chain, number>> = { tron: 15, ethereum: 5, solana: 5, arbitrum: 2, base: 0, internal: 0 };
const OFFRAMP_BPS = 50;
const TAX_DRAG_BPS_NON_STABLE = 3000; // 30% on assumed gain; user surface flag

type Scored = { plan: RoutePlan; score: number };

export function planRoute(
  holdings: Holding[],
  amountInr: number,
  preference: AssetPreference,
  vpa: string,
  userId?: string,
): RoutePlan {
  const candidates: Scored[] = [];

  // Explicit asset selection
  if (typeof preference === "object") {
    const h = holdings.find((x) => x.asset === preference.asset && x.chain === preference.chain);
    if (!h) throw new Error(`No balance: ${preference.asset} on ${preference.chain}`);
    candidates.push(buildPlan(h, amountInr, vpa));
  } else {
    const pool = preference === "hodl_mode"
      ? holdings.filter((h) => h.asset === "USDC" || h.asset === "USDT" || h.asset === "INR_CREDIT")
      : holdings;

    for (const h of pool) {
      try {
        candidates.push(buildPlan(h, amountInr, vpa));
      } catch {
        // skip insufficient
      }
    }
    if (candidates.length === 0) throw new Error("No spendable holding covers amount");
  }

  // Pick cheapest by total cost (fee + tax drag)
  candidates.sort((a, b) => a.score - b.score);

  // auto_tax_optimal mode: among candidates, prefer the asset with the
  // largest unrealized loss to harvest. Only kicks in when at least one
  // candidate has cost-basis data showing a loss > spread noise.
  if (preference === "auto_tax_optimal" && userId) {
    const LOSS_THRESHOLD_INR = 100; // ignore sub-₹100 losses (spread noise)
    const withGain = candidates.map((c) => ({ c, gain: estimateGainInr(userId, c.plan) }));
    withGain.sort((a, b) => a.gain - b.gain); // most-negative first
    const taxOptimal = withGain[0];
    if (taxOptimal && taxOptimal.gain < -LOSS_THRESHOLD_INR) return taxOptimal.c.plan;
  }

  return candidates[0]!.plan;
}

// Returns the estimated realized gain in INR (proceeds - cost basis at avg cost).
// Negative = loss. 0 if no cost-basis data or asset is INR_CREDIT.
function estimateGainInr(userId: string, plan: RoutePlan): number {
  if (plan.source_asset === "INR_CREDIT") return 0;
  const row = db().prepare(
    `SELECT AVG(CAST(cost_inr_per_unit AS REAL)) AS avg_cost
     FROM cost_basis_lots
     WHERE user_id = ? AND asset = ? AND chain = ? AND CAST(remaining_quantity AS REAL) > 0`
  ).get(userId, plan.source_asset, plan.source_chain) as { avg_cost: number | null };
  if (!row.avg_cost) return 0;
  const qty = parseFloat(plan.source_amount);
  const costBasis = qty * row.avg_cost;
  return plan.amount_inr - costBasis;
}

function buildPlan(h: Holding, amountInr: number, vpa: string): Scored {
  const rate = quoteRate(h.asset, config.SPREAD_BPS);
  const grossAssetAmount = amountInr / rate;
  if (grossAssetAmount > h.amount) throw new Error("insufficient");

  const steps: RouteStep[] = [];
  const breakdown: CostComponent[] = [];
  let feeBps = config.SPREAD_BPS;
  const inrFor = (bps: number) => Math.round((amountInr * bps) / 10_000 * 100) / 100;
  breakdown.push({ component: "Spread", bps: config.SPREAD_BPS, inr: inrFor(config.SPREAD_BPS) });

  // Bridge if not on settlement chain (base) and not internal INR
  if (h.asset !== "INR_CREDIT" && h.chain !== "base" && h.chain !== "internal") {
    const bps = BRIDGE_BPS[h.chain] ?? 20;
    steps.push({ kind: "bridge", from_chain: h.chain, to_chain: "base", venue: "lifi" });
    feeBps += bps;
    breakdown.push({ component: `Bridge ${h.chain}->base`, bps, inr: inrFor(bps) });
  }

  // Swap to USDC if not already a stable
  if (h.asset !== "USDC" && h.asset !== "USDT" && h.asset !== "INR_CREDIT") {
    const picked = bestVenue(h.asset, amountInr);
    steps.push({ kind: "swap", from: h.asset, to: "USDC", venue: picked.venue, est_slippage_bps: picked.est_bps });
    feeBps += picked.est_bps;
    breakdown.push({ component: `Swap ${h.asset}->USDC (${picked.venue})`, bps: picked.est_bps, inr: inrFor(picked.est_bps) });
  }

  // Off-ramp (skip if INR_CREDIT already INR)
  if (h.asset !== "INR_CREDIT") {
    steps.push({ kind: "offramp", provider: config.OFFRAMP_PROVIDER, fee_bps: OFFRAMP_BPS });
    feeBps += OFFRAMP_BPS;
    breakdown.push({ component: `Off-ramp (${config.OFFRAMP_PROVIDER})`, bps: OFFRAMP_BPS, inr: inrFor(OFFRAMP_BPS) });
  } else {
    feeBps += 10; // UPI rail only
    breakdown.push({ component: "UPI rail", bps: 10, inr: inrFor(10) });
  }

  // UPI payout
  steps.push({ kind: "upi_payout", vpa });

  const tdsInr = h.asset === "INR_CREDIT" ? 0 : Math.ceil(amountInr * (config.TDS_RATE_BPS / 10_000));

  const taxDrag = (h.asset === "BTC" || h.asset === "ETH" || h.asset === "SOL") ? TAX_DRAG_BPS_NON_STABLE : 0;

  const plan: RoutePlan = {
    source_asset: h.asset,
    source_chain: h.chain,
    source_amount: grossAssetAmount.toFixed(8),
    steps,
    total_fee_bps: feeBps,
    tds_inr: tdsInr,
    amount_inr: amountInr,
    cost_breakdown: breakdown,
  };

  return { plan, score: feeBps + taxDrag };
}
