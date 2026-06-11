# StablePay Design System — "Quiet Premium"

The design exists to make one thing obvious in under a second: **you are
getting a fair deal, and here is the proof.** Everything else is calm so the
value-prop is loud.

## Principles

1. **Money is the hero.** Big, heavy, tight-tracked numerals. The balance and
   the savings are the largest things on screen.
2. **Emerald means "in your favour."** The savings green (`#34d399`) is used
   *only* for value-positive moments — lifetime saved, "you save ₹X". Never
   for a generic button. This trains the eye: green = you won.
3. **One brand action colour.** Indigo (`#6c7cff`) for all primary actions,
   focus, links. No rainbow of CTAs.
4. **Calm canvas.** Near-black (`#08090d`) so numbers and the single accent
   pop. Surfaces are subtle gradients, not flat cards, so it reads as an app.
5. **Show the receipt.** Every price has a teardown one tap away. We never ask
   the user to trust a single number — RedotPay's whole flaw was the hidden
   spread.
6. **Native feel.** Soft elevation, generous radii (16–28px), haptics on every
   commit, real screen transitions. No webpage-in-a-shell.

## Tokens (`apps/mobile/src/theme.ts`)

### Colour
| Token | Hex | Use |
|---|---|---|
| `bg` | `#08090d` | App canvas |
| `bgElev` / `bgElev2` | `#11131b` / `#171a24` | Cards, inputs |
| `border` / `borderSoft` | `#222634` / `#1a1d28` | Hairlines |
| `text` / `textDim` / `textFaint` | `#f2f4f8` / `#9aa3b8` / `#5b6377` | Type hierarchy |
| `brand` / `brandSoft` | `#6c7cff` / 14% | Primary action, focus |
| `savings` / `savingsSoft` | `#34d399` / 14% | **Value-positive ONLY** |
| `warn` / `err` | `#fbbf24` / `#fb7185` | Semantic |
| `gradHero*` | `#1b1f3a → #0e1020` | Balance hero |
| `gradSavings*` | `#0f2e26 → #0b1714` | Savings surfaces |

### Type scale
`display 40 / h1 28 / h2 22 / h3 17 / body 15 / small 13 / tiny 11 / micro 10`,
with weights `regular…heavy (400–800)` and tracking `tight -0.4 … wider 1.0`.
Money uses `display` + `heavy` + `tight`. Section labels use `tiny` +
`uppercase` + `wide`.

### Space / radius / shadow
- Space scale: `4 / 8 / 12 / 16 / 24 / 32 / 44`.
- Radius: `8 / 12 / 16 / 22 / 28 / pill`.
- Shadow: `card` (subtle) and `floating` (modals/FABs) tokens.

## Components

- **`GradientCard`** — the base elevated surface. Hero and savings variants.
- **`SavingsHero`** — lifetime ₹ saved vs RedotPay. Home only. Emerald.
- **`FxComparison`** (in `OnlineScreen`) — the receipt: mid-market, your rate,
  fee, TDS, struck-through RedotPay total, "you save" pill.
- **`Button`** — primary (brand) / secondary (outline) / ghost. Haptics built
  in.
- **`Pill`** — status chips (ok/warn/err/info).

## Key screens

| Screen | Job |
|---|---|
| **Home** | Balance hero (dual CTA: Pay UPI / Shop USD) + SavingsHero + assets + recent activity |
| **Pay** (flow) | Scan UPI QR → review (route + fee breakdown) → biometric → settled |
| **Shop** (Online) | Merchant grid → live USD quote → FX comparison receipt → biometric → "you saved ₹X" |
| **History** | Transactions + tap-through timeline |
| **Agents** | Session-key manager (mint/revoke, caps, allowlist) |
| **Settings** | Backend URL, account, India-compliance copy |

## Motion & feedback

- Selection haptic on any chip/toggle; success/error notification haptic on
  commit and on a blocked payment.
- Loading is a spinner + label, never a frozen screen.
- Failure modes are first-class: a declined charge shows *why* (insufficient
  USDC), not a generic error.

## Accessibility

- Minimum body text 13px; numerals never below 15px.
- Colour is never the only signal — savings also carries the "You save" label;
  errors carry text, not just red.
- Touch targets ≥ 44px.

## What we will not do

- No skeuomorphic card art as the primary metaphor (RedotPay's framing).
- No more than one accent colour competing with brand + savings.
- No hiding a fee to make a number look smaller. Ever.
