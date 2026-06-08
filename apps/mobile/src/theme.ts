export const theme = {
  color: {
    bg: "#0b0d12",
    bgElev: "#151922",
    border: "#232838",
    text: "#e6e8ee",
    textDim: "#8a92a6",
    textFaint: "#5a627a",
    accent: "#4f8cff",
    accentDim: "#2c5cb8",
    ok: "#2ecc71",
    warn: "#e8b500",
    err: "#ff5d6c",
    overlay: "rgba(0,0,0,0.65)",
  },
  radius: { sm: 6, md: 10, lg: 14, xl: 20, pill: 999 },
  space: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 },
  font: {
    mono: "Menlo",
    h1: 28,
    h2: 22,
    h3: 17,
    body: 15,
    small: 13,
    tiny: 11,
  },
} as const;

export type Theme = typeof theme;
