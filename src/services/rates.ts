import type { Asset } from "../types.js";

// CoinGecko free-tier mapping (no auth required).
const CG_ID: Record<Asset, string | null> = {
  USDC: "usd-coin",
  USDT: "tether",
  ETH: "ethereum",
  SOL: "solana",
  BTC: "bitcoin",
  INR_CREDIT: null,
};

// Reference fallback rates if the network is unreachable.
const FALLBACK_INR: Record<Asset, number> = {
  USDC: 95.00,
  USDT: 94.85,
  ETH: 235000,
  SOL: 14500,
  BTC: 5800000,
  INR_CREDIT: 1.00,
};

type CachedRate = { inrPerUnit: number; fetchedAt: number; source: "live" | "fallback" };
const cache = new Map<Asset, CachedRate>();
const TTL_MS = 30_000;

async function fetchCoinGecko(assets: Asset[]): Promise<Partial<Record<Asset, number>>> {
  const ids = assets.map((a) => CG_ID[a]).filter((x): x is string => !!x);
  if (ids.length === 0) return {};
  const url = `https://api.coingecko.com/api/v3/simple/price?ids=${ids.join(",")}&vs_currencies=inr`;
  const ctrl = new AbortController();
  const to = setTimeout(() => ctrl.abort(), 3000);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) return {};
    const json = await res.json() as Record<string, { inr?: number }>;
    const out: Partial<Record<Asset, number>> = {};
    for (const a of assets) {
      const id = CG_ID[a];
      if (id && json[id]?.inr) out[a] = json[id].inr;
    }
    return out;
  } catch {
    return {};
  } finally {
    clearTimeout(to);
  }
}

async function refresh(asset: Asset): Promise<CachedRate> {
  if (asset === "INR_CREDIT") {
    const r: CachedRate = { inrPerUnit: 1, fetchedAt: Date.now(), source: "live" };
    cache.set(asset, r);
    return r;
  }
  const live = await fetchCoinGecko([asset]);
  const v = live[asset];
  if (v) {
    const r: CachedRate = { inrPerUnit: v, fetchedAt: Date.now(), source: "live" };
    cache.set(asset, r);
    return r;
  }
  const r: CachedRate = { inrPerUnit: FALLBACK_INR[asset], fetchedAt: Date.now(), source: "fallback" };
  cache.set(asset, r);
  return r;
}

export async function getReferenceRateAsync(asset: Asset): Promise<number> {
  const c = cache.get(asset);
  if (c && Date.now() - c.fetchedAt < TTL_MS) return c.inrPerUnit;
  const r = await refresh(asset);
  return r.inrPerUnit;
}

// Sync version uses cached or fallback. Used by routing engine where async is awkward.
export function getReferenceRate(asset: Asset): number {
  const c = cache.get(asset);
  if (c) return c.inrPerUnit;
  return FALLBACK_INR[asset];
}

export function quoteRate(asset: Asset, spreadBps: number): number {
  const ref = getReferenceRate(asset);
  return ref * (1 - spreadBps / 10_000);
}

// Background warmer: kicks off async refresh of common assets at boot.
export function warmRates(): void {
  void Promise.all((Object.keys(CG_ID) as Asset[]).map((a) => refresh(a)));
}

// Test-only state reset
export function _resetRateCache() {
  cache.clear();
}
