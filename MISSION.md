# StablePay Mission (north star — immutable)

> Enable any Indian user holding USDC, USDT, ETH, SOL, BTC, or any stablecoin
> to spend that balance **anywhere in India** — UPI QR, online checkout, biller,
> recurring subscription, or via an AI agent acting on their behalf — at
> **near-zero fees**, with **no card** in the path for domestic merchants.

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
- Anything that requires changing user behavior beyond installing one app.

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
