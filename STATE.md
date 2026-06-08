# Loop State

Single source of truth for what the autonomous loop has done, decided, and is blocked on.
Loop MUST update this file every tick before exiting.

---

## Cursor

Next task to attempt: **A.02** (pre-seed demo user on first boot — actually subsumed by A.01 implementation; loop should flip A.02 to [x] on next read and proceed to A.03)

Last completed: **A.01 — demo HTML page at /**

## Priority rules

1. **Always drain `FEEDBACK.md` FIRST.** Open items in FEEDBACK.md are higher priority than ROADMAP.md items. The first user (rakshak.gowda96@gmail.com) is the source of truth on what to build next.
2. Then pick the lowest-numbered `[ ]` unblocked task in ROADMAP.md.
3. Inside ROADMAP.md itself, **TESTABLE-SURFACE tasks come before BACKEND-HARDENING tasks** — get the user a thing to poke.

## Completed log (newest first)

- 2026-06-08 — A.01 — added single-file demo HTML at `/` (vanilla JS, no build). Walks scan → quote → confirm → success → recent txns. Auto-seeds demo user on first boot. Test asserts HTML references all core endpoints. 8/8 green.
- 2026-06-08 — autonomy/mission upgrade — shipped MISSION.md (north-star, immutable), AGENTS.md (crew roster: Orchestrator, Mission Guardian, Architect, Builder, Code Reviewer, Security Reviewer, Product Listener, Merger, Loop Doctor), updated CLAUDE.md to require Mission Guardian gates at both task-selection and pre-merge.
- 2026-06-08 — 002.01 — added GET /v1/quotes/:id; 3 new tests (happy, 404, expired flag); total 7/7 green.
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
