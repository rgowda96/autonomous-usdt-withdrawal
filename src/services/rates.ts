import type { Asset } from "../types.js";

// v0: hard-coded reference rates. v1 will pull from CoinGecko/Coinbase + P2P feeds.
// Rates are INR per 1 unit of asset.
const REFERENCE_RATES: Record<Asset, number> = {
  USDC: 95.00,
  USDT: 94.85,
  ETH: 235000.00,
  SOL: 14500.00,
  BTC: 5800000.00,
  INR_CREDIT: 1.00,
};

export function getReferenceRate(asset: Asset): number {
  return REFERENCE_RATES[asset];
}

// inrPerUnit after applying our spread (bps off the user's favor)
export function quoteRate(asset: Asset, spreadBps: number): number {
  const ref = getReferenceRate(asset);
  return ref * (1 - spreadBps / 10_000);
}
