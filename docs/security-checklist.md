# Security Review Checklist

This is the pre-launch security review checklist. Each section maps to a category in our threat model. Tick items as the loop or human verifies them.

## Authentication & session

- [x] Passkey / session-key tokens stored as SHA-256 hash, never plaintext (`session_keys.token_hash`)
- [x] Bearer tokens transported via `Authorization: Bearer <token>` only — not in URL, not in cookies
- [x] Session keys TTL-bounded with explicit `expires_at`
- [x] Manual revoke endpoint; `revoked_at` honored in `checkPolicy`
- [ ] **TODO**: rate-limit failed `Authorization` attempts per IP (currently per-user)
- [ ] **TODO**: rotate session-key tokens on suspicious activity (jurisdiction change, sudden high-cap usage)
- [ ] **TODO**: WebAuthn / passkey ceremony in mobile app (replaces stub auth_proof in v0)

## Authorization & policy

- [x] Per-txn cap enforced before settle
- [x] Daily cap (rolling 24h sum) enforced via `session_key_usage`
- [x] VPA allowlist enforced when set; null allowlist = wildcard documented
- [x] User-scoped queries everywhere (no implicit cross-tenant reads)
- [x] Mission Guardian gates every PR (CLAUDE.md)
- [ ] **TODO**: row-level authorization tests when Postgres lands (RLS policies)

## Idempotency, replay, ordering

- [x] `idempotency_key` unique index on quotes + transactions
- [x] Quote TTL 30s; expired quotes 409 on settle
- [x] Webhook `event_id` dedup in `webhook_events`
- [x] HMAC-SHA256 timing-safe compare on off-ramp webhooks (Onmeta)
- [x] Replay attack tests in `test/replay_attack.test.ts`
- [ ] **TODO**: timestamp window check on webhooks (reject events with `ts` >5min stale)

## Input validation

- [x] All routes Zod-validated
- [x] Intent normalizer fuzz tests in `test/intent_fuzz.test.ts`
- [x] Per-user rate limit on /v1/quote (10/min) and /v1/settle (5/min)
- [ ] **TODO**: max body size limit set at Fastify level (default 1MB OK; explicit cap to 64KB)

## Money flow

- [x] No real money (`allow_real_money: false` permanent in STATE.md)
- [x] Atomic balance debits in `better-sqlite3` transaction
- [x] Recon sweeper for orphan USDC_RECEIVED rows (>10min) -> REFUND_PENDING
- [x] Cost breakdown surfaced per route (no hidden fee escape hatches)
- [x] §194S 1% TDS accrual on every non-INR_CREDIT settlement
- [ ] **TODO**: refund executor for REFUND_PENDING -> REFUNDED transitions
- [ ] **TODO**: dual-control on treasury withdrawals when on-chain integration lands

## Compliance

- [x] KYC stub (Sumsub-shaped; AAdhaar/PAN/Passport regex validation in mock)
- [x] KYT stub (Chainalysis-shaped; OFAC sanctions list + auto-freeze)
- [x] FIU-IND daily CSV report endpoint
- [x] PII redaction in logs (auth_proof, signatures, VPAs masked)
- [ ] **TODO**: travel-rule attribution per cross-border tx (need on-chain integration)
- [ ] **TODO**: Form 26QE quarterly export job
- [ ] **TODO**: Sumsub production webhook signature validation

## Observability

- [x] Per-request correlation IDs (`x-correlation-id` header propagated)
- [x] /metrics Prometheus endpoint
- [x] Settlement / TDS counters
- [ ] **TODO**: SLO definitions committed as code (Sloth or Pyrra)
- [ ] **TODO**: alerts for: settle p99 >15s, agent rejection rate >5%, freeze rate >0.1%

## Secrets

- [x] `.env.example` documents required env vars; `.env` gitignored
- [x] No secrets in source (verified by grep on `(api[_-]?key|secret|token)` patterns in commits)
- [ ] **TODO**: production secrets in a dedicated KMS / GitHub Actions secrets / Fly secrets
- [ ] **TODO**: secret rotation runbook in `docs/runbook.md`

## Dependencies

- [ ] **TODO**: enable Dependabot for npm + GitHub Actions
- [ ] **TODO**: weekly `npm audit` in CI
- [ ] **TODO**: subresource integrity hashes for any external script (currently none in mobile)

## Loop / CI / supply chain

- [x] CI runs `npm test` on every push + PR (`.github/workflows/ci.yml`)
- [x] Branch policy: loop never targets main; PRs into `claude/blissful-davinci-Jw9jf`
- [x] CLAUDE.md: never force-push, never delete branches outside `claude-task/*`
- [ ] **TODO**: pin GitHub Actions to commit SHAs (not floating tags)
- [ ] **TODO**: codeowners + required reviewers on `main` once production launches

## Pen-test scope (when ready)

When VASP application is in flight, commission a black-box pen-test covering:
- Card-less spend flow end-to-end (Mobile -> Quote -> Settle -> Webhook)
- Agent payment flow (MCP server bearer auth + policy enforcement)
- Off-ramp partner webhook impersonation
- Session-key escalation via stolen token
- Race conditions on Quote-then-Settle TOCTOU

Hand the pen-test team `docs/security-checklist.md` as starting context.
