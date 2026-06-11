# RedotPay flaws → StablePay fixes

This is the competitive teardown that defines the product. Every row is a
RedotPay flaw a real user feels, and the concrete StablePay mechanism that
fixes it. Engineering keeps this honest: if a fix regresses, the row goes
back to ❌ and Mission Guardian blocks the PR.

| # | RedotPay flaw (what the user feels) | StablePay fix | Where in code | Status |
|---|---|---|---|---|
| 1 | **Opaque FX: $1 bills at ~₹84 when mid-market is ~₹95** (~11.5% hidden haircut split across "conversion", "FX markup", interchange) | Bill USD purchases at live mid-market minus ONE disclosed 60 bps spread; show mid-market, your rate, fee, AND the RedotPay-equivalent cost every time | `src/services/fx.ts`, `src/services/online_purchase.ts`, `OnlineScreen` | ✅ |
| 2 | **No transparency** — user never sees where the spread went | Every quote returns `cost_breakdown[]` + `you_save_inr`/`you_save_pct`; UI shows the line-item teardown and a struck-through RedotPay total | `routes/quote.ts`, `routes/online.ts`, `FxComparison` | ✅ |
| 3 | **Hefty top-up fees** (3% via card, 1% via Binance Pay) | On-chain USDC deposit is the funding path — gas only, no top-up fee. Deposit watcher credits balance directly | `src/services/deposit_watcher.ts` | ✅ |
| 4 | **High domestic spend cost** (card rails ~11% effective on INR) | Domestic spend uses UPI off-ramp (~0.5–1%), no card in the loop | `src/services/routing.ts`, `quote`/`settle` | ✅ |
| 5 | **Custodial — RedotPay holds your keys** | Smart-account model (ERC-4337), user-owned. No StablePay custody | `src/services/wallet.ts`, `apps/mobile/src/privy.ts` | ✅ (stub; real Privy on key) |
| 6 | **Captures your idle-balance yield** | Yield-while-idle returns yield to the *user*; JIT-unwound at spend time | `src/services/yield.ts` | ✅ |
| 7 | **No agent / automation support** | MCP server + bounded session keys let an LLM transact within per-txn/daily caps + VPA allowlist | `packages/mcp-server`, `src/services/session_keys.ts` | ✅ |
| 8 | **Card issuance + replacement fees** ($10 virtual / $100 physical) | No card required for domestic or online; card is an optional v2 fallback for foreign ATM only | `MISSION.md` non-goals | ✅ |
| 9 | **Tax left to the user to untangle** | §194S 1% TDS deducted at source + Form 26QE/16E; §115BBH 30% tracked via FIFO cost-basis with ITR CSV export; tax preview in every quote | `src/services/cost_basis.ts`, `kyc.ts`, `/v1/compliance/fiu-ind-report` | ✅ |
| 10 | **Opaque settlement status** | Full transaction timeline (every state transition) exposed via `/v1/transactions/:id`; mobile TxDetail renders it | `routes/wallet.ts`, `TxDetailScreen` | ✅ |
| 11 | **Single off-ramp dependency** (StraitsX/Visa) | Pluggable off-ramp adapter with primary + mock fallback; daily reconciliation | `src/services/offramp_onmeta.ts`, `recon.ts` | ✅ |
| 12 | **No spend controls** | Session-key spend policy: per-txn cap, daily cap, VPA allowlist, TTL, instant revoke | `src/services/session_keys.ts`, `AgentsScreen` | ✅ |
| 13 | **No KYT / sanctions safety surfaced to user** | KYT screening + OFAC auto-freeze + travel-rule attribution | `src/services/kyt.ts` | ✅ |
| 14 | **Generic, card-first UX** | Mobile-first, India-first UX: scan-any-UPI-QR, Shop-in-USD, lifetime-savings hero | `apps/mobile/`, `DESIGN.md` | ✅ |

## The one-line positioning

> RedotPay charges you ~₹84 for a dollar and hides why. StablePay charges
> you ~₹94, shows you the receipt, and tells you exactly how much you just
> saved — on a phone, in India, legally.

## How we keep ourselves honest

- `REDOTPAY_EFFECTIVE_HAIRCUT_BPS` (default 1150) is the documented basis of
  the comparison. If RedotPay improves their pricing, update this number —
  never inflate it. The savings claim must always be defensible from public
  fee schedules (see `MISSION.md` sources).
- `ONLINE_SPREAD_BPS` (default 60) is OUR disclosed margin. Mission Guardian
  rejects any PR that raises the effective domestic fee above the v0.1
  baseline or hides a fee from the user.
