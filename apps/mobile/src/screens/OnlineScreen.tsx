import { useEffect, useState } from "react";
import {
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable,
  ScrollView, StyleSheet, Text, TextInput, View,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useCallback } from "react";
import * as Haptics from "expo-haptics";
import { Button } from "../components/Button";
import { GradientCard } from "../components/GradientCard";
import { api, type OnlineQuote } from "../api";
import { confirmWithBiometric } from "../biometric";
import { theme } from "../theme";

type Merchant = { name: string; emoji: string; country: string };
const MERCHANTS: Merchant[] = [
  { name: "Amazon US", emoji: "📦", country: "US" },
  { name: "AWS", emoji: "☁️", country: "US" },
  { name: "OpenAI", emoji: "🤖", country: "US" },
  { name: "Steam", emoji: "🎮", country: "US" },
  { name: "App Store", emoji: "🍎", country: "US" },
  { name: "Netflix US", emoji: "🎬", country: "US" },
];

type Phase = "form" | "review" | "paying" | "done";

export function OnlineScreen() {
  const [merchant, setMerchant] = useState<Merchant>(MERCHANTS[0]!);
  const [usd, setUsd] = useState("20");
  const [quote, setQuote] = useState<OnlineQuote | null>(null);
  const [phase, setPhase] = useState<Phase>("form");
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState<number | null>(null);

  useFocusEffect(useCallback(() => {
    setPhase("form"); setQuote(null); setSaved(null);
  }, []));

  // Live-quote as the amount changes (debounced).
  useEffect(() => {
    const n = parseFloat(usd);
    if (!n || n <= 0) { setQuote(null); return; }
    const t = setTimeout(async () => {
      try { setQuote(await api.onlineQuote(n)); } catch { setQuote(null); }
    }, 250);
    return () => clearTimeout(t);
  }, [usd]);

  const onReview = () => {
    if (!quote) return Alert.alert("Enter a valid USD amount");
    Haptics.selectionAsync().catch(() => {});
    setPhase("review");
  };

  const onConfirm = async () => {
    const n = parseFloat(usd);
    const auth = await confirmWithBiometric(`Pay $${n} at ${merchant.name}`);
    if (!auth.ok) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      return Alert.alert("Authentication failed");
    }
    setPhase("paying");
    setLoading(true);
    try {
      const r = await api.onlineCharge(merchant.name, n, merchant.country);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setSaved(r.saved_inr);
      setPhase("done");
    } catch (e: any) {
      Alert.alert(e.message === "INSUFFICIENT_USDC" ? "Not enough USDC" : "Payment failed", e.message);
      setPhase("review");
    } finally {
      setLoading(false);
    }
  };

  if (phase === "done") {
    return (
      <View style={s.doneWrap}>
        <View style={s.check}><Text style={s.checkMark}>✓</Text></View>
        <Text style={s.doneTitle}>Paid ${parseFloat(usd)} at {merchant.name}</Text>
        {saved != null && saved > 0 && (
          <GradientCard
            colors={[theme.color.gradSavingsStart, theme.color.gradSavingsEnd]}
            borderColor="rgba(52,211,153,0.25)"
            style={{ alignSelf: "stretch", marginTop: theme.space.xl }}
          >
            <Text style={s.savedLabel}>You just saved</Text>
            <Text style={s.savedAmount}>₹{saved.toLocaleString("en-IN")}</Text>
            <Text style={s.savedSub}>vs what RedotPay would have charged for the same purchase</Text>
          </GradientCard>
        )}
        <Button label="Done" onPress={() => { setPhase("form"); setSaved(null); }} style={{ alignSelf: "stretch", marginTop: theme.space.xl }} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={s.flex}>
      <ScrollView style={s.scroll} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
        <Text style={s.h1}>Shop in USD</Text>
        <Text style={s.sub}>Pay any global merchant from your USDC — billed at real mid-market FX.</Text>

        <Text style={s.section}>Merchant</Text>
        <View style={s.grid}>
          {MERCHANTS.map((m) => {
            const active = m.name === merchant.name;
            return (
              <Pressable
                key={m.name}
                onPress={() => { Haptics.selectionAsync().catch(() => {}); setMerchant(m); }}
                style={[s.merchant, active && s.merchantActive]}
              >
                <Text style={s.merchantEmoji}>{m.emoji}</Text>
                <Text style={[s.merchantName, active && { color: theme.color.text }]} numberOfLines={1}>{m.name}</Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={s.section}>Amount (USD)</Text>
        <View style={s.amountRow}>
          <Text style={s.dollar}>$</Text>
          <TextInput
            value={usd}
            onChangeText={setUsd}
            style={s.amountInput}
            keyboardType="decimal-pad"
            placeholder="0"
            placeholderTextColor={theme.color.textFaint}
          />
        </View>

        {quote && <FxComparison quote={quote} />}

        <View style={{ flex: 1, minHeight: theme.space.xl }} />

        {phase === "form" && <Button label="Review" onPress={onReview} disabled={!quote} />}
        {phase === "review" && (
          <>
            <Button label={loading ? "Paying…" : "Confirm with FaceID"} onPress={onConfirm} loading={loading} />
            <Button label="Edit" variant="ghost" onPress={() => setPhase("form")} style={{ marginTop: theme.space.sm }} />
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function FxComparison({ quote }: { quote: OnlineQuote }) {
  return (
    <GradientCard
      colors={[theme.color.gradHeroStart, theme.color.gradHeroEnd]}
      style={{ marginTop: theme.space.lg }}
    >
      <View style={s.fxRow}>
        <Text style={s.fxLabel}>You pay</Text>
        <Text style={s.fxTotal}>₹{quote.our_inr_total.toLocaleString("en-IN")}</Text>
      </View>
      <View style={s.fxDivider} />
      <Line k="Mid-market rate" v={`₹${quote.mid_market_inr_per_usd.toFixed(2)} / $`} />
      <Line k="Your rate" v={`₹${quote.our_inr_per_usd.toFixed(2)} / $`} accent />
      <Line k="Our fee" v={`₹${quote.our_fee_inr} (${(quote.our_spread_bps / 100).toFixed(2)}%)`} />
      <Line k="TDS (§194S)" v={`₹${quote.tds_inr} · claimable`} />

      <View style={s.compareBox}>
        <View style={s.compareRow}>
          <Text style={s.compareRedotLabel}>RedotPay would charge</Text>
          <Text style={s.compareRedotVal}>₹{quote.redotpay_inr_total.toLocaleString("en-IN")}</Text>
        </View>
        <View style={s.savePill}>
          <Text style={s.saveText}>You save ₹{quote.you_save_inr.toLocaleString("en-IN")} · {quote.you_save_pct.toFixed(1)}%</Text>
        </View>
      </View>
    </GradientCard>
  );
}

function Line({ k, v, accent }: { k: string; v: string; accent?: boolean }) {
  return (
    <View style={s.line}>
      <Text style={s.lineK}>{k}</Text>
      <Text style={[s.lineV, accent && { color: theme.color.text, fontWeight: theme.weight.semibold }]}>{v}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { flex: 1, backgroundColor: theme.color.bg },
  content: { padding: theme.space.lg, paddingBottom: theme.space.xxl, flexGrow: 1 },
  h1: { color: theme.color.text, fontSize: theme.font.h1, fontWeight: theme.weight.bold, letterSpacing: theme.track.tight },
  sub: { color: theme.color.textDim, fontSize: theme.font.small, marginTop: 4, marginBottom: theme.space.xl, lineHeight: 19 },
  section: { color: theme.color.textDim, fontSize: theme.font.tiny, textTransform: "uppercase", letterSpacing: theme.track.wide, fontWeight: theme.weight.bold, marginBottom: theme.space.md },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: theme.space.sm, marginBottom: theme.space.xl },
  merchant: {
    width: "31%", aspectRatio: 1.4, backgroundColor: theme.color.bgElev,
    borderRadius: theme.radius.lg, borderWidth: 1, borderColor: theme.color.border,
    alignItems: "center", justifyContent: "center", padding: theme.space.sm,
  },
  merchantActive: { borderColor: theme.color.brand, backgroundColor: theme.color.brandSoft },
  merchantEmoji: { fontSize: 26, marginBottom: 6 },
  merchantName: { color: theme.color.textDim, fontSize: theme.font.tiny, fontWeight: theme.weight.medium },
  amountRow: {
    flexDirection: "row", alignItems: "center", backgroundColor: theme.color.bgElev,
    borderWidth: 1, borderColor: theme.color.border, borderRadius: theme.radius.lg, paddingHorizontal: theme.space.lg,
  },
  dollar: { color: theme.color.textDim, fontSize: 30, marginRight: theme.space.sm, fontWeight: theme.weight.semibold },
  amountInput: { flex: 1, color: theme.color.text, fontSize: 34, fontWeight: theme.weight.bold, paddingVertical: theme.space.md },
  fxRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  fxLabel: { color: theme.color.textDim, fontSize: theme.font.body, fontWeight: theme.weight.medium },
  fxTotal: { color: theme.color.text, fontSize: theme.font.h1, fontWeight: theme.weight.heavy, letterSpacing: theme.track.tight },
  fxDivider: { height: 1, backgroundColor: theme.color.border, marginVertical: theme.space.md },
  line: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 5 },
  lineK: { color: theme.color.textDim, fontSize: theme.font.small },
  lineV: { color: theme.color.textDim, fontSize: theme.font.small, fontFamily: theme.font.mono },
  compareBox: { marginTop: theme.space.md, paddingTop: theme.space.md, borderTopWidth: 1, borderTopColor: theme.color.border },
  compareRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  compareRedotLabel: { color: theme.color.textFaint, fontSize: theme.font.small, textDecorationLine: "line-through" },
  compareRedotVal: { color: theme.color.textFaint, fontSize: theme.font.small, fontFamily: theme.font.mono, textDecorationLine: "line-through" },
  savePill: { backgroundColor: theme.color.savingsSoft, borderRadius: theme.radius.pill, paddingVertical: 8, paddingHorizontal: theme.space.md, alignSelf: "flex-start", marginTop: theme.space.md },
  saveText: { color: theme.color.savings, fontSize: theme.font.small, fontWeight: theme.weight.bold },
  doneWrap: { flex: 1, backgroundColor: theme.color.bg, padding: theme.space.lg, alignItems: "center", justifyContent: "center" },
  check: { width: 88, height: 88, borderRadius: 44, backgroundColor: theme.color.savingsSoft, alignItems: "center", justifyContent: "center", marginBottom: theme.space.lg },
  checkMark: { color: theme.color.savings, fontSize: 50, fontWeight: theme.weight.regular },
  doneTitle: { color: theme.color.text, fontSize: theme.font.h2, fontWeight: theme.weight.bold, textAlign: "center" },
  savedLabel: { color: theme.color.textDim, fontSize: theme.font.small },
  savedAmount: { color: theme.color.savings, fontSize: theme.font.display, fontWeight: theme.weight.heavy, letterSpacing: theme.track.tight, marginVertical: 2 },
  savedSub: { color: theme.color.textDim, fontSize: theme.font.small, lineHeight: 19 },
});
