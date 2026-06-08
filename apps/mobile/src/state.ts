import { useCallback, useEffect, useState } from "react";
import { api, type Transaction } from "./api";

export type Balance = { asset: string; chain: string; amount: string };

export function useBalances() {
  const [balances, setBalances] = useState<Balance[]>([]);
  const refresh = useCallback(async () => {
    try {
      const r = await api.balances();
      setBalances(r.balances ?? []);
    } catch {}
  }, []);
  useEffect(() => { refresh(); }, [refresh]);
  return { balances, refresh };
}

export function useTransactions() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const refresh = useCallback(async () => {
    try {
      const r = await api.transactions();
      setTransactions(r.transactions ?? []);
    } catch {}
  }, []);
  useEffect(() => { refresh(); }, [refresh]);
  return { transactions, refresh };
}

const RATES: Record<string, number> = {
  USDC: 95.00, USDT: 94.85, ETH: 235000, SOL: 14500, BTC: 5800000, INR_CREDIT: 1.0,
};

export function balanceInr(b: Balance): number {
  const r = RATES[b.asset] ?? 0;
  return Math.round(Number(b.amount) * r);
}

export function totalInr(bs: Balance[]): number {
  return bs.reduce((s, b) => s + balanceInr(b), 0);
}
