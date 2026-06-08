# StablePay Roadmap

Ordered, bounded tasks. Each task is one loop tick. Mark `[x]` when done, `[B]` when BLOCKED on human input. Loop should always pick the lowest-numbered `[ ]` task it can do without human input.

Rule: if a task needs a real API key, account, or partner agreement → mark `[B]`, document what's needed in `STATE.md`, skip to next unblocked task.

---

## v0.0.2 — Hardening the core
- [x] 002.01 Add `GET /v1/quotes/:id` endpoint + test
- [ ] 002.02 Add `GET /v1/transactions/:id` endpoint with full event timeline + test
- [ ] 002.03 Add reconciliation sweeper job (orphan USDC_RECEIVED >10min → auto-refund path) + test
- [ ] 002.04 Add `/v1/users/:id/tds/summary?fy=YYYY-YY` endpoint returning quarterly TDS totals + test
- [ ] 002.05 Add request logging middleware (redact PII: auth_proof, signatures)
- [ ] 002.06 Add per-user rate limit middleware (10 quotes/min, 5 settles/min) + test
- [ ] 002.07 Add idempotency-key TTL cleanup job (24h) + test
- [ ] 002.08 Add a `Dockerfile` + `docker-compose.yml` (app + postgres + redis stubs)

## v0.0.3 — Routing engine v2
- [ ] 003.01 Replace hard-coded rates with cached fetcher (CoinGecko free tier) + 30s TTL + test
- [ ] 003.02 Add P2P spread feed: scrape Binance P2P USDT/INR top-5 ads → median; fallback to CG
- [ ] 003.03 Routing scorer surfaces cost breakdown JSON (per-step bps) in quote response
- [ ] 003.04 Add `auto_tax_optimal` mode: prefer assets with negative unrealized P&L (needs cost-basis tracking)
- [ ] 003.05 Add cost-basis ledger: every deposit records acquisition price; FIFO consumption on debit
- [ ] 003.06 Surface tax preview in quote: estimated capital gain + tax owed
- [ ] 003.07 Add slippage simulation per swap venue (1inch quote API, Jupiter quote API)

## v0.0.4 — Postgres migration
- [ ] 004.01 Add Drizzle ORM + Postgres schema mirroring SQLite
- [ ] 004.02 Dual-write adapter behind interface; SQLite for tests, Postgres for prod
- [ ] 004.03 Add migration scripts (drizzle-kit)
- [ ] 004.04 Update CI: spin up Postgres in compose, run integration tests against both backends
- [ ] 004.05 Move idempotency_keys to a dedicated table with TTL index

## v0.1 — Real off-ramp adapter (Onmeta)
- [B] 010.01 Apply for Onmeta sandbox account + API key  (HUMAN: needs Onmeta sign-up + KYB docs)
- [ ] 010.02 Implement Onmeta adapter against documented spec; default to sandbox env
- [ ] 010.03 Implement webhook signature verification (HMAC-SHA256) for Onmeta payloads
- [ ] 010.04 Add adapter contract tests: nock-based mock of Onmeta API
- [ ] 010.05 Add fallback chain: Onmeta primary, mock fallback on misconfig
- [ ] 010.06 Add daily reconciliation job: pull Onmeta payouts list, match to local ledger, alert on diffs

## v0.1.5 — Smart wallet + on-chain debit (testnet)
- [B] 015.01 Get Pimlico API key (Base Sepolia)  (HUMAN: free signup, paste key into .env)
- [B] 015.02 Get Privy app credentials  (HUMAN: privy.io signup)
- [ ] 015.03 Add `services/wallet.ts`: ERC-4337 UserOp builder for USDC ERC20 transfers on Base Sepolia
- [ ] 015.04 Add deterministic test wallet generator (HD-derived from test seed) for fixtures
- [ ] 015.05 Replace simulated `0xsim_` tx with real Base Sepolia broadcast (testnet USDC)
- [ ] 015.06 Add deposit watcher: poll Base Sepolia for incoming USDC to user smart-wallet, credit balance
- [ ] 015.07 Add gas sponsorship via Pimlico paymaster

## v0.2 — Agent surface (MCP server)
- [ ] 020.01 New package `packages/mcp-server` exposing tools: `pay_upi`, `quote_upi`, `get_balances`, `get_policy`
- [ ] 020.02 Auth model: caller passes a session-key JWT; server validates against policy in DB
- [ ] 020.03 Add `services/session_keys.ts`: create/revoke session keys with bounds (daily cap, allowlist, expiry)
- [ ] 020.04 Add `/v1/users/:id/session-keys` CRUD endpoints + tests
- [ ] 020.05 Per-call policy check: amount ≤ daily_cap_remaining, vpa matches allowlist, not expired
- [ ] 020.06 Push notification stub when agent transacts (writes to `notifications` table)
- [ ] 020.07 Add e2e test: simulated agent issues 3 sequential payments within bounds; 4th over-limit rejected

## v0.2.5 — Intent gateway
- [ ] 025.01 Normalizer: accepts QR deeplink string `upi://pay?pa=...` → canonical PaymentIntent
- [ ] 025.02 Normalizer: accepts merchant checkout POST → PaymentIntent
- [ ] 025.03 Normalizer: accepts agent MCP tool call → PaymentIntent
- [ ] 025.04 Add `/v1/intents` POST that takes any canonical intent and routes to quote+settle
- [ ] 025.05 Bharat QR support (parse EMV-formatted QR strings)

## v0.3 — Multi-asset + bridge
- [ ] 030.01 Add Solana adapter: USDC SPL transfers on devnet
- [ ] 030.02 Add Tron adapter for USDT TRC-20 (test net)
- [ ] 030.03 Add LI.FI SDK for cross-chain bridge step in routing engine
- [ ] 030.04 Integration test: USDT on Tron → bridge → USDC on Base → off-ramp → UPI mock
- [ ] 030.05 Add `chainabstraction` layer that hides chain choice from upstream code

## v0.3.5 — Yield-while-idle
- [ ] 035.01 Aave V3 Base Sepolia adapter: supply USDC, withdraw on demand
- [ ] 035.02 Add user-toggle: `yield_enabled` per balance
- [ ] 035.03 JIT unwind: before debit, check if balance is in aUSDC, withdraw atomically in same UserOp
- [ ] 035.04 Track yield earned per user; show as offset to fees in receipts
- [ ] 035.05 Add daily APY snapshotting job

## v0.4 — Bills + recurring mandates
- [ ] 040.01 BBPS integration stub: biller catalogue table + fetch by category
- [ ] 040.02 Add `mandates` table: long-lived session-key with merchant + amount cap + cron schedule
- [ ] 040.03 Mandate executor cron: every minute, scan due mandates, trigger quote+settle
- [ ] 040.04 Mandate revoke endpoint + test
- [ ] 040.05 Tests: monthly Netflix subscription executes 3 times then revoked

## v0.5 — Mobile shell (React Native)
- [ ] 050.01 New `apps/mobile` Expo project; passkey-backed wallet via Privy SDK
- [B] 050.02 Apple Developer + Google Play accounts  (HUMAN)
- [ ] 050.03 Onboarding screens: create wallet, fund via QR
- [ ] 050.04 UPI QR scanner using `expo-camera` + UPI deeplink parser
- [ ] 050.05 Pay screen: shows route plan, asset selector, FaceID confirm
- [ ] 050.06 Transactions list + receipt detail
- [ ] 050.07 Settings: session-key manager (revoke agent access)
- [ ] 050.08 Android UPI deeplink intent filter so existing GPay QRs route to app
- [ ] 050.09 E2E test with Detox or Maestro

## v0.6 — Card fallback (deferred)
- [B] 060.01 Bridge.xyz issuing API access  (HUMAN: partnership)
- [ ] 060.02 Card stub endpoints; defer real integration

## v0.7 — Compliance pipeline
- [ ] 070.01 KYC integration stub (Sumsub mock + real API call adapter)
- [B] 070.02 Sumsub production credentials  (HUMAN)
- [ ] 070.03 VASP daily report generator (FIU-IND format CSV)
- [ ] 070.04 Travel rule attribution table + populator
- [ ] 070.05 Chainalysis KYT screening stub
- [ ] 070.06 Auto-freeze on sanctions match + alerting

## v0.8 — Observability + SRE
- [ ] 080.01 Add OpenTelemetry tracing
- [ ] 080.02 Add Prometheus metrics endpoint (`/metrics`)
- [ ] 080.03 Add Grafana dashboard JSON committed to repo
- [ ] 080.04 Add SLO definitions + alerts (p99 < 15s, settle success > 99%)
- [ ] 080.05 Structured logging with correlation IDs across services

## v0.9 — Hardening
- [ ] 090.01 Replay attack tests on every endpoint
- [ ] 090.02 Fuzz testing on intent normalizer
- [ ] 090.03 Load test: 1000 concurrent quotes via autocannon
- [ ] 090.04 Security review checklist run
- [ ] 090.05 Database backup + restore drill scripts

## v1.0 — Launch readiness
- [B] 100.01 VASP registration submitted  (HUMAN, regulatory)
- [B] 100.02 PA partnership signed (Razorpay/Cashfree)  (HUMAN)
- [B] 100.03 Production Postgres + Redis provisioned  (HUMAN)
- [ ] 100.04 Production env vars documented in `docs/deploy.md`
- [ ] 100.05 Runbook for incidents (`docs/runbook.md`)
- [ ] 100.06 Beta-tester invite flow + cohort allowlist

---

When all `[ ]` items are exhausted (only `[B]` and `[x]` remain), loop should:
1. Print a STOP-AND-WAIT message in STATE.md
2. Exit cleanly without commits
