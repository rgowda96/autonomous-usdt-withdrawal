// Per-venue slippage estimator. v0 uses tabular bps per
// (asset, venue, notional_inr). Real version pulls from 1inch / Jupiter
// quote endpoints at quote time. The current routing engine already
// pulls a swap-bps figure from this table when the source asset is
// non-stable.

import type { Asset } from "../types.js";

type Venue = "1inch" | "jupiter" | "uniswap_v4" | "lifi";

const TABLE: Record<Venue, Partial<Record<Asset, (notionalInr: number) => number>>> = {
  "1inch": {
    ETH: (n) => Math.min(40, 5 + Math.floor(n / 50_000) * 2),
    BTC: (n) => Math.min(60, 20 + Math.floor(n / 100_000) * 3),
    SOL: (n) => Math.min(40, 8 + Math.floor(n / 50_000) * 2),
    USDT: () => 10,
  },
  jupiter: {
    SOL: (n) => Math.min(30, 5 + Math.floor(n / 50_000) * 2),
    USDT: () => 8,
    USDC: () => 5,
  },
  uniswap_v4: {
    ETH: (n) => Math.min(35, 4 + Math.floor(n / 50_000) * 2),
    USDC: () => 4,
  },
  lifi: {
    USDC: () => 3,
    USDT: () => 5,
  },
};

export function estimateSwapBps(asset: Asset, venue: Venue, notionalInr: number): number {
  const fn = TABLE[venue]?.[asset];
  if (!fn) return 25; // sensible default
  return fn(notionalInr);
}

export function bestVenue(asset: Asset, notionalInr: number): { venue: Venue; est_bps: number } {
  const candidates: { venue: Venue; est_bps: number }[] = (Object.keys(TABLE) as Venue[])
    .map((v) => ({ venue: v, est_bps: estimateSwapBps(asset, v, notionalInr) }));
  candidates.sort((a, b) => a.est_bps - b.est_bps);
  return candidates[0]!;
}
