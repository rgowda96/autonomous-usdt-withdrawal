# The Loop Prompt

This is the exact prompt to paste into the **Claude Code on the Web → Scheduled Trigger** for this repo. Set it to run every **30 minutes**, against branch `claude/blissful-davinci-Jw9jf`.

---

## Copy-paste this as the trigger prompt:

```
Advance StablePay autonomously per CLAUDE.md.

Protocol:
1. Pull latest on claude/blissful-davinci-Jw9jf.
2. Read STATE.md (check safety counters; HALT if tripped).
3. Read FEEDBACK.md — if any [open] block exists, address the OLDEST one.
4. Otherwise read ROADMAP.md — pick the lowest-numbered [ ] task not marked [B].
5. Use the Expert Council table in CLAUDE.md to invoke specialized agents/skills
   BEFORE writing code when useful (Plan / Explore / code-review / security-review / etc.).
6. Implement on a task branch claude/blissful-davinci-Jw9jf/task-<id>.
7. Local tests must pass (npm test).
8. Push, open PR targeting claude/blissful-davinci-Jw9jf via the GitHub MCP.
9. Wait for CI; self-review via code-review skill; security-review if applicable.
10. Merge with squash IF AND ONLY IF: CI green, no CRITICAL findings, scope clean.
11. Update STATE.md + ROADMAP.md + FEEDBACK.md on the working branch and push.
12. Stop. Do not start another task.

Hard rules:
- Never merge into main. Always target claude/blissful-davinci-Jw9jf.
- Never bypass the test gate.
- Never use real-money rails. Mock/testnet only.
- Mark blockers as [B] and document in STATE.md.
- The human is NOT in the loop. Make product, UX, library, and architecture decisions
  yourself and log them under STATE.md > Decisions locked.
```

---

## How to set this up in Claude Code on the Web

1. Open https://code.claude.com → your repo `rgowda96/autonomous-usdt-withdrawal`.
2. Click **Triggers** (or "Schedules" — UI name varies; docs: https://code.claude.com/docs/en/claude-code-on-the-web).
3. **New scheduled trigger.**
4. **Cadence:** every 30 minutes (cron `*/30 * * * *`).
5. **Branch:** `claude/blissful-davinci-Jw9jf`.
6. **Prompt:** paste the block above.
7. **Save.**

The first fire will pick up wherever `STATE.md` says the cursor is. From then on it self-drives.

## Notes

- Each trigger fire spawns a fresh session. State lives in `STATE.md` / `ROADMAP.md` / `FEEDBACK.md` (committed to repo) — that's how the loop has "memory" across ticks.
- If you want to nudge the build: drop a note in `FEEDBACK.md`, push to the working branch, the next tick picks it up.
- If you want to pause: in `STATE.md`, set `consecutive_block_count: 5` — the loop will HALT until you reset it.
- If you want to resume: reset all safety counters to 0 in `STATE.md`, push, next tick resumes.
- If you want to bring more humans (real users) on: that's roadmap phase L (mobile) and phase P (launch). Loop will get there.
