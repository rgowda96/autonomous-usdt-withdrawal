// Deposit watcher loop. Polls each chain adapter for incoming transfers to
// user smart-wallet addresses; credits the balance via creditDeposit.
// v0 uses the chain adapters' synthetic observeDeposit and the watcher is
// driven by either: (a) the in-process test harness, or (b) a hook from
// the off-chain bridge stub for cross-chain deposits.
// Real on-chain polling lands when PIMLICO_API_KEY arrives.

import { adapterFor, creditDeposit, type ChainName, type DepositEvent } from "./chain_adapters.js";
import { db, now } from "../db/index.js";
import { ensureSmartWallet } from "./wallet.js";
import { recordAcquisition } from "./cost_basis.js";
import { getReferenceRate } from "./rates.js";

const SUPPORTED_CHAINS: ChainName[] = ["base", "solana", "tron", "arbitrum"];
const SUPPORTED_ASSETS: Record<ChainName, string[]> = {
  base: ["USDC", "ETH"],
  solana: ["USDC", "SOL"],
  tron: ["USDT"],
  arbitrum: ["USDC", "ETH"],
  ethereum: ["USDC", "ETH"],
};

export type SeenDeposit = { tx_hash: string };
const SEEN: Set<string> = new Set();

export async function pollOnce(): Promise<{ credited: number }> {
  let credited = 0;
  // For each user with a smart wallet, scan each chain for deposits.
  const users = db().prepare(
    `SELECT id, smart_wallet_address FROM users WHERE smart_wallet_address IS NOT NULL`
  ).all() as { id: string; smart_wallet_address: string }[];

  for (const u of users) {
    for (const chain of SUPPORTED_CHAINS) {
      const sw = ensureSmartWallet(u.id, chain);
      for (const asset of SUPPORTED_ASSETS[chain] ?? []) {
        const events = await fetchChainDeposits(chain, sw.address, asset);
        for (const evt of events) {
          if (SEEN.has(evt.tx_hash)) continue;
          SEEN.add(evt.tx_hash);
          creditDeposit(u.id, evt);
          // Cost-basis acquisition at the current INR rate
          recordAcquisition({
            user_id: u.id,
            asset: evt.asset,
            chain: evt.chain,
            quantity: evt.amount,
            cost_inr_per_unit: String(getReferenceRate(evt.asset as any)),
            acquired_at: evt.observed_at,
          });
          credited++;
        }
      }
    }
  }
  return { credited };
}

// v0 stub: returns no events unless test harness has primed seedDeposit().
// Real version polls a public RPC / Pimlico's transaction feed for the
// configured address.
const TEST_PRIMED: DepositEvent[] = [];

async function fetchChainDeposits(chain: ChainName, address: string, asset: string): Promise<DepositEvent[]> {
  const matching = TEST_PRIMED.filter((e) => e.chain === chain && e.address === address && e.asset === asset);
  TEST_PRIMED.splice(0, TEST_PRIMED.length, ...TEST_PRIMED.filter((e) => !matching.includes(e)));
  return matching;
}

// Test seam: prime a deposit for the next poll.
export function _primeDeposit(chain: ChainName, address: string, asset: string, amount: string) {
  const evt = adapterFor(chain).observeDeposit({ address, asset, amount });
  TEST_PRIMED.push(evt);
}

let _started = false;
export function startDepositWatcher(intervalMs: number = 15_000) {
  if (_started) return;
  _started = true;
  setInterval(() => { pollOnce().catch(() => {}); }, intervalMs).unref?.();
}
