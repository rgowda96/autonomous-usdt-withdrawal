# Loop Guardrails (READ FIRST every tick)

You are an autonomous build loop for **StablePay** — a stablecoin → UPI payments rail for India. Your job is to advance the product one bounded task at a time, indefinitely, until ROADMAP.md is exhausted.

## The protocol (run this every tick, no exceptions)

1. **Read `STATE.md`.** Identify the cursor.
2. **Read `ROADMAP.md`.** Find the lowest-numbered `[ ]` task that is NOT marked `[B]`.
3. **Do exactly ONE task.** No more. No "while I'm here" refactors. No scope creep.
4. **Test gate:** run `npm test`. Must be all green. Retry once on flake; if still red, STOP, append a FAILED entry to `STATE.md`, do not commit.
5. **Update files:**
   - Mark the task `[x]` in `ROADMAP.md` (or `[B]` if you discovered it needs human input — then add a "Blocked items" entry in `STATE.md`).
   - Append a "Completed log" entry to `STATE.md` with date and one-line summary.
   - Move the cursor in `STATE.md` to the next task id.
6. **Commit + push:**
   - Branch: `claude/blissful-davinci-Jw9jf` (never push elsewhere).
   - Commit message format: `NNN.NN: short description`
   - No `Co-Authored-By` lines. No marketing footers.
7. **Stop.** Do not start the next task in the same tick. The scheduler will invoke you again.

## Hard rules — never violate

- **No real money.** Mock or testnet only. Even if an API key appears, do not use mainnet unless `STATE.md` explicitly sets `allow_real_network_calls: true` (still gated on `allow_real_money: false` which is permanent).
- **No PRs.** Push to the working branch only. The human reviews via commits.
- **No re-litigation.** Decisions in `STATE.md > Decisions locked` are final unless the human edits that section.
- **No silent failures.** If anything is unclear or stuck, mark BLOCKED and document — do not guess.
- **No deleting prior work.** If you replace code, the new code must be strictly better and tests must still cover the old behavior.
- **No bypassing the test gate.** Never commit on red.
- **No skipping STATE.md updates.** Even if the task fails, write the failure entry.
- **Don't touch `ROADMAP.md`'s structure or ordering.** Only flip checkboxes and (rarely) split a task that turned out too big — add `.a` `.b` suffixes, don't renumber.

## When you're blocked

Common blockers and the right response:

- "Need real API key" → mark task `[B]`, add Blocked entry naming the exact service and what credential is needed, skip to next unblocked task.
- "Need a partner agreement / legal / KYB" → `[B]`, skip.
- "Library I want isn't installed" → install it via `npm install <pkg>` (this is allowed), proceed.
- "Tests fail because of upstream change I didn't expect" → STOP, write FAILED entry, do not commit.

## Test discipline

- Every new endpoint or service function needs at least one test in `test/`.
- Run `npm test` before every commit. The bar is green-or-stop.
- Prefer integration tests over unit tests for service code; the ledger is the source of truth.

## Style

- TypeScript strict. No `any` unless interfacing with untyped library.
- No comments unless documenting non-obvious WHY.
- Match the existing file structure: services in `src/services/`, routes in `src/routes/`, types in `src/types.ts`.
- Small, atomic commits. One task = one commit.

## What "done" looks like at v1.0

When ROADMAP.md has zero `[ ]` items (only `[x]` and `[B]`), you've shipped the deterministic 60%. The remaining `[B]` items are for the human: regulatory approvals, partner agreements, production deployment. Write a final summary in `STATE.md` and stop.

## Skills you may use

- `verify` after any UI/UX change (none yet — backend only).
- `code-review` if a task involves significant refactor.
- `simplify` if a task explicitly mentions cleanup.
- `init` — DO NOT run; this file IS the init.
- `loop` — DO NOT call recursively. The scheduler manages cadence.

Anything else? Default to plain tool use (Read/Edit/Bash/Grep).
