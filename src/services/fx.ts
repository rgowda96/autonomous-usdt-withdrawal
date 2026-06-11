// FX transparency engine — the core RedotPay differentiator.
//
// RedotPay's flaw: when a user spends a USD-denominated stablecoin online,
// RedotPay internally values it at ~84 INR/USD when the mid-market rate is
// ~95 — an opaque ~11% haircut buried across "conversion", "FX markup", and
// cross-border interchange. The user observes "$1 = 84 INR" and never sees
// where the other 11 INR went.
//
// StablePay fix: bill USD purchases at the live mid-market rate minus ONE
// disclosed, thin spread (default 60 bps). Every quote shows the mid-market
// rate, our effective rate, the fee in rupees, AND the RedotPay-equivalent
// cost so the user sees exactly what they saved.

import { getReferenceRate } from "./rates.js";
import { config } from "../config.js";

// USDC is our USD proxy: 1 USDC == 1 USD. getReferenceRate("USDC") returns
// the live USDC/INR (≈ USD/INR mid-market) from CoinGecko.
export function midMarketUsdInr(): number {
  return getReferenceRate("USDC");
}

// RedotPay's observed effective rate. Empirically ~84 vs ~95 mid-market
// (≈ 11.5% all-in haircut). Configurable so the comparison stays honest if
// their pricing changes; sourced from REDOTPAY_EFFECTIVE_HAIRCUT_BPS.
const REDOTPAY_HAIRCUT_BPS = 1150;

export type FxQuote = {
  usd_amount: number;
  mid_market_inr_per_usd: number;
  our_inr_per_usd: number;        // what the user effectively gets
  our_spread_bps: number;
  our_inr_total: number;          // INR value of the purchase to the user
  our_fee_inr: number;            // the disclosed spread, in INR
  redotpay_inr_per_usd: number;
  redotpay_inr_total: number;
  you_save_inr: number;
  you_save_pct: number;
};

// Spread in bps applied to USD online purchases. Thin + disclosed.
// Default 60 bps (0.60%) vs RedotPay's ~1150 bps effective.
export function onlineSpreadBps(): number {
  const v = Number(process.env.ONLINE_SPREAD_BPS);
  return Number.isFinite(v) && v >= 0 ? v : 60;
}

function redotpayHaircutBps(): number {
  const v = Number(process.env.REDOTPAY_EFFECTIVE_HAIRCUT_BPS);
  return Number.isFinite(v) && v >= 0 ? v : REDOTPAY_HAIRCUT_BPS;
}

export function quoteUsdPurchase(usdAmount: number, spreadBpsOverride?: number): FxQuote {
  if (!(usdAmount > 0)) throw new Error("usd_amount must be positive");
  const mid = midMarketUsdInr();
  const spreadBps = spreadBpsOverride ?? onlineSpreadBps();

  // Our effective rate: user spends slightly MORE INR-of-value per USD billed,
  // i.e. the rate they receive is mid * (1 - spread). Lower rate = they give
  // up a hair of value. We bill the merchant the full USD; the spread is our
  // margin. We model "INR value parted with" as mid (true cost) and the fee
  // as the spread on top, so total = mid * usd * (1 + spread).
  const ourRate = mid * (1 - spreadBps / 10_000);
  const midTotal = round2(mid * usdAmount);
  const ourTotal = round2(mid * usdAmount * (1 + spreadBps / 10_000));
  const ourFee = round2(ourTotal - midTotal);

  const redotRate = mid * (1 - redotpayHaircutBps() / 10_000);
  // What the user effectively pays via RedotPay for the same USD purchase:
  // they part with mid * usd of value but only get redotRate * usd of goods,
  // so their effective INR cost is mid * usd * (1 + haircut).
  const redotTotal = round2(mid * usdAmount * (1 + redotpayHaircutBps() / 10_000));

  const save = round2(redotTotal - ourTotal);
  const savePct = redotTotal > 0 ? round2((save / redotTotal) * 100) : 0;

  return {
    usd_amount: usdAmount,
    mid_market_inr_per_usd: round2(mid),
    our_inr_per_usd: round2(ourRate),
    our_spread_bps: spreadBps,
    our_inr_total: ourTotal,
    our_fee_inr: ourFee,
    redotpay_inr_per_usd: round2(redotRate),
    redotpay_inr_total: redotTotal,
    you_save_inr: save,
    you_save_pct: savePct,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// Aggregate lifetime savings vs RedotPay for a user (sum of you_save_inr
// captured at charge time). Stored on each online_purchase row.
export function effectiveRateLabel(q: FxQuote): string {
  return `₹${q.our_inr_per_usd.toFixed(2)}/$ vs RedotPay ₹${q.redotpay_inr_per_usd.toFixed(2)}/$`;
}

export const _tdsRateBps = config.TDS_RATE_BPS;
