# Loop State

Single source of truth for what the autonomous loop has done, decided, and is blocked on.
Loop MUST update this file every tick before exiting.

---

## Cursor

Next task to attempt: **002.02**

Last completed: **002.01 — GET /v1/quotes/:id endpoint + 3 tests** (commit on `claude/blissful-davinci-Jw9jf`)

## Completed log (newest first)

- 2026-06-08 — 002.01 — added GET /v1/quotes/:id; 3 new tests (happy, 404, expired flag); total 7/7 green.
- 2026-06-08 — v0.0.1 — bootstrap. Fastify + SQLite ledger + quote/settle/webhook routes + 4 e2e tests passing.

## Decisions locked (do not re-litigate)

- **Backend language:** TypeScript (Node 22, ES modules).
- **HTTP framework:** Fastify.
- **Storage v0:** SQLite via better-sqlite3. Postgres migration in v0.0.4.
- **Validation:** Zod.
- **Schema:** all monetary amounts in INR are integers (paise-free, INR-major); crypto amounts are decimal strings with 8 dp.
- **Idempotency:** UUID keys, unique index, both quote and settle endpoints.
- **Quote TTL:** 30 seconds.
- **TDS rate:** 1% (statutory §194S).
- **Default spread:** 40 bps.
- **Off-ramp v0:** mock adapter; Onmeta v0.1; Cashfree v0.4+.
- **Settlement chain v0:** Base (USDC). Solana, Tron added later.
- **Smart wallet model:** ERC-4337 with Privy passkeys.
- **Branch policy:** loop only commits to `claude/blissful-davinci-Jw9jf`. Never create PRs unless `state.allow_pr = true` (currently false).
- **Test discipline:** `npm test` must pass before commit. If it fails, retry once; if still fails, mark task FAILED in this file and skip.

## Blocked items requiring human input

(none yet — see `[B]` items in ROADMAP.md for future blockers)

## Failed tasks (need investigation)

(none)

## Notes for next tick

- After completing a task, mark `[x]` in ROADMAP.md AND append to "Completed log" above.
- If blocked, mark `[B]` in ROADMAP.md AND add an entry under "Blocked items" with what's needed.
- Skip blocked tasks; always pick lowest-numbered unblocked `[ ]` item.
- Keep commit messages prefixed with the task id, e.g. `002.01: add GET /v1/quotes/:id`.

## Operating parameters

- `allow_pr`: false
- `allow_real_network_calls`: false  (testnets and mocks only)
- `allow_real_money`: false  (always — never flip this)
- `max_tasks_per_tick`: 1
- `halt_on_test_failure`: true
