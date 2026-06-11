import { useEffect, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import * as Haptics from "expo-haptics";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useCallback } from "react";
import { Button } from "../components/Button";
import { getRecentPayees, recordPayee, type RecentPayee } from "../storage";
import { theme } from "../theme";
import type { PayFlowParamList } from "../navigation";

export function PayEnterScreen() {
  const nav = useNavigation<NativeStackNavigationProp<PayFlowParamList>>();
  const [vpa, setVpa] = useState("swiggy@hdfc");
  const [amount, setAmount] = useState("500");
  const [recent, setRecent] = useState<RecentPayee[]>([]);

  useFocusEffect(useCallback(() => {
    getRecentPayees().then(setRecent);
  }, []));

  const onContinue = async () => {
    const inr = parseInt(amount, 10);
    if (!vpa.includes("@")) return Alert.alert("Invalid VPA", "Format: name@bank");
    if (!inr || inr < 1) return Alert.alert("Invalid amount");
    const trimmed = vpa.trim();
    await recordPayee(trimmed, trimmed.split("@")[0]);
    nav.navigate("PayReview", { vpa: trimmed, amountInr: inr });
  };

  const pickRecent = (p: RecentPayee) => {
    Haptics.selectionAsync().catch(() => {});
    setVpa(p.vpa);
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={s.flex}>
      <ScrollView style={s.scroll} contentContainerStyle={s.container} keyboardShouldPersistTaps="handled">
        <Text style={s.h1}>Pay</Text>
        <Text style={s.sub}>Send to any UPI VPA. Routing picks the cheapest asset.</Text>

        <View style={s.card}>
          <Text style={s.label}>Pay to</Text>
          <TextInput
            value={vpa}
            onChangeText={setVpa}
            style={s.input}
            placeholder="merchant@bank"
            placeholderTextColor={theme.color.textFaint}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
          />
          {recent.length > 0 && (
            <View style={s.chipsWrap}>
              <Text style={s.chipsLabel}>Recent</Text>
              <View style={s.chips}>
                {recent.slice(0, 6).map((p) => (
                  <Pressable
                    key={p.vpa}
                    onPress={() => pickRecent(p)}
                    style={({ pressed }) => [s.chip, pressed && { opacity: 0.6 }]}
                  >
                    <Text style={s.chipText}>{p.display_name ?? p.vpa.split("@")[0]}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          )}
          <Text style={[s.label, { marginTop: theme.space.lg }]}>Amount</Text>
          <View style={s.amountRow}>
            <Text style={s.rupee}>₹</Text>
            <TextInput
              value={amount}
              onChangeText={setAmount}
              style={s.amountInput}
              placeholder="0"
              placeholderTextColor={theme.color.textFaint}
              keyboardType="number-pad"
            />
          </View>
          <View style={s.quickAmounts}>
            {[100, 500, 1000, 2500].map((a) => (
              <Pressable
                key={a}
                onPress={() => { Haptics.selectionAsync().catch(() => {}); setAmount(String(a)); }}
                style={({ pressed }) => [s.amountChip, pressed && { opacity: 0.6 }]}
              >
                <Text style={s.amountChipText}>₹{a}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={{ height: theme.space.xl }} />

        <Button label="Continue" onPress={onContinue} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { flex: 1, backgroundColor: theme.color.bg },
  container: { padding: theme.space.lg, paddingBottom: theme.space.xxl },
  h1: { color: theme.color.text, fontSize: theme.font.h1, fontWeight: "700", marginBottom: theme.space.xs },
  sub: { color: theme.color.textDim, fontSize: theme.font.small, marginBottom: theme.space.xl },
  card: { backgroundColor: theme.color.bgElev, borderRadius: theme.radius.lg, borderWidth: 1, borderColor: theme.color.border, padding: theme.space.lg },
  label: { color: theme.color.textDim, fontSize: theme.font.small, marginBottom: theme.space.sm },
  input: { backgroundColor: theme.color.bg, borderWidth: 1, borderColor: theme.color.border, borderRadius: theme.radius.md, padding: theme.space.md, color: theme.color.text, fontSize: theme.font.h3 },
  chipsWrap: { marginTop: theme.space.md },
  chipsLabel: { color: theme.color.textDim, fontSize: theme.font.tiny, marginBottom: theme.space.sm, textTransform: "uppercase", letterSpacing: 0.6, fontWeight: "700" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: theme.space.sm },
  chip: { backgroundColor: theme.color.bg, borderWidth: 1, borderColor: theme.color.border, paddingHorizontal: theme.space.md, paddingVertical: 6, borderRadius: theme.radius.pill },
  chipText: { color: theme.color.text, fontSize: theme.font.small, fontWeight: "500" },
  amountRow: { flexDirection: "row", alignItems: "center", backgroundColor: theme.color.bg, borderWidth: 1, borderColor: theme.color.border, borderRadius: theme.radius.md, paddingHorizontal: theme.space.md },
  rupee: { color: theme.color.textDim, fontSize: 28, marginRight: theme.space.sm },
  amountInput: { flex: 1, color: theme.color.text, fontSize: 32, fontWeight: "600", padding: theme.space.md },
  quickAmounts: { flexDirection: "row", gap: theme.space.sm, marginTop: theme.space.md },
  amountChip: { flex: 1, backgroundColor: theme.color.bg, borderWidth: 1, borderColor: theme.color.border, paddingVertical: theme.space.sm, borderRadius: theme.radius.md, alignItems: "center" },
  amountChipText: { color: theme.color.text, fontSize: theme.font.small, fontWeight: "500" },
});
