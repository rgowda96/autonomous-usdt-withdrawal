#!/usr/bin/env bash
# loop-tick.sh — run one autonomous tick.
# Used by GitHub Actions / VPS cron / any scheduler.
# Assumes `claude` CLI is installed and ANTHROPIC_API_KEY is set, OR you've
# adapted the body to call a different runner (gemini-cli, open-claude, etc.).

set -euo pipefail

# Refresh
git fetch origin
git checkout claude/blissful-davinci-Jw9jf
git pull --ff-only origin claude/blissful-davinci-Jw9jf

PROMPT=$(cat <<'EOF'
Advance StablePay per CLAUDE.md.
Protocol:
1. Read MISSION.md, AGENTS.md, STATE.md, FEEDBACK.md, ROADMAP.md.
2. Check safety counters in STATE.md; HALT if tripped.
3. Drain FEEDBACK.md [open] items first; otherwise pick lowest-numbered [ ] task in ROADMAP not [B].
4. Spawn Mission Guardian; require APPROVE.
5. Implement on branch claude-task/<id>. npm test must pass.
6. Push, open PR via gh CLI targeting claude/blissful-davinci-Jw9jf.
7. Wait CI (poll until terminal, max 10 min).
8. Run code-review skill on diff; if CRITICAL, fix + re-push once.
9. Run security-review if task touches auth/money/crypto/webhook/api.
10. Spawn Mission Guardian #2 on final diff; require APPROVE.
11. Merge with squash IF AND ONLY IF all gates green.
12. Update STATE.md + ROADMAP.md + FEEDBACK.md on working branch and push directly (no PR for state files).
13. Stop. Do not start another task.

Hard rules:
- Never merge into main; always target claude/blissful-davinci-Jw9jf.
- Never bypass test gate. Never use real-money rails.
- Mark blockers as [B] in ROADMAP and document in STATE.md.
- Human is NOT in the loop; make product/UX/library/architecture decisions yourself.
EOF
)

if command -v claude >/dev/null 2>&1; then
  echo "$PROMPT" | claude --dangerously-skip-permissions
else
  echo "::error::No agent runner found. Install claude CLI: npm install -g @anthropic-ai/claude-code"
  exit 1
fi
