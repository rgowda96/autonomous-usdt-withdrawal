import { useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Button } from "../components/Button";
import { theme } from "../theme";
import type { PayFlowParamList } from "../navigation";

export function PayEnterScreen() {
  const nav = useNavigation<NativeStackNavigationProp<PayFlowParamList>>();
  const [vpa, setVpa] = useState("swiggy@hdfc");
  const [amount, setAmount] = useState("500");

  const onContinue = () => {
    const inr = parseInt(amount, 10);
    if (!vpa.includes("@")) return Alert.alert("Invalid VPA", "Format: name@bank");
    if (!inr || inr < 1) return Alert.alert("Invalid amount");
    nav.navigate("PayReview", { vpa: vpa.trim(), amountInr: inr });
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={s.flex}>
      <View style={s.container}>
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
        </View>

        <View style={{ flex: 1 }} />

        <Button label="Continue" onPress={onContinue} />
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1, backgroundColor: theme.color.bg, padding: theme.space.lg },
  h1: { color: theme.color.text, fontSize: theme.font.h1, fontWeight: "700", marginBottom: theme.space.xs },
  sub: { color: theme.color.textDim, fontSize: theme.font.small, marginBottom: theme.space.xl },
  card: { backgroundColor: theme.color.bgElev, borderRadius: theme.radius.lg, borderWidth: 1, borderColor: theme.color.border, padding: theme.space.lg },
  label: { color: theme.color.textDim, fontSize: theme.font.small, marginBottom: theme.space.sm },
  input: { backgroundColor: theme.color.bg, borderWidth: 1, borderColor: theme.color.border, borderRadius: theme.radius.md, padding: theme.space.md, color: theme.color.text, fontSize: theme.font.h3 },
  amountRow: { flexDirection: "row", alignItems: "center", backgroundColor: theme.color.bg, borderWidth: 1, borderColor: theme.color.border, borderRadius: theme.radius.md, paddingHorizontal: theme.space.md },
  rupee: { color: theme.color.textDim, fontSize: 28, marginRight: theme.space.sm },
  amountInput: { flex: 1, color: theme.color.text, fontSize: 32, fontWeight: "600", padding: theme.space.md },
});
