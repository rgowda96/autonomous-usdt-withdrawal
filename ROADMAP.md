# StablePay Roadmap

Ordered, bounded tasks. Each = one loop tick. `[x]` done, `[B]` blocked-on-human, `[ ]` open.

**Priority order: FEEDBACK.md items first, then this list top-to-bottom.**

The first phase is dedicated to **giving the first user (you) something to poke**. Backend hardening is deferred.

---

## Phase A — Testable surface FIRST (user can poke after each task)
- [x] 002.01 Add `GET /v1/quotes/:id` endpoint + test
- [ ] A.01 Add a single-file demo HTML page at `/` (vanilla JS, no build) — shows: "Scan QR" (paste VPA), amount input, "Get Quote", quote card, "Confirm Pay", success receipt. Hits the live API.
- [ ] A.02 Pre-seed demo user on first server boot so the demo page just works
- [ ] A.03 Add a "Recent transactions" list panel on the demo page
- [ ] A.04 Add visual loading + error states (failure modes look like the real product)
- [ ] A.05 Add a fee-breakdown widget that explains why each rupee was charged
- [ ] A.06 Add an "Asset selector" toggle (USDC vs USDT vs INR_CREDIT) and show how the quote changes
- [ ] A.07 Add a "Simulate off-ramp success" button so the full lifecycle ends in SETTLED inside the demo
- [ ] A.08 Make the demo page mobile-responsive (test in DevTools mobile view)
- [ ] A.09 Add a "Spending policy" UI: set a daily cap and a merchant allowlist (stores config server-side)
- [ ] A.10 Add an "Agent mode" toggle: simulates an LLM agent making a payment under the policy

## Phase B — Hardening the core
- [ ] 002.02 Add `GET /v1/transactions/:id` endpoint + full event timeline + test
- [ ] 002.03 Add reconciliation sweeper job (orphan USDC_RECEIVED >10min → auto-refund) + test
- [ ] 002.04 Add `/v1/users/:id/tds/summary?fy=YYYY-YY` endpoint + test
- [ ] 002.05 Add request logging middleware (redact PII)
- [ ] 002.06 Add per-user rate limit middleware + test
- [ ] 002.07 Add idempotency-key TTL cleanup job (24h) + test
- [ ] 002.08 Add `Dockerfile` + `docker-compose.yml`

## Phase C — Routing engine v2
- [ ] 003.01 Replace hard-coded rates with CoinGecko fetcher + 30s cache + test
- [ ] 003.02 Add Binance P2P spread feed; fallback to CG
- [ ] 003.03 Quote response surfaces per-step cost breakdown
- [ ] 003.04 `auto_tax_optimal` mode: prefer assets with unrealized losses
- [ ] 003.05 Cost-basis ledger (FIFO)
- [ ] 003.06 Surface tax preview in quote
- [ ] 003.07 Per-venue slippage simulation (1inch, Jupiter)

## Phase D — Postgres
- [ ] 004.01 Drizzle ORM + Postgres schema
- [ ] 004.02 Dual-backend adapter (SQLite for tests, PG for prod)
- [ ] 004.03 drizzle-kit migrations
- [ ] 004.04 CI runs Postgres
- [ ] 004.05 Dedicated idempotency_keys table with TTL

## Phase E — Real off-ramp (Onmeta)
- [B] 010.01 Onmeta sandbox account + API key  (HUMAN: signup + KYB)
- [ ] 010.02 Onmeta adapter (sandbox)
- [ ] 010.03 Webhook signature verification (HMAC-SHA256)
- [ ] 010.04 Adapter contract tests with nock
- [ ] 010.05 Fallback chain: Onmeta primary, mock fallback
- [ ] 010.06 Daily reconciliation job vs Onmeta

## Phase F — Smart wallet + on-chain testnet
- [B] 015.01 Pimlico API key (Base Sepolia)  (HUMAN)
- [B] 015.02 Privy app credentials  (HUMAN)
- [ ] 015.03 `services/wallet.ts`: ERC-4337 UserOp builder for USDC on Base Sepolia
- [ ] 015.04 Deterministic test wallet generator
- [ ] 015.05 Real Base Sepolia broadcast (replaces 0xsim_)
- [ ] 015.06 Deposit watcher → credit balance
- [ ] 015.07 Pimlico paymaster (gas sponsorship)

## Phase G — Agent surface (MCP)
- [ ] 020.01 `packages/mcp-server` with tools: `pay_upi`, `quote_upi`, `get_balances`, `get_policy`
- [ ] 020.02 Session-key JWT auth model
- [ ] 020.03 `services/session_keys.ts`: create/revoke with bounds
- [ ] 020.04 `/v1/users/:id/session-keys` CRUD endpoints + tests
- [ ] 020.05 Per-call policy check
- [ ] 020.06 Notifications table for agent activity
- [ ] 020.07 E2E: 3 agent payments within bounds, 4th rejected

## Phase H — Intent gateway
- [ ] 025.01 Normalizer: UPI deeplink → PaymentIntent
- [ ] 025.02 Normalizer: merchant checkout POST → PaymentIntent
- [ ] 025.03 Normalizer: agent MCP call → PaymentIntent
- [ ] 025.04 `/v1/intents` POST → routes to quote+settle
- [ ] 025.05 Bharat QR (EMV) support

## Phase I — Multi-asset + bridge
- [ ] 030.01 Solana adapter (USDC SPL devnet)
- [ ] 030.02 Tron adapter (USDT TRC-20 testnet)
- [ ] 030.03 LI.FI SDK for cross-chain
- [ ] 030.04 E2E: USDT/Tron → bridge → Base USDC → off-ramp → UPI
- [ ] 030.05 chainabstraction layer

## Phase J — Yield-while-idle
- [ ] 035.01 Aave V3 Base Sepolia adapter
- [ ] 035.02 User toggle: yield_enabled per balance
- [ ] 035.03 JIT unwind (atomic UserOp)
- [ ] 035.04 Yield tracking per user
- [ ] 035.05 Daily APY snapshot job

## Phase K — Bills + mandates
- [ ] 040.01 BBPS biller catalogue
- [ ] 040.02 `mandates` table
- [ ] 040.03 Mandate executor cron
- [ ] 040.04 Mandate revoke + test
- [ ] 040.05 E2E: 3 monthly executions then revoke

## Phase L — Mobile (Expo)
- [ ] 050.01 Expo project + Privy SDK
- [B] 050.02 Apple Developer + Google Play accounts  (HUMAN)
- [ ] 050.03 Onboarding screens
- [ ] 050.04 UPI QR scanner (expo-camera + deeplink parser)
- [ ] 050.05 Pay screen with route plan + asset selector + FaceID
- [ ] 050.06 Tx list + receipt detail
- [ ] 050.07 Session-key manager
- [ ] 050.08 Android UPI deeplink intent filter
- [ ] 050.09 E2E with Detox/Maestro

## Phase M — Compliance
- [ ] 070.01 Sumsub KYC stub
- [B] 070.02 Sumsub production credentials  (HUMAN)
- [ ] 070.03 FIU-IND daily report generator
- [ ] 070.04 Travel rule attribution
- [ ] 070.05 Chainalysis KYT stub
- [ ] 070.06 Auto-freeze on sanctions match

## Phase N — Observability
- [ ] 080.01 OpenTelemetry tracing
- [ ] 080.02 Prometheus `/metrics`
- [ ] 080.03 Grafana dashboards
- [ ] 080.04 SLO defs + alerts
- [ ] 080.05 Structured logging + correlation IDs

## Phase O — Hardening
- [ ] 090.01 Replay attack tests
- [ ] 090.02 Intent normalizer fuzz tests
- [ ] 090.03 autocannon load test
- [ ] 090.04 Security review checklist
- [ ] 090.05 Backup + restore drill

## Phase P — Launch readiness
- [B] 100.01 VASP registration  (HUMAN)
- [B] 100.02 PA partnership (Razorpay/Cashfree)  (HUMAN)
- [B] 100.03 Production Postgres + Redis  (HUMAN)
- [ ] 100.04 `docs/deploy.md`
- [ ] 100.05 `docs/runbook.md`
- [ ] 100.06 Beta-tester allowlist flow

---

When all `[ ]` items are exhausted (only `[B]` and `[x]` remain), loop writes a HALT entry in STATE.md and stops.
