# Loop Continuity — 5 Ways to Keep Building Without You

You are NOT in the loop. The loop must keep running even if any one platform goes down, your tokens deplete on one provider, or a single session crashes. This doc lists every redundant path. **Set up at least 3.**

Each path runs the same prompt (`LOOP_PROMPT.md`) against the same repo (`rgowda96/autonomous-usdt-withdrawal`) on the same branch (`claude/blissful-davinci-Jw9jf`). Memory lives in `STATE.md` / `ROADMAP.md` / `FEEDBACK.md` — fresh sessions read those.

---

## Path 1 — Claude Code on the Web (primary)

**Why:** Native to this project, GitHub-integrated, has the github MCP, runs in a managed container.

**Setup (5 min):**
1. Go to https://code.claude.com → open `rgowda96/autonomous-usdt-withdrawal`.
2. Click **Triggers** → **New Scheduled Trigger**.
3. Cadence: every 30 minutes (`*/30 * * * *`).
4. Branch: `claude/blissful-davinci-Jw9jf`.
5. Paste the prompt from `LOOP_PROMPT.md`.
6. Save.

Each fire spawns a fresh session, reads MISSION/STATE/FEEDBACK/ROADMAP, does one task, opens PR, self-merges if green.

Cap: depends on your plan's per-trigger session budget. Expect 48 ticks/day max.

---

## Path 2 — Google Antigravity (redundant agent platform)

**Why:** Independent provider, different LLM (Gemini), different infra. If Anthropic's API is rate-limited, Antigravity keeps going.

**Setup:**
1. Go to https://antigravity.google → sign in.
2. Connect the GitHub repo.
3. Create an **Agent** (not a one-shot task).
4. Trigger: scheduled, every 45 min (offset from Claude's 30 so they don't both pick the same task).
5. System prompt: paste contents of `CLAUDE.md`.
6. User prompt: paste contents of `LOOP_PROMPT.md`.
7. Tools: enable GitHub + Shell + File-read/write.

**Race-condition note:** Both platforms might pick the same `ROADMAP.md [ ]` simultaneously. Mitigation: STATE.md has a `tick_holder` field. The Orchestrator writes its own ID + timestamp to that field at the start of each tick; another agent finding a `tick_holder` < 10 min old skips this tick. (See Section "Cross-platform lock".)

---

## Path 3 — GitHub Actions cron (free, reliable)

**Why:** GitHub-native. Doesn't depend on any LLM platform's scheduler. Triggers a workflow that calls whichever LLM API you have a key for.

**Setup:** the workflow already exists at `.github/workflows/loop.yml` (added in this PR). It:
1. Runs every hour (`0 * * * *`).
2. Calls Anthropic's API with `MISSION + AGENTS + STATE + FEEDBACK + ROADMAP + LOOP_PROMPT` as the system+user prompt.
3. Lets the model emit a sequence of bash commands.
4. Executes them inside the runner.
5. Pushes results.

**You provide:** an `ANTHROPIC_API_KEY` secret in repo settings → Actions. Cost ~$0.30/tick at current Sonnet 4.7 pricing → ~$7/day at hourly cadence.

---

## Path 4 — Local cron on a server you control (a $5 Hetzner VPS / your laptop)

**Why:** Zero platform dependency. If everyone else is down, this still runs.

**Setup:** the repo includes `scripts/loop-tick.sh`. On any always-on machine with Node + `claude` CLI installed:

```bash
git clone https://github.com/rgowda96/autonomous-usdt-withdrawal.git
cd autonomous-usdt-withdrawal
crontab -e
# add:
*/30 * * * * cd /path/to/autonomous-usdt-withdrawal && ./scripts/loop-tick.sh >> ./loop.log 2>&1
```

The script: pulls latest, invokes `claude` with the loop prompt, captures stdout/stderr.

---

## Path 5 — Cursor / Cline background agent

**Why:** If you're using Cursor or Cline anyway, attach the loop to its task queue.

**Setup:**
1. In Cursor: open repo → command palette → "Run Background Agent" → paste prompt → set recurring (Cursor Tab Pro feature).
2. In Cline: install the VSCode extension → schedule via Cline's "Scheduled Tasks" UI.

Lower priority than 1-4 because it depends on your desktop being on.

---

## Cross-platform lock (so paths don't fight each other)

`STATE.md > Operating parameters` has:
```
tick_holder: { platform: <name>, started_at: <iso>, expires_at: <iso> }
```

The Orchestrator at step 1 of each tick:
1. Read `tick_holder`. If `expires_at > now()` AND `platform != self`: skip this tick, log to `Coordination log`, exit.
2. Otherwise: write `{ platform: self, started_at: now(), expires_at: now() + 10min }`, push to working branch BEFORE doing any code work.
3. At end of tick (success OR failure): clear `tick_holder` and push.

If two platforms race in the same second, one's commit wins (the loser gets a non-fast-forward, retries on next tick).

---

## Resume / pause / kill switches

| Action | How |
|---|---|
| **Pause all loops** | Edit `STATE.md`: set `consecutive_block_count: 99` and push. Every tick on every platform halts. |
| **Resume all loops** | Edit `STATE.md`: reset `consecutive_block_count: 0`. |
| **Kill one platform** | Disable the trigger on that platform; others keep running. |
| **Drop a task** | Add a `## [open]` block to `FEEDBACK.md` and push — next tick drains it before ROADMAP. |
| **Veto autonomously** | Mission Guardian VETOes get logged in `STATE.md > mission_vetoes`; the human can read them later. |
| **Final stop** | When ROADMAP has zero `[ ]` items, every platform writes a HALT entry and exits without action. |

---

## What the human (you) does

- **Once a week:** glance at the merged commits on `claude/blissful-davinci-Jw9jf` and the open `[B]` items in ROADMAP.
- **When the loop is stuck on `[B]` items needing real creds:** supply the credential (Onmeta key, Privy app id, Pimlico key, Sumsub creds, etc.), commit it to `.env` on a fresh branch (NOT pushed — local-only), the next tick reads it.
- **Never:** review PRs (Mission Guardian + Code Reviewer + Security Reviewer already did it); merge PRs (Merger already did); test code (CI is the test); make architecture decisions (Architect agent does it); choose libraries (logged in STATE.md > Decisions locked).

That's it. The end state is `ROADMAP.md` fully `[x]` and `[B]` only, with `STATE.md` final-summary appended.
