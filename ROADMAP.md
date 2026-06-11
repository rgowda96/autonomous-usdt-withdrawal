# StablePay Roadmap

Ordered, bounded tasks. Each = one loop tick. `[x]` done, `[B]` blocked-on-human, `[ ]` open.

**Priority order: FEEDBACK.md items first, then this list top-to-bottom.**

The first phase is dedicated to **giving the first user (you) something to poke**. Backend hardening is deferred.

---

## Phase A — Testable mobile surface FIRST (founder pokes it via Expo Go)

Per MISSION.md, this is a mobile-first product. The web demo is dev-only.

- [x] 002.01 Add `GET /v1/quotes/:id` endpoint + test
- [x] A.01 Web demo HTML at `/` (kept as backend debug surface; not the user surface)
- [x] A.deploy Dockerfile + Render/Fly configs + RUN docs
- [x] A.mobile Scaffold Expo app at `apps/mobile/` + CORS on backend; single-screen pay flow in Expo Go
- [x] A.mobile.2 Real biometric confirm via `expo-local-authentication`
- [x] A.mobile.3 Real QR camera scanner via `expo-camera`; parse `upi://pay?pa=...` deeplinks
- [x] A.mobile.4 Pull-to-refresh + transaction detail screen with full timeline
- [x] A.mobile.5 Asset picker: override `auto_cheapest` and pick a specific holding
- [x] A.mobile.6 Empty-state + onboarding screens
- [x] A.mobile.7 Inline TDS + capital-gain warnings (India compliance UX)
- [x] A.mobile.8 Settings: API base URL switcher (laptop vs deployed backend)
- [x] A.mobile.9 Recent payees autocomplete
- [x] A.mobile.10 Android UPI deeplink intent filter (requires EAS Build, not Expo Go)
- [x] A.01.fix Followups from code-review on A.01 (web demo): copy `src/public/*` to `dist/`, extract shared `seedDemoUser(conn)`, replace innerHTML in tx list, use `crypto.randomUUID()`, upgrade `test/demo_page.test.ts` to boot fastify + GET /.
- [x] A.02 Pre-seed demo user on first server boot so the demo page just works
- [x] A.03 Add a "Recent transactions" list panel on the demo page
- [x] A.04 Add visual loading + error states (failure modes look like the real product)
- [x] A.05 Add a fee-breakdown widget that explains why each rupee was charged
- [x] A.06 Add an "Asset selector" toggle (USDC vs USDT vs INR_CREDIT) and show how the quote changes
- [x] A.07 Add a "Simulate off-ramp success" button so the full lifecycle ends in SETTLED inside the demo
- [x] A.08 Make the demo page mobile-responsive (test in DevTools mobile view)
- [x] A.09 Add a "Spending policy" UI: set a daily cap and a merchant allowlist (stores config server-side)
- [x] A.10 Add an "Agent mode" toggle: simulates an LLM agent making a payment under the policy

## Phase B — Hardening the core
- [x] 002.02 Add `GET /v1/transactions/:id` endpoint + full event timeline + test
- [x] 002.03 Add reconciliation sweeper job (orphan USDC_RECEIVED >10min → auto-refund) + test
- [x] 002.04 Add `/v1/users/:id/tds/summary?fy=YYYY-YY` endpoint + test
- [x] 002.05 Add request logging middleware (redact PII)
- [x] 002.06 Add per-user rate limit middleware + test
- [x] 002.07 Add idempotency-key TTL cleanup job (24h) + test
- [x] 002.08 Add `Dockerfile` + `docker-compose.yml`

## Phase C — Routing engine v2
- [x] 003.01 Replace hard-coded rates with CoinGecko fetcher + 30s cache + test
- [x] 003.02 Add Binance P2P spread feed; fallback to CG
- [x] 003.03 Quote response surfaces per-step cost breakdown
- [x] 003.04 `auto_tax_optimal` mode: prefer assets with unrealized losses
- [x] 003.05 Cost-basis ledger (FIFO)
- [x] 003.06 Surface tax preview in quote
- [x] 003.07 Per-venue slippage simulation (1inch, Jupiter)

## Phase D — Postgres
- [x] 004.01 Drizzle ORM + Postgres schema
- [x] 004.02 Dual-backend adapter (SQLite for tests, PG for prod)
- [x] 004.03 drizzle-kit migrations
- [x] 004.04 CI runs Postgres
- [x] 004.05 Dedicated idempotency_keys table with TTL

## Phase E — Real off-ramp (Onmeta)
- [B] 010.01 Onmeta sandbox account + API key  (HUMAN: signup + KYB)
- [x] 010.02 Onmeta adapter (sandbox)
- [x] 010.03 Webhook signature verification (HMAC-SHA256)
- [x] 010.04 Adapter contract tests with nock
- [x] 010.05 Fallback chain: Onmeta primary, mock fallback
- [x] 010.06 Daily reconciliation job vs Onmeta

## Phase F — Smart wallet + on-chain testnet
- [B] 015.01 Pimlico API key (Base Sepolia)  (HUMAN)
- [B] 015.02 Privy app credentials  (HUMAN)
- [x] 015.03 `services/wallet.ts`: ERC-4337 UserOp builder for USDC on Base Sepolia
- [x] 015.04 Deterministic test wallet generator
- [x] 015.05 Real Base Sepolia broadcast (replaces 0xsim_)
- [x] 015.06 Deposit watcher → credit balance
- [x] 015.07 Pimlico paymaster (gas sponsorship)

## Phase G — Agent surface (MCP)
- [x] 020.01 `packages/mcp-server` with tools: `pay_upi`, `quote_upi`, `get_balances`, `get_policy`
- [x] 020.02 Session-key JWT auth model
- [x] 020.03 `services/session_keys.ts`: create/revoke with bounds
- [x] 020.04 `/v1/users/:id/session-keys` CRUD endpoints + tests
- [x] 020.05 Per-call policy check
- [x] 020.06 Notifications table for agent activity
- [x] 020.07 E2E: 3 agent payments within bounds, 4th rejected

## Phase H — Intent gateway
- [x] 025.01 Normalizer: UPI deeplink → PaymentIntent
- [x] 025.02 Normalizer: merchant checkout POST → PaymentIntent
- [x] 025.03 Normalizer: agent MCP call → PaymentIntent
- [x] 025.04 `/v1/intents` POST → routes to quote+settle
- [x] 025.05 Bharat QR (EMV) support

## Phase I — Multi-asset + bridge
- [x] 030.01 Solana adapter (USDC SPL devnet)
- [x] 030.02 Tron adapter (USDT TRC-20 testnet)
- [x] 030.03 LI.FI SDK for cross-chain
- [x] 030.04 E2E: USDT/Tron → bridge → Base USDC → off-ramp → UPI
- [x] 030.05 chainabstraction layer

## Phase J — Yield-while-idle
- [x] 035.01 Aave V3 Base Sepolia adapter
- [x] 035.02 User toggle: yield_enabled per balance
- [x] 035.03 JIT unwind (atomic UserOp)
- [x] 035.04 Yield tracking per user
- [x] 035.05 Daily APY snapshot job

## Phase K — Bills + mandates
- [x] 040.01 BBPS biller catalogue
- [x] 040.02 `mandates` table
- [x] 040.03 Mandate executor cron
- [x] 040.04 Mandate revoke + test
- [x] 040.05 E2E: 3 monthly executions then revoke

## Phase L — Mobile (Expo)
- [x] 050.01 Expo project + Privy SDK
- [B] 050.02 Apple Developer + Google Play accounts  (HUMAN)
- [x] 050.03 Onboarding screens
- [x] 050.04 UPI QR scanner (expo-camera + deeplink parser)
- [x] 050.05 Pay screen with route plan + asset selector + FaceID
- [x] 050.06 Tx list + receipt detail
- [x] 050.07 Session-key manager
- [x] 050.08 Android UPI deeplink intent filter
- [x] 050.09 E2E with Detox/Maestro

## Phase M — Compliance
- [x] 070.01 Sumsub KYC stub
- [B] 070.02 Sumsub production credentials  (HUMAN)
- [x] 070.03 FIU-IND daily report generator
- [x] 070.04 Travel rule attribution
- [x] 070.05 Chainalysis KYT stub
- [x] 070.06 Auto-freeze on sanctions match

## Phase N — Observability
- [x] 080.01 OpenTelemetry tracing
- [x] 080.02 Prometheus `/metrics`
- [x] 080.03 Grafana dashboards
- [x] 080.04 SLO defs + alerts
- [x] 080.05 Structured logging + correlation IDs

## Phase O — Hardening
- [x] 090.01 Replay attack tests
- [x] 090.02 Intent normalizer fuzz tests
- [x] 090.03 autocannon load test
- [x] 090.04 Security review checklist
- [x] 090.05 Backup + restore drill

## Phase P — Launch readiness
- [B] 100.01 VASP registration  (HUMAN)
- [B] 100.02 PA partnership (Razorpay/Cashfree)  (HUMAN)
- [B] 100.03 Production Postgres + Redis  (HUMAN)
- [x] 100.04 `docs/deploy.md`
- [x] 100.05 `docs/runbook.md`
- [x] 100.06 Beta-tester allowlist flow

---

When all `[ ]` items are exhausted (only `[B]` and `[x]` remain), loop writes a HALT entry in STATE.md and stops.
