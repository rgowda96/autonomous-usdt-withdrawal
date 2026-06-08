import { StyleSheet, Text, View } from "react-native";
import { theme } from "../theme";

export function Pill({ label, tone = "warn" }: { label: string; tone?: "ok" | "warn" | "err" | "info" }) {
  const map = {
    ok: { bg: "rgba(46,204,113,0.15)", fg: theme.color.ok },
    warn: { bg: "rgba(232,181,0,0.15)", fg: theme.color.warn },
    err: { bg: "rgba(255,93,108,0.15)", fg: theme.color.err },
    info: { bg: "rgba(79,140,255,0.15)", fg: theme.color.accent },
  } as const;
  const t = map[tone];
  return (
    <View style={[s.pill, { backgroundColor: t.bg }]}>
      <Text style={[s.text, { color: t.fg }]}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  pill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: theme.radius.pill, alignSelf: "flex-start" },
  text: { fontSize: theme.font.tiny, fontWeight: "700", letterSpacing: 0.6 },
});
