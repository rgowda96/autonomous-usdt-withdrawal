import { randomUUID } from "node:crypto";
import { db, now } from "../db/index.js";
import type { Asset, Chain } from "../types.js";

// FIFO cost-basis ledger. Each acquisition (on-chain deposit, off-ramp credit,
// reward) is recorded as a "lot" with cost_inr_per_unit captured at the spot
// rate at the time of acquisition. Disposals (debits at settle, swap to a
// different asset) consume lots oldest-first and emit a realized_gains row.

export type Lot = {
  id: string;
  user_id: string;
  asset: Asset | string;
  chain: Chain | string;
  quantity: string;
  cost_inr_per_unit: string;
  remaining_quantity: string;
  acquired_at: number;
};

export function recordAcquisition(opts: {
  user_id: string;
  asset: string;
  chain: string;
  quantity: string;
  cost_inr_per_unit: string;
  acquired_at?: number;
}): Lot {
  const id = `lot_${randomUUID()}`;
  const t = opts.acquired_at ?? now();
  db().prepare(
    `INSERT INTO cost_basis_lots (id, user_id, asset, chain, quantity, cost_inr_per_unit,
      remaining_quantity, acquired_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(id, opts.user_id, opts.asset, opts.chain, opts.quantity, opts.cost_inr_per_unit, opts.quantity, t);
  return { id, user_id: opts.user_id, asset: opts.asset, chain: opts.chain, quantity: opts.quantity,
    cost_inr_per_unit: opts.cost_inr_per_unit, remaining_quantity: opts.quantity, acquired_at: t };
}

export type DisposalSummary = {
  quantity_sold: string;
  cost_basis_inr: number;
  proceeds_inr: number;
  gain_inr: number;
};

export function disposeFifo(opts: {
  user_id: string;
  asset: string;
  chain: string;
  quantity: string;        // asset-native
  proceeds_inr: number;    // total INR received
  transaction_id?: string;
}): DisposalSummary {
  let need = parseFloat(opts.quantity);
  let costBasisInr = 0;
  const lots = db().prepare(
    `SELECT * FROM cost_basis_lots
     WHERE user_id = ? AND asset = ? AND chain = ? AND CAST(remaining_quantity AS REAL) > 0
     ORDER BY acquired_at ASC`
  ).all(opts.user_id, opts.asset, opts.chain) as Lot[];

  for (const lot of lots) {
    if (need <= 0) break;
    const rem = parseFloat(lot.remaining_quantity);
    const consumed = Math.min(rem, need);
    costBasisInr += consumed * parseFloat(lot.cost_inr_per_unit);
    const newRem = (rem - consumed).toFixed(8);
    db().prepare(`UPDATE cost_basis_lots SET remaining_quantity = ? WHERE id = ?`).run(newRem, lot.id);
    need -= consumed;
  }

  // We tolerate residual `need` > 0 (untracked acquisitions get cost 0). v0 mock.
  const gain = opts.proceeds_inr - costBasisInr;
  db().prepare(
    `INSERT INTO realized_gains (user_id, transaction_id, asset, quantity_sold, proceeds_inr,
       cost_basis_inr, gain_inr, realized_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(opts.user_id, opts.transaction_id ?? null, opts.asset, opts.quantity,
        opts.proceeds_inr, Math.round(costBasisInr), Math.round(gain), now());

  return {
    quantity_sold: opts.quantity,
    cost_basis_inr: Math.round(costBasisInr),
    proceeds_inr: opts.proceeds_inr,
    gain_inr: Math.round(gain),
  };
}

// Estimate the tax under §115BBH (30% flat on crypto gains).
// Returns (gain, tax) in INR.
export function estimateCgTax(opts: {
  user_id: string;
  asset: string;
  chain: string;
  quantity: string;
  proceeds_inr: number;
}): { estimated_gain_inr: number; estimated_tax_inr: number } {
  let need = parseFloat(opts.quantity);
  let costBasisInr = 0;
  const lots = db().prepare(
    `SELECT cost_inr_per_unit, remaining_quantity FROM cost_basis_lots
     WHERE user_id = ? AND asset = ? AND chain = ? AND CAST(remaining_quantity AS REAL) > 0
     ORDER BY acquired_at ASC`
  ).all(opts.user_id, opts.asset, opts.chain) as { cost_inr_per_unit: string; remaining_quantity: string }[];
  for (const lot of lots) {
    if (need <= 0) break;
    const rem = parseFloat(lot.remaining_quantity);
    const consumed = Math.min(rem, need);
    costBasisInr += consumed * parseFloat(lot.cost_inr_per_unit);
    need -= consumed;
  }
  const gain = Math.max(0, Math.round(opts.proceeds_inr - costBasisInr));
  return {
    estimated_gain_inr: gain,
    estimated_tax_inr: Math.round(gain * 0.30),
  };
}

export function totalRealizedGain(userId: string, fyStartMs: number, fyEndMs: number): number {
  const r = db().prepare(
    `SELECT COALESCE(SUM(gain_inr), 0) AS g FROM realized_gains
     WHERE user_id = ? AND realized_at >= ? AND realized_at < ?`
  ).get(userId, fyStartMs, fyEndMs) as { g: number };
  return r.g;
}
