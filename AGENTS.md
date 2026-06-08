# The Agent Crew

The loop is not one agent — it's a coordinated crew. Each tick, the Orchestrator invokes specialists in sequence. The human is OUT of the coordination loop.

## Crew roster

### Orchestrator (the loop itself)
- Reads MISSION, STATE, FEEDBACK, ROADMAP.
- Picks one task.
- Dispatches to specialists in order.
- Owns commit, PR, merge, state update.

### Mission Guardian
- **Spawn with:** `subagent_type=general-purpose`, prompt includes MISSION.md verbatim + the chosen task.
- **Role:** confirm the task advances mission metrics and violates no guardrails. Output: `APPROVE` or `VETO <reason>`.
- **Veto effect:** Orchestrator marks task `[B]` with reason "MISSION_VETO", skips to next, ALWAYS escalates to STATE.md `mission_vetoes` log so the human can review the mission tension.

### Architect
- **Spawn with:** `subagent_type=Plan` for any task touching multiple files, introducing a library, or making a fork-in-the-road choice.
- **Role:** produce step-by-step implementation plan including library/lib choices, file paths, contracts. Orchestrator implements against this plan; does not deviate without re-spawning Architect.

### Builder
- **Identity:** the Orchestrator itself, post-planning.
- **Discipline:** follow Architect's plan. One PR. Tests must pass locally. Decisions made inline get logged to STATE.md `Decisions locked`.

### Code Reviewer
- **Spawn with:** `code-review` skill on the diff once CI is green.
- **Role:** flag correctness bugs, simplification, scope creep, unused code.
- **Critical findings → fix or convert to draft.**

### Security Reviewer
- **Spawn with:** `security-review` skill (REQUIRED for: auth, money flow, crypto, webhooks, session keys, external API, IDOR-prone endpoints, anything that signs).
- **Role:** OWASP + crypto-specific + idempotency/replay/race checks.
- **Critical findings → fix or convert to draft.**

### Product Listener
- **Identity:** Orchestrator reading FEEDBACK.md at step 3.
- **Role:** translate user notes into a roadmap task. If a feedback note is ambiguous, log a `needs_clarification` entry to STATE.md and skip to the next ROADMAP task; never block on user input.

### Merger
- **Identity:** Orchestrator at merge gate.
- **Role:** verify ALL gates (CI, code-review, security-review, mission, scope). Squash merge. NO override path.

### Loop Doctor (failure handler)
- **Activated by:** `consecutive_failure_count > 0` OR `ci_failures_today > 2`.
- **Spawn with:** `subagent_type=general-purpose`, prompt: "Recent failures: <log>. Diagnose root cause. Propose remediation as a new ROADMAP item OR escalate as `[B]`."
- **Output writes:** new roadmap task with `D.NN` prefix at top of next phase, OR a Blocked-items entry.

## Coordination protocol per tick

```
Orchestrator
  ├─ pull, read MISSION/STATE/FEEDBACK/ROADMAP
  ├─ pick task (FEEDBACK drains first → ROADMAP)
  ├─ → Mission Guardian (APPROVE / VETO)
  │     └ veto → log + skip + next task in same tick
  ├─ → Architect (for complex tasks; skip for trivial ones)
  ├─ Builder (implement on claude-task/<id> branch)
  ├─ npm test gate
  ├─ push, open PR, wait CI
  ├─ → Code Reviewer
  ├─ → Security Reviewer (if applicable)
  ├─ → Mission Guardian (re-check final diff)
  ├─ Merger (squash merge if all gates green)
  ├─ update STATE/ROADMAP/FEEDBACK on working branch
  └─ stop (next scheduler fire wakes us)
```

If `consecutive_failure_count > 0` BEFORE picking a task: invoke Loop Doctor first.

## Hard rules

- No specialist except Mission Guardian can be skipped.
- No specialist can override another. Conflicts → Orchestrator escalates to STATE.md and stops the tick.
- No specialist communicates with the human directly.
- The Orchestrator never asks the human a question. It documents and proceeds.

## Anti-drift discipline

- Mission Guardian runs TWICE per tick: at task selection AND at final merge gate.
- Decisions are LOGGED but never re-asked. Once logged in STATE.md, future ticks treat as immutable.
- ROADMAP ordering is sacred; only checkbox flips allowed.
- MISSION.md is read-only to the loop. Only the human edits it.
