// Binance P2P spread feed. Pulls top USDT/INR sell ads and exposes the
// median price. Falls back to CoinGecko's USDT price when the P2P API is
// unreachable (CI / blocked egress / outage).

import { getReferenceRate } from "./rates.js";

type P2pCache = { price: number; spread_bps: number; fetchedAt: number; source: "binance_p2p" | "fallback" };

let cache: P2pCache | null = null;
const TTL_MS = 60_000;

const ENDPOINT = "https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search";

async function fetchBinanceP2p(): Promise<P2pCache | null> {
  const ctrl = new AbortController();
  const to = setTimeout(() => ctrl.abort(), 4000);
  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        asset: "USDT",
        fiat: "INR",
        tradeType: "SELL",
        page: 1,
        rows: 10,
        payTypes: ["UPI"],
      }),
      signal: ctrl.signal,
    });
    if (!res.ok) return null;
    const json = await res.json() as { data?: { adv?: { price?: string } }[] };
    const prices = (json.data ?? []).map((d) => parseFloat(d.adv?.price ?? "")).filter((p) => Number.isFinite(p) && p > 0);
    if (prices.length < 3) return null;
    prices.sort((a, b) => a - b);
    const median = prices[Math.floor(prices.length / 2)]!;
    const cg = getReferenceRate("USDT");
    const spread_bps = Math.round(((median - cg) / cg) * 10_000);
    return { price: median, spread_bps, fetchedAt: Date.now(), source: "binance_p2p" };
  } catch {
    return null;
  } finally {
    clearTimeout(to);
  }
}

export async function getP2pSpreadBps(): Promise<{ price_inr: number; spread_bps: number; source: string }> {
  if (cache && Date.now() - cache.fetchedAt < TTL_MS) {
    return { price_inr: cache.price, spread_bps: cache.spread_bps, source: cache.source };
  }
  const fresh = await fetchBinanceP2p();
  if (fresh) {
    cache = fresh;
    return { price_inr: fresh.price, spread_bps: fresh.spread_bps, source: "binance_p2p" };
  }
  const cgPrice = getReferenceRate("USDT");
  cache = { price: cgPrice, spread_bps: 0, fetchedAt: Date.now(), source: "fallback" };
  return { price_inr: cgPrice, spread_bps: 0, source: "fallback" };
}

export function _resetP2pCache() { cache = null; }
