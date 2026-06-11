// StablePay design system v2 — "Quiet Premium".
//
// Principles:
//  - Deep near-black canvas so money + savings pop.
//  - One signature brand indigo for actions; emerald reserved EXCLUSIVELY
//    for savings / money-in-your-favour so the value prop reads instantly.
//  - Generous radii + soft elevation for an app, not a webpage.
//  - A real type scale with weights + tracking, not just sizes.
//
// Existing token keys are preserved so older screens keep working; new
// tokens are additive.

export const theme = {
  color: {
    // Canvas
    bg: "#08090d",
    bgElev: "#11131b",
    bgElev2: "#171a24",
    card: "#11131b",
    border: "#222634",
    borderSoft: "#1a1d28",

    // Text
    text: "#f2f4f8",
    textDim: "#9aa3b8",
    textFaint: "#5b6377",

    // Brand (actions, focus, links)
    accent: "#6c7cff",
    accentDim: "#3a45a8",
    accentSoft: "rgba(108,124,255,0.14)",
    brand: "#6c7cff",
    brandSoft: "rgba(108,124,255,0.14)",

    // Savings / money-in-your-favour — emerald, used ONLY for value-positive
    savings: "#34d399",
    savingsSoft: "rgba(52,211,153,0.14)",

    // Semantic
    ok: "#34d399",
    warn: "#fbbf24",
    warnSoft: "rgba(251,191,36,0.14)",
    err: "#fb7185",
    errSoft: "rgba(251,113,133,0.14)",

    // Gradients (start/end pairs for hero surfaces)
    gradHeroStart: "#1b1f3a",
    gradHeroEnd: "#0e1020",
    gradSavingsStart: "#0f2e26",
    gradSavingsEnd: "#0b1714",

    overlay: "rgba(0,0,0,0.7)",
    white: "#ffffff",
  },
  radius: { sm: 8, md: 12, lg: 16, xl: 22, xxl: 28, pill: 999 },
  space: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 44 },
  font: {
    mono: "Menlo",
    display: 40,
    h1: 28,
    h2: 22,
    h3: 17,
    body: 15,
    small: 13,
    tiny: 11,
    micro: 10,
  },
  weight: {
    regular: "400",
    medium: "500",
    semibold: "600",
    bold: "700",
    heavy: "800",
  },
  track: { tight: -0.4, normal: 0, wide: 0.6, wider: 1.0 },
  shadow: {
    // RN shadow tokens (iOS) + elevation (Android)
    card: {
      shadowColor: "#000",
      shadowOpacity: 0.35,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 8 },
      elevation: 6,
    },
    floating: {
      shadowColor: "#000",
      shadowOpacity: 0.45,
      shadowRadius: 28,
      shadowOffset: { width: 0, height: 14 },
      elevation: 12,
    },
  },
} as const;

export type Theme = typeof theme;
