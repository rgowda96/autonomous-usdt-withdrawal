# StablePay Mission (north star — immutable)

> Enable any Indian user holding USDC, USDT, ETH, SOL, BTC, or any stablecoin
> to spend that balance **anywhere in India** — UPI QR, online checkout, biller,
> recurring subscription, or via an AI agent acting on their behalf — at
> **near-zero fees**, with **no card** in the path for domestic merchants.

## Positioning

**StablePay is a direct competitor to RedotPay**, built India-first and India-legal.
Where RedotPay routes Indian payments through a foreign Visa BIN sponsor (StraitsX) and
charges ~11% effective, StablePay routes through licensed Indian rails (UPI via a PA
partner) at ~1%. The product is **mobile-first** (Expo / React Native today, EAS native
later) — a card is not the primary product and exists only as a fallback for foreign
travel / ATM in v0.5+.

The full competitive teardown — every RedotPay flaw and the StablePay mechanism that
fixes it — lives in `REDOTPAY_FLAWS.md`. The product design that makes the win legible
lives in `DESIGN.md`. Both are load-bearing: Mission Guardian checks PRs against them.

### The FX transparency promise (the core wedge)

RedotPay's single most painful flaw: when a user spends a USD-denominated stablecoin
online, RedotPay effectively bills **~₹84 per $1 when mid-market is ~₹95** — an opaque
~11.5% haircut buried across "conversion", "FX markup", and cross-border interchange.

StablePay's commitment, enforced in code (`src/services/fx.ts`):
- Bill USD purchases at **live mid-market FX minus exactly ONE disclosed spread**
  (default 60 bps, `ONLINE_SPREAD_BPS`).
- **Always show the receipt**: mid-market rate, the user's effective rate, the fee in
  rupees, and the RedotPay-equivalent cost — so the user sees `you_save_inr` on every
  purchase and a lifetime total on Home.
- The RedotPay comparison basis (`REDOTPAY_EFFECTIVE_HAIRCUT_BPS`, default 1150) must
  stay defensible from public fee schedules. Never inflate it.

## India compliance (non-negotiable — every PR is checked against this)

1. **VASP-registered with FIU-IND** before going live to any non-founder user.
2. **§194S TDS at 1%** deducted at source on every off-ramp; quarterly Form 26QE filed; user gets Form 16E for ITR credit.
3. **§115BBH 30%** on crypto gains: tracked via FIFO cost-basis ledger; user gets clean ITR-export CSV.
4. **PMLA / Travel Rule** — Sumsub or HyperVerge KYC on every user before first off-ramp; Chainalysis KYT on every incoming on-chain deposit.
5. **UPI rails via a licensed PA / AD-II partner** — Onmeta (v0.1), Cashfree Payouts (v0.4+). Never self-issue UPI; always partner.
6. **No solicitation of users without RBI/SEBI/MeitY clearances applicable to crypto-INR settlement.** v0 is founder-only; v0.2 is allowlist beta after VASP registration in flight.
7. **No real money in v0.** Mock + Base Sepolia testnet only. `allow_real_money: false` is permanent in STATE.md until human flips it.

## North-star metrics (every PR must move us toward these, never away)

1. **Effective fee on a domestic INR purchase ≤ 1.0%** (vs RedotPay's ~11%). Target: 0.5% at scale.
2. **End-to-end latency p50 ≤ 8 seconds** from intent to merchant credit.
3. **Universal acceptance:** any UPI VPA / Bharat QR works, no merchant integration required.
4. **Agent-native:** any LLM agent can transact via MCP under user-bounded session keys.
5. **Multi-asset, multi-chain:** user holds in whatever form they want; routing engine picks cheapest path.
6. **Yield-while-idle:** idle balances earn yield; for big balances, yield ≥ fees (net negative cost).
7. **Compliance-clean:** §194S TDS at source, VASP-registered, partner with licensed PA.

## Non-goals (do NOT build these — out of scope, will dilute focus)

- A crypto exchange or trading product.
- A custodial wallet where StablePay holds keys. (Smart accounts only.)
- A consumer card as the primary product. (Card is fallback for foreign ATM only.)
- A B2B merchant acquirer. (Merchants don't integrate; UPI rail already universal.)
- A web-first product. (Mobile-first; web demo is for backend debugging only.)
- Anything that requires changing user behavior beyond installing one app.
- Any feature that requires StablePay to hold INR float without a PA partner.
- Operating in geographies other than India in v0/v1.

## Mission guardrails (every tick is checked against these)

A pull request is **rejected by Mission Guardian** if it:
- Increases the effective fee on a domestic purchase above the v0.1 baseline (1.5%).
- Requires merchant integration to work (defeats universal acceptance).
- Puts custody on StablePay's side (custodial model is forbidden).
- Adds a synchronous Visa/Mastercard step to a domestic INR transaction.
- Couples the user to a single chain or single asset (must remain abstraction).
- Removes the TDS accrual step from any settlement.
- Locks the user to a single off-ramp partner with no fallback.
- Hides fees from the user. (Every receipt must show: rate, fee bps, TDS, net.)
- Bills a USD purchase at worse than mid-market minus the single disclosed spread.
- Removes or weakens the RedotPay savings comparison shown to the user.
- Inflates `REDOTPAY_EFFECTIVE_HAIRCUT_BPS` beyond what public fee schedules support.
- Ships UI that violates `DESIGN.md` (e.g. uses the savings emerald for a non-value-positive element, or adds a competing accent colour).

## Mission status (current)

- ✅ Universal acceptance: VPA payments work end-to-end (mock off-ramp).
- ✅ Multi-asset routing: USDC / USDT / INR_CREDIT supported; ETH/SOL/BTC in routing engine.
- ✅ Fee target: current quote shows ~50 bps for INR_CREDIT, ~140 bps for USDC.
- ⏳ Latency: depends on off-ramp partner — will measure with Onmeta sandbox.
- ⏳ Agent-native: roadmap Phase G.
- ⏳ Yield-while-idle: roadmap Phase J.
- ⏳ Compliance: roadmap Phase M.

This file is read by the Mission Guardian agent every tick. The Mission Guardian VETOES PRs that drift.
The Mission Guardian does NOT edit this file. Only the human edits MISSION.md.
