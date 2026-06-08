import { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import type { NativeStackNavigationProp, NativeStackScreenProps } from "@react-navigation/native-stack";
import * as Haptics from "expo-haptics";
import { Button } from "../components/Button";
import { api, type QuoteResponse } from "../api";
import { theme } from "../theme";
import type { PayFlowParamList } from "../navigation";

type Props = NativeStackScreenProps<PayFlowParamList, "PayReview">;

export function PayReviewScreen() {
  const route = useRoute<Props["route"]>();
  const nav = useNavigation<NativeStackNavigationProp<PayFlowParamList>>();
  const { vpa, amountInr } = route.params;
  const [quote, setQuote] = useState<QuoteResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [settling, setSettling] = useState(false);

  useEffect(() => {
    api
      .quote(vpa, amountInr)
      .then(setQuote)
      .catch((e) => setError(e.message));
  }, [vpa, amountInr]);

  const onConfirm = async () => {
    if (!quote) return;
    setSettling(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    try {
      const s = await api.settle(quote.quote_id);
      if (s.offramp_ref) {
        setTimeout(() => api.simulateWebhook(quote.quote_id, s.offramp_ref!).catch(() => {}), 1500);
      }
      nav.replace("PaySuccess", { vpa, amountInr, quote, tx: s });
    } catch (e: any) {
      setError(e.message);
      setSettling(false);
    }
  };

  if (error) {
    return (
      <View style={s.errorContainer}>
        <Text style={s.errorTitle}>Couldn't quote this payment</Text>
        <Text style={s.errorMsg}>{error}</Text>
        <Button label="Try again" onPress={() => nav.goBack()} variant="secondary" style={{ marginTop: theme.space.lg }} />
      </View>
    );
  }

  if (!quote) {
    return (
      <View style={s.loadingContainer}>
        <ActivityIndicator color={theme.color.accent} size="large" />
        <Text style={s.loadingText}>Getting best rate…</Text>
      </View>
    );
  }

  return (
    <ScrollView style={s.scroll} contentContainerStyle={s.content}>
      <Text style={s.h1}>Review</Text>

      <View style={s.heroCard}>
        <Text style={s.heroAmount}>₹{quote.amount_inr.toLocaleString("en-IN")}</Text>
        <Text style={s.heroVpa}>to {vpa}</Text>
      </View>

      <View style={s.card}>
        <Text style={s.cardTitle}>Payment breakdown</Text>
        <Row k="Pay from" v={`${quote.source_asset} on ${quote.source_chain}`} />
        <Row k="You'll spend" v={`${quote.source_amount} ${quote.source_asset}`} />
        <Row k="Rate" v={`₹${parseFloat(quote.rate_inr_per_unit).toFixed(2)} / ${quote.source_asset}`} />
        <Row k="Fee" v={`${(quote.total_fee_bps / 100).toFixed(2)}%`} accent />
        <Row k="TDS (§194S)" v={`₹${quote.tds_inr}`} />
        {(quote.source_asset === "ETH" || quote.source_asset === "BTC" || quote.source_asset === "SOL") && (
          <View style={s.warningBox}>
            <Text style={s.warningText}>
              ⚠ Spending {quote.source_asset} triggers a 30% capital-gain tax event under §115BBH on any unrealized gain.
            </Text>
          </View>
        )}
      </View>

      <View style={{ flex: 1 }} />

      <Button label={settling ? "Settling…" : "Confirm with FaceID"} onPress={onConfirm} loading={settling} />
      <Button label="Cancel" onPress={() => nav.goBack()} variant="ghost" style={{ marginTop: theme.space.sm }} />
    </ScrollView>
  );
}

function Row({ k, v, accent }: { k: string; v: string; accent?: boolean }) {
  return (
    <View style={s.row}>
      <Text style={s.rowK}>{k}</Text>
      <Text style={[s.rowV, accent && { color: theme.color.accent }]}>{v}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: theme.color.bg },
  content: { padding: theme.space.lg, paddingBottom: theme.space.xxl, flexGrow: 1 },
  h1: { color: theme.color.text, fontSize: theme.font.h1, fontWeight: "700", marginBottom: theme.space.lg },
  heroCard: { backgroundColor: theme.color.bgElev, borderRadius: theme.radius.xl, borderWidth: 1, borderColor: theme.color.border, padding: theme.space.xl, alignItems: "center", marginBottom: theme.space.md },
  heroAmount: { color: theme.color.text, fontSize: 40, fontWeight: "700" },
  heroVpa: { color: theme.color.textDim, fontSize: theme.font.body, marginTop: theme.space.xs, fontFamily: theme.font.mono },
  card: { backgroundColor: theme.color.bgElev, borderRadius: theme.radius.lg, borderWidth: 1, borderColor: theme.color.border, padding: theme.space.lg },
  cardTitle: { color: theme.color.textDim, fontSize: theme.font.tiny, textTransform: "uppercase", letterSpacing: 0.8, fontWeight: "700", marginBottom: theme.space.md },
  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: theme.space.sm },
  rowK: { color: theme.color.textDim, fontSize: theme.font.small },
  rowV: { color: theme.color.text, fontSize: theme.font.small, fontFamily: theme.font.mono, flexShrink: 1, marginLeft: theme.space.md, textAlign: "right" },
  warningBox: { marginTop: theme.space.md, padding: theme.space.md, backgroundColor: "rgba(232,181,0,0.10)", borderRadius: theme.radius.md, borderLeftWidth: 3, borderLeftColor: theme.color.warn },
  warningText: { color: theme.color.warn, fontSize: theme.font.small, lineHeight: 18 },
  loadingContainer: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: theme.color.bg },
  loadingText: { color: theme.color.textDim, marginTop: theme.space.lg, fontSize: theme.font.body },
  errorContainer: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: theme.color.bg, padding: theme.space.xl },
  errorTitle: { color: theme.color.err, fontSize: theme.font.h2, fontWeight: "700", marginBottom: theme.space.md },
  errorMsg: { color: theme.color.textDim, fontSize: theme.font.body, textAlign: "center" },
});
