// Chain adapter abstraction. Each chain implements:
// - generateAddress(): deterministic test address for fixture seeding
// - watchDeposits(callback): polling stub for deposit detection
// - broadcastTransfer(from, to, asset, amount): stub for outbound moves
// - LIFI-like cross-chain quote() for the routing engine

import { createHash } from "node:crypto";
import { db, now } from "../db/index.js";

export type ChainName = "base" | "solana" | "tron" | "ethereum" | "arbitrum";

export type DepositEvent = {
  chain: ChainName;
  address: string;
  asset: string;
  amount: string;     // decimal string
  tx_hash: string;
  block: number;
  observed_at: number;
};

export type BridgeQuote = {
  from_chain: ChainName;
  to_chain: ChainName;
  asset: string;
  amount: string;
  est_fee_bps: number;
  est_latency_seconds: number;
  venue: string;
};

export interface ChainAdapter {
  name: ChainName;
  generateAddress(userId: string): string;
  // simulate broadcast; returns synthetic tx hash
  broadcastTransfer(opts: { from: string; to: string; asset: string; amount: string }): Promise<{ tx_hash: string }>;
  // Test seam: synthesize a "deposit observed" event so routing tests can run
  observeDeposit(opts: { address: string; asset: string; amount: string }): DepositEvent;
}

abstract class BaseAdapter implements ChainAdapter {
  abstract name: ChainName;
  abstract prefix: string;

  generateAddress(userId: string): string {
    const h = createHash("sha256").update(`${this.name}|${userId}`).digest("hex");
    return this.prefix + h.slice(0, this.name === "solana" ? 40 : 38);
  }

  async broadcastTransfer(opts: { from: string; to: string; asset: string; amount: string }): Promise<{ tx_hash: string }> {
    const h = createHash("sha256").update(`${this.name}|${opts.from}|${opts.to}|${opts.asset}|${opts.amount}|${now()}`).digest("hex");
    return { tx_hash: this.prefix + h.slice(0, 60) };
  }

  observeDeposit(opts: { address: string; asset: string; amount: string }): DepositEvent {
    const tx_hash = this.prefix + createHash("sha256").update(`dep|${opts.address}|${now()}`).digest("hex").slice(0, 60);
    return {
      chain: this.name,
      address: opts.address,
      asset: opts.asset,
      amount: opts.amount,
      tx_hash,
      block: Math.floor(now() / 12000),
      observed_at: now(),
    };
  }
}

export class BaseChainAdapter extends BaseAdapter { name: ChainName = "base"; prefix = "0x"; }
export class SolanaAdapter extends BaseAdapter { name: ChainName = "solana"; prefix = ""; }
export class TronAdapter extends BaseAdapter { name: ChainName = "tron"; prefix = "T"; }
export class EthereumAdapter extends BaseAdapter { name: ChainName = "ethereum"; prefix = "0x"; }
export class ArbitrumAdapter extends BaseAdapter { name: ChainName = "arbitrum"; prefix = "0x"; }

const REGISTRY: Record<ChainName, ChainAdapter> = {
  base: new BaseChainAdapter(),
  solana: new SolanaAdapter(),
  tron: new TronAdapter(),
  ethereum: new EthereumAdapter(),
  arbitrum: new ArbitrumAdapter(),
};

export function adapterFor(chain: ChainName): ChainAdapter {
  return REGISTRY[chain];
}

// Bridge quote stub. Settlement chain is Base. From Solana / Tron / Ethereum
// / Arbitrum, modelled as LI.FI-shaped: 0-20 bps per chain + 30s latency.
const BRIDGE_FEE_BPS: Record<ChainName, number> = { base: 0, solana: 5, tron: 15, ethereum: 5, arbitrum: 2 };
const BRIDGE_LATENCY: Record<ChainName, number> = { base: 0, solana: 25, tron: 90, ethereum: 600, arbitrum: 30 };

export function bridgeQuote(from: ChainName, to: ChainName, asset: string, amount: string): BridgeQuote {
  if (from === to) {
    return { from_chain: from, to_chain: to, asset, amount, est_fee_bps: 0, est_latency_seconds: 0, venue: "noop" };
  }
  return {
    from_chain: from,
    to_chain: to,
    asset,
    amount,
    est_fee_bps: BRIDGE_FEE_BPS[from] + BRIDGE_FEE_BPS[to],
    est_latency_seconds: BRIDGE_LATENCY[from] + BRIDGE_LATENCY[to],
    venue: "lifi",
  };
}

// Credit a balance based on an observed deposit. Used by the deposit watcher
// loop (real version polls each chain; the mock fires synchronously for tests).
export function creditDeposit(userId: string, evt: DepositEvent) {
  const cur = db().prepare(`SELECT amount FROM balances WHERE user_id = ? AND asset = ? AND chain = ?`)
    .get(userId, evt.asset, evt.chain) as { amount: string } | undefined;
  const next = ((cur ? parseFloat(cur.amount) : 0) + parseFloat(evt.amount)).toFixed(8);
  if (cur) {
    db().prepare(`UPDATE balances SET amount = ?, updated_at = ? WHERE user_id = ? AND asset = ? AND chain = ?`)
      .run(next, now(), userId, evt.asset, evt.chain);
  } else {
    db().prepare(`INSERT INTO balances (user_id, asset, chain, amount, updated_at) VALUES (?, ?, ?, ?, ?)`)
      .run(userId, evt.asset, evt.chain, next, now());
  }
}
