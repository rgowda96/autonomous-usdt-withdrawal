import { randomUUID } from "node:crypto";
import { db, now } from "../db/index.js";

// Aave V3 stub: real integration in Phase F when Pimlico key arrives.
// For v0 we accrue yield linearly at a fixed APY so the routing engine and
// UI behave correctly.

const ASSET_APY_BPS: Record<string, number> = {
  USDC: 500, // 5%
  USDT: 480, // 4.8%
};

const DEFAULT_VENUE = "aave_v3_base_sepolia";

export type YieldPosition = {
  id: string;
  user_id: string;
  asset: string;
  chain: string;
  venue: string;
  principal: string;
  current_value: string;
  apy_bps: number;
  opened_at: number;
  updated_at: number;
  closed_at: number | null;
};

export function setYieldPref(userId: string, asset: string, chain: string, enabled: boolean) {
  db().prepare(
    `INSERT INTO yield_prefs (user_id, asset, chain, enabled, updated_at) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT (user_id, asset, chain) DO UPDATE SET enabled = excluded.enabled, updated_at = excluded.updated_at`
  ).run(userId, asset, chain, enabled ? 1 : 0, now());
}

export function getYieldPref(userId: string, asset: string, chain: string): boolean {
  const r = db().prepare(`SELECT enabled FROM yield_prefs WHERE user_id = ? AND asset = ? AND chain = ?`)
    .get(userId, asset, chain) as { enabled: number } | undefined;
  return !!r?.enabled;
}

// Open a position by moving from balances -> yield_positions.
export function openPosition(userId: string, asset: string, chain: string, principal: string, apyBps?: number): YieldPosition {
  const apy = apyBps ?? ASSET_APY_BPS[asset] ?? 0;
  if (apy === 0) throw new Error(`Asset ${asset} not yield-supported`);

  const id = `ypos_${randomUUID()}`;
  const t = now();
  db().transaction(() => {
    // Debit balance
    const balRow = db().prepare(`SELECT amount FROM balances WHERE user_id = ? AND asset = ? AND chain = ?`)
      .get(userId, asset, chain) as { amount: string } | undefined;
    if (!balRow) throw new Error("NO_BALANCE");
    const have = parseFloat(balRow.amount);
    const want = parseFloat(principal);
    if (have < want) throw new Error("INSUFFICIENT_BALANCE");
    db().prepare(`UPDATE balances SET amount = ?, updated_at = ? WHERE user_id = ? AND asset = ? AND chain = ?`)
      .run((have - want).toFixed(8), t, userId, asset, chain);

    db().prepare(
      `INSERT INTO yield_positions (id, user_id, asset, chain, venue, principal, current_value,
        apy_bps, opened_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(id, userId, asset, chain, DEFAULT_VENUE, principal, principal, apy, t, t);
  })();

  return { id, user_id: userId, asset, chain, venue: DEFAULT_VENUE, principal, current_value: principal, apy_bps: apy, opened_at: t, updated_at: t, closed_at: null };
}

// JIT unwind: close position and credit current_value back to balances.
// Returns the amount credited back.
export function unwindPosition(positionId: string): string {
  const pos = db().prepare(`SELECT * FROM yield_positions WHERE id = ? AND closed_at IS NULL`).get(positionId) as YieldPosition | undefined;
  if (!pos) throw new Error("POSITION_NOT_FOUND");
  accruePosition(positionId);
  const refreshed = db().prepare(`SELECT * FROM yield_positions WHERE id = ?`).get(positionId) as YieldPosition;
  const t = now();
  db().transaction(() => {
    db().prepare(`UPDATE yield_positions SET closed_at = ?, updated_at = ? WHERE id = ?`).run(t, t, positionId);
    const balRow = db().prepare(`SELECT amount FROM balances WHERE user_id = ? AND asset = ? AND chain = ?`)
      .get(refreshed.user_id, refreshed.asset, refreshed.chain) as { amount: string } | undefined;
    const current = balRow ? parseFloat(balRow.amount) : 0;
    const credit = parseFloat(refreshed.current_value);
    const newAmount = (current + credit).toFixed(8);
    if (balRow) {
      db().prepare(`UPDATE balances SET amount = ?, updated_at = ? WHERE user_id = ? AND asset = ? AND chain = ?`)
        .run(newAmount, t, refreshed.user_id, refreshed.asset, refreshed.chain);
    } else {
      db().prepare(`INSERT INTO balances (user_id, asset, chain, amount, updated_at) VALUES (?, ?, ?, ?, ?)`)
        .run(refreshed.user_id, refreshed.asset, refreshed.chain, newAmount, t);
    }
  })();
  return refreshed.current_value;
}

// Accrue interest into current_value based on elapsed time since updated_at.
export function accruePosition(positionId: string): void {
  const pos = db().prepare(`SELECT * FROM yield_positions WHERE id = ? AND closed_at IS NULL`).get(positionId) as YieldPosition | undefined;
  if (!pos) return;
  const t = now();
  const elapsed_ms = t - pos.updated_at;
  if (elapsed_ms <= 0) return;
  const years = elapsed_ms / (365 * 24 * 60 * 60 * 1000);
  const principal = parseFloat(pos.current_value);
  const apy = pos.apy_bps / 10_000;
  const accrued = principal * apy * years;
  const newVal = (principal + accrued).toFixed(8);
  db().prepare(`UPDATE yield_positions SET current_value = ?, updated_at = ? WHERE id = ?`)
    .run(newVal, t, positionId);
}

export function listOpenPositions(userId: string): YieldPosition[] {
  return db().prepare(
    `SELECT * FROM yield_positions WHERE user_id = ? AND closed_at IS NULL ORDER BY opened_at DESC`
  ).all(userId) as YieldPosition[];
}

// Daily APY snapshot job (runs from cron at boot).
let _snapshotStarted = false;
export function startDailyYieldSnapshot(intervalMs: number = 24 * 60 * 60 * 1000) {
  if (_snapshotStarted) return;
  _snapshotStarted = true;
  const tick = () => {
    try {
      const positions = db().prepare(`SELECT id, current_value, apy_bps FROM yield_positions WHERE closed_at IS NULL`).all() as { id: string; current_value: string; apy_bps: number }[];
      for (const p of positions) {
        accruePosition(p.id);
        const fresh = db().prepare(`SELECT current_value FROM yield_positions WHERE id = ?`).get(p.id) as { current_value: string };
        db().prepare(`INSERT INTO yield_snapshots (position_id, value, apy_bps, taken_at) VALUES (?, ?, ?, ?)`)
          .run(p.id, fresh.current_value, p.apy_bps, now());
      }
    } catch {
      // best-effort
    }
  };
  setInterval(tick, intervalMs).unref?.();
  tick();
}
