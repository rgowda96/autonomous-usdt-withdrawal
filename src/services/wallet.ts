// ERC-4337 smart wallet stub. The real version uses Privy + Pimlico bundler
// to build UserOps, sign with passkeys, and broadcast on Base Sepolia.
// In v0 we model the wallet shape so the rest of the system can hold a stable
// address per user; on-chain wiring lands when PIMLICO_API_KEY arrives.

import { createHash } from "node:crypto";
import { db, now } from "../db/index.js";
import { adapterFor, type ChainName } from "./chain_adapters.js";

export type SmartWallet = {
  user_id: string;
  chain: ChainName;
  address: string;
  factory: string;
  salt: string;
};

export function ensureSmartWallet(userId: string, chain: ChainName = "base"): SmartWallet {
  // Idempotent: address is deterministic per (chain, user_id) so calling twice
  // returns the same wallet.
  const factory = "0xSimplerAccountFactoryV0_7";
  const salt = createHash("sha256").update(`${userId}|${chain}`).digest("hex").slice(0, 32);
  const address = adapterFor(chain).generateAddress(userId);

  // Persist on first call to users table extension if not present
  db().prepare(`UPDATE users SET smart_wallet_address = COALESCE(smart_wallet_address, ?) WHERE id = ?`)
    .run(address, userId);

  return { user_id: userId, chain, address, factory, salt };
}

export type UserOpDraft = {
  user_id: string;
  chain: ChainName;
  to: string;
  asset: string;
  amount: string;
  // Real version: callData, signature, paymaster, etc.
  // Stub: just the intent.
};

export async function buildAndSubmitUserOp(draft: UserOpDraft): Promise<{ tx_hash: string; chain: ChainName }> {
  const sw = ensureSmartWallet(draft.user_id, draft.chain);
  const adapter = adapterFor(draft.chain);
  const r = await adapter.broadcastTransfer({
    from: sw.address, to: draft.to, asset: draft.asset, amount: draft.amount,
  });
  return { tx_hash: r.tx_hash, chain: draft.chain };
}
