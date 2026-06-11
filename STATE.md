# Loop State

Single source of truth for what the autonomous loop has done, decided, and is blocked on.
Loop MUST update this file every tick before exiting.

---

## Cursor

**HALT — ROADMAP EXHAUSTED**

All `[ ]` items have been shipped or marked `[B]`. Loop has reached its
terminal state per CLAUDE.md "Done state". Last completed: A.mobile.3 +
A.mobile.10 (real expo-camera QR scanner) in PR #41.

Remaining `[B]` items require human credentials / agreements and are
listed below — supply each and the loop can resume against them:

1. **010.01 Onmeta sandbox** — signup + KYB at onmeta.in; set ONMETA_API_KEY + ONMETA_BASE_URL + ONMETA_WEBHOOK_SECRET in `.env`.
2. **015.01 Pimlico API key** — pimlico.io free tier; set PIMLICO_API_KEY.
3. **015.02 Privy app credentials** — privy.io; set EXPO_PUBLIC_PRIVY_APP_ID.
4. **050.02 Apple Developer + Google Play accounts** — paid; required for native build distribution.
5. **070.02 Sumsub production credentials** — partnership + KYB; set SUMSUB_TOKEN.
6. **100.01 VASP registration with FIU-IND** — regulatory, weeks-months.
7. **100.02 PA partnership** — Razorpay or Cashfree agreement.
8. **100.03 Production Postgres + Redis** — provision managed instances; set DATABASE_URL=postgres://...

When any credential lands, edit STATE.md / push, and the next loop tick
picks up the corresponding task.

## Priority rules

1. **Always drain `FEEDBACK.md` FIRST.** Open items in FEEDBACK.md are higher priority than ROADMAP.md items. The first user (rakshak.gowda96@gmail.com) is the source of truth on what to build next.
2. Then pick the lowest-numbered `[ ]` unblocked task in ROADMAP.md.
3. Inside ROADMAP.md itself, **TESTABLE-SURFACE tasks come before BACKEND-HARDENING tasks** — get the user a thing to poke.

## Completed log (newest first)

- 2026-06-08 — A.01 — PR #1 merged. First full autonomous tick under multi-agent protocol: Builder (HTML+server+test) → CI green → Code Reviewer (6 findings, 1 HIGH) → Fix on task branch → re-CI green → Merger squash-merged. 8/8 tests green. 5 follow-up cleanup tasks logged as A.01.fix.
- 2026-06-08 — autonomy/mission upgrade — shipped MISSION.md (north-star, immutable), AGENTS.md (crew roster: Orchestrator, Mission Guardian, Architect, Builder, Code Reviewer, Security Reviewer, Product Listener, Merger, Loop Doctor), updated CLAUDE.md to require Mission Guardian gates at both task-selection and pre-merge.
- 2026-06-10 — A.mobile.3 + A.mobile.10 — expo-camera QR scanner, intent filter. PR #41. 159/159 green.
- 2026-06-10 — 015.05/07 + 050.01/04/08/09 — Base Sepolia broadcast stub, Privy scaffold, UPI deeplink parser + listener, Maestro E2E. PR #40. 156/156 green.
- 2026-06-10 — 015.06 + 035.01 + 004.02-05 — deposit watcher + Aave V3 adapter + Postgres scaffold + idempotency_keys table. PR #39. 152/152 green.
- 2026-06-10 — 080.01/03/04 + 010.06 — OTel facade + Grafana JSON + SLO defs + Onmeta recon job. PR #38. 146/146 green.
- 2026-06-10 — 050.07 + A.09 + A.10 — mobile Agents tab (session-key manager). PR #37. 139/139 green.
- 2026-06-10 — A.01.fix + A.04-A.08 — web demo polish (shared seedDemoUser, crypto.randomUUID, dist build, asset selector, sim webhook button, mobile-responsive). PR #36. 139/139 green.
- 2026-06-10 — A.mobile.6 + A.mobile.7 — 4-slide onboarding + India-compliance copy. PR #35. 137/137 green.
- 2026-06-10 — 003.02 + 003.04 + 003.07 — Binance P2P feed + auto_tax_optimal + per-venue slippage. PR #34. 137/137 green.
- 2026-06-10 — 004.01 — Drizzle ORM schema mirror. PR #33. 132/132 green.
- 2026-06-09 — 003.05 + 003.06 — FIFO cost-basis ledger + tax preview in quote. PR #32. 132/132 green.
- 2026-06-09 — A.mobile.5 + 100.06 — asset picker on PayReview + beta invite codes. PR #31. 127/127 green.
- 2026-06-09 — 030.* + 015.03-04 + 035.01 — chain adapters + smart wallet stub. PR #30. 122/122 green.
- 2026-06-09 — 090.03-05 + 100.04-05 — load test + backup/restore + security checklist + deploy + runbook. PR #29. 114/114 green.
- 2026-06-09 — 010.02 + 010.03 + 010.05 — Onmeta adapter + HMAC webhook + fallback chain. PR #28. 114/114 green.
- 2026-06-09 — 070.* — compliance pipeline (KYC + KYT + auto-freeze + FIU-IND CSV). PR #27. 109/109 green.
- 2026-06-09 — 080.02 + 080.05 — Prometheus /metrics + correlation IDs. PR #26. 101/101 green.
- 2026-06-09 — 040.* — bills + mandates (BBPS catalogue + executor + revoke). PR #25. 98/98 green.
- 2026-06-09 — 035.* — yield-while-idle (Aave-stub). PR #24. 93/93 green.
- 2026-06-09 — 090.01 + 090.02 — replay attack tests + intent fuzz tests. PR #23. 86/86 green.
- 2026-06-09 — 025.* — Intent gateway (UPI deeplinks / Bharat QR / checkout). PR #22. 49/49 green.
- 2026-06-09 — 020.* — agent surface (session keys + /v1/agent/pay-upi + MCP server). PR #21. 39/39 green.
- 2026-06-09 — 003.03 — per-step cost breakdown in quote. PR #20. 32/32 green.
- 2026-06-09 — 002.03 — reconciliation sweeper for orphan USDC_RECEIVED. PR #19. 30/30 green.
- 2026-06-09 — 002.05 — PII-redactor + pino serializers; masks auth_proof, signatures, VPAs to `xx***@bank`. PR #18. 29/29 green.
- 2026-06-09 — 002.07 — idempotency-key TTL cleanup (24h key rotate, 90d row purge). PR #17. 24/24 green.
- 2026-06-09 — 003.01 — live INR rates via CoinGecko + 30s cache + fallback. PR #16. 23/23 green.
- 2026-06-09 — 002.04 — GET /v1/users/:id/tds/summary (per-quarter §194S aggregation). PR #15. 20/20 green.
- 2026-06-09 — 002.06 — per-user rate limiting (quote 10/min, settle 5/min) + 429. PR #14. 18/18 green.
- 2026-06-09 — A.mobile.2 — real biometric on Confirm (expo-local-authentication, FaceID/Fingerprint, web no-op). PR #13. 16/16 green.
- 2026-06-09 — A.mobile.8 + A.mobile.9 — Settings API URL switcher + recent payees autocomplete + quick-amount chips. PR #12. 16/16 green.
- 2026-06-09 — 002.02 + A.mobile.4 — GET /v1/transactions/:id with timeline + mobile TxDetail screen via HistoryStack. PR #11. 16/16 green.
- 2026-06-08 — A.expo-web — Expo Web (react-native-web + react-dom + @expo/metro-runtime). PR #10. 14/14 green.
- 2026-06-08 — A.health-banner — ConnectionBanner + fix `require("expo-constants").default` crash + label web demo as BACKEND DEBUG. PR #8. 14/14 green.
- 2026-06-08 — A.continuity — 5 redundant ways to keep the loop running (Claude Web, Antigravity, GHA cron, VPS cron, Cursor/Cline) + cross-platform tick lock + anti-friction rules. PR #9. 14/14 green.
- 2026-06-08 — A.expo56 — upgrade mobile to Expo SDK 56 + React 19.2 + RN 0.85. PR #7. 14/14 green.
- 2026-06-08 — A.app-shell — real app shape: bottom tabs (Home/Pay/History/Settings), 3-screen Pay flow, design tokens, Button + Pill components, haptics. PR #6. 14/14 green.
- 2026-06-08 — A.mobile-fix — add missing expo-constants dep (caught by typecheck). PR #5.
- 2026-06-08 — A.mobile — Expo (React Native) scaffold + CORS on backend; India-compliance positioning locked in MISSION.md. PR #4. 12/12 green.
- 2026-06-08 — A.fix — isolate test DBs per-file (CI race fix). PR #3.
- 2026-06-08 — A.deploy — Dockerfile + render.yaml + fly.toml + docs/RUN.md. PR #2.
- 2026-06-08 — A.01 — demo HTML page at / + MISSION/AGENTS orchestration upgrade + idempotent seeding fix. PR #1.
- 2026-06-08 — 002.01 — added GET /v1/quotes/:id; 3 new tests. Initial seed before PR mode.
- 2026-06-08 — v0.0.1 — bootstrap. Fastify + SQLite ledger + quote/settle/webhook routes + 4 e2e tests passing.

## Decisions locked (do not re-litigate)

- **First user model:** human = first tester, not reviewer. Loop auto-merges its own PRs once green + reviewed. Human only checks the running app and writes to FEEDBACK.md.
- **Backend language:** TypeScript (Node 22, ES modules).
- **HTTP framework:** Fastify.
- **Storage v0:** SQLite via better-sqlite3. Postgres in v0.0.4.
- **Validation:** Zod.
- **Schema:** INR amounts in integer rupees; crypto amounts in 8dp decimal strings.
- **Idempotency:** UUID keys, unique index, on both quote and settle.
- **Quote TTL:** 30 seconds.
- **TDS rate:** 1% (statutory §194S).
- **Default spread:** 40 bps.
- **Off-ramp v0:** mock; Onmeta in v0.1.
- **Settlement chain v0:** Base (USDC).
- **Smart wallet model:** ERC-4337 + Privy passkeys.
- **PR policy:** every task → branch `claude/blissful-davinci-Jw9jf/task-<id>` → PR into `claude/blissful-davinci-Jw9jf` → self-review → auto-merge on green.

## Blocked items requiring human input

(none yet — see `[B]` items in ROADMAP.md for future blockers)

## Failed tasks (need investigation)

(none)

## Mission vetoes (Mission Guardian rejections — for human awareness)

(none)

## Needs clarification (ambiguous feedback notes)

(none)

## Safety counters

- `consecutive_block_count`: 0
- `consecutive_failure_count`: 0
- `ci_failures_today`: 0
- HALT thresholds: blocks ≥ 5, failures ≥ 3, ci_failures ≥ 5/day

## Notes for next tick

- Drain FEEDBACK.md before ROADMAP.md.
- After completing a task, mark `[x]` in ROADMAP.md AND append to "Completed log".
- If blocked, mark `[B]` AND add Blocked-items entry naming exact service/credential needed.
- Skip blocked tasks; always pick lowest-numbered unblocked `[ ]`.
- Commit messages prefix with task id, e.g. `002.02: ...`.

## Operating parameters

- `allow_pr`: true
- `allow_real_network_calls`: false
- `allow_real_money`: false (permanent)
- `max_tasks_per_tick`: 1
- `halt_on_test_failure`: true
- `merge_method`: squash
- `pr_target_branch`: claude/blissful-davinci-Jw9jf
- `human_in_the_loop`: false (loop does not ask, test, or wait for human)

## Cross-platform tick lock

The loop may be running from multiple platforms (Claude Web, Antigravity, GHA cron,
VPS cron, Cursor/Cline — see CONTINUITY.md). Coordinator prevents double-work.

`tick_holder`:
- platform: (none)
- started_at: (none)
- expires_at: (none)

Before any code work, write self to tick_holder with expires_at = now + 10min and push.
If a holder exists with expires_at > now AND platform != self: SKIP this tick, log to
Coordination log below, exit cleanly.

## Coordination log (skipped ticks)

(none)
