# First-User Feedback

You (rakshak.gowda96@gmail.com) are the first user. Drop notes here in any form — bullets, paragraphs, rants. The loop reads this file BEFORE the ROADMAP every tick and treats unaddressed items as the highest-priority work.

## How to use this file

- Add a new `## [open]` block whenever you have feedback.
- Loop will pick the oldest `## [open]` block, implement it, then change the header to `## [done]` with a one-line note about what shipped.
- Use any wording — the loop will interpret. If unclear, it'll ask via STATE.md `needs_clarification` (you'll see it next time you check).
- Tag with `[blocker]` if it must be fixed before any other roadmap work proceeds.
- Tag with `[ux]`, `[bug]`, `[feature]`, `[copy]`, `[idea]` to help the loop scope.

## Examples (delete after reading)

```
## [open] [ux] 2026-06-08
The quote response is hard to read in JSON. Can we have a simple HTML page that shows the
flow visually — scan QR → see quote → confirm → see receipt — so I can actually feel the product?
```

```
## [open] [bug] 2026-06-08
When I send a quote for ₹10, the source_amount comes back with 8 decimal places. Round to 6.
```

```
## [open] [feature] 2026-06-08
Add a "Recent payees" list so I don't have to type the VPA every time.
```

---

# Open feedback

(none yet — the loop is waiting for your first note)

# Done feedback

(empty)
