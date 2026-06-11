import { useCallback, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { GradientCard } from "./GradientCard";
import { api } from "../api";
import { theme } from "../theme";

// The value-prop headline: lifetime INR saved vs RedotPay. Emerald-only.
export function SavingsHero() {
  const [saved, setSaved] = useState(0);
  const [count, setCount] = useState(0);

  const refresh = useCallback(async () => {
    try {
      const r = await api.savings();
      setSaved(r.lifetime_saved_inr ?? 0);
      setCount(r.purchase_count ?? 0);
    } catch { /* ignore */ }
  }, []);

  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));

  return (
    <GradientCard
      colors={[theme.color.gradSavingsStart, theme.color.gradSavingsEnd]}
      borderColor="rgba(52,211,153,0.25)"
      style={{ marginBottom: theme.space.lg }}
    >
      <View style={s.row}>
        <Text style={s.badge}>VS REDOTPAY</Text>
      </View>
      <Text style={s.label}>You've saved</Text>
      <Text style={s.amount}>₹{saved.toLocaleString("en-IN")}</Text>
      <Text style={s.sub}>
        across {count} purchase{count === 1 ? "" : "s"} · billed at real mid-market FX, not ~₹84/$
      </Text>
    </GradientCard>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: "row", marginBottom: theme.space.sm },
  badge: {
    color: theme.color.savings,
    fontSize: theme.font.micro,
    fontWeight: theme.weight.heavy,
    letterSpacing: theme.track.wider,
    backgroundColor: theme.color.savingsSoft,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: theme.radius.pill,
    overflow: "hidden",
  },
  label: { color: theme.color.textDim, fontSize: theme.font.small, fontWeight: theme.weight.medium },
  amount: {
    color: theme.color.savings,
    fontSize: theme.font.display,
    fontWeight: theme.weight.heavy,
    letterSpacing: theme.track.tight,
    marginVertical: 2,
  },
  sub: { color: theme.color.textDim, fontSize: theme.font.small, lineHeight: 19, marginTop: theme.space.xs },
});
