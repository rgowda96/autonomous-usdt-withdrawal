import { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import type { NativeStackNavigationProp, NativeStackScreenProps } from "@react-navigation/native-stack";
import { api, type TransactionDetail } from "../api";
import { Button } from "../components/Button";
import { Pill } from "../components/Pill";
import { theme } from "../theme";
import type { HistoryStackParamList } from "../navigation";

type Props = NativeStackScreenProps<HistoryStackParamList, "TxDetail">;

export function TxDetailScreen() {
  const route = useRoute<Props["route"]>();
  const nav = useNavigation<NativeStackNavigationProp<HistoryStackParamList>>();
  const { txId } = route.params;
  const [tx, setTx] = useState<TransactionDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.transaction(txId).then(setTx).catch((e) => setError(e.message));
  }, [txId]);

  if (error) {
    return (
      <View style={s.center}>
        <Text style={s.errTitle}>Couldn't load transaction</Text>
        <Text style={s.errMsg}>{error}</Text>
        <Button label="Back" onPress={() => nav.goBack()} variant="secondary" style={{ marginTop: theme.space.lg }} />
      </View>
    );
  }
  if (!tx) {
    return <View style={s.center}><ActivityIndicator color={theme.color.accent} size="large" /></View>;
  }

  const tone = tx.status === "SETTLED" ? "ok" : tx.status.includes("REFUND") || tx.status === "FAILED" ? "err" : "warn";

  return (
    <ScrollView style={s.scroll} contentContainerStyle={s.content}>
      <View style={s.heroCard}>
        <Pill label={tx.status} tone={tone} />
        <Text style={s.amount}>−₹{tx.amount_inr.toLocaleString("en-IN")}</Text>
        <Text style={s.payee}>to {tx.payee.identifier}</Text>
        <Text style={s.when}>{new Date(tx.created_at).toLocaleString()}</Text>
      </View>

      <Card title="Payment">
        <Row k="From" v={`${tx.source.amount} ${tx.source.asset} on ${tx.source.chain}`} />
        <Row k="Rate" v={`₹${parseFloat(tx.rate_inr_per_unit).toFixed(2)} / ${tx.source.asset}`} />
        <Row k="TDS (§194S)" v={`₹${tx.tds_inr} (claimable in ITR)`} />
        <Row k="Channel" v={tx.channel} />
      </Card>

      <Card title="Settlement refs">
        <Row k="Transaction" v={tx.id} />
        <Row k="UPI UTR" v={tx.upi_utr ?? "—"} />
        <Row k="Off-ramp ref" v={tx.offramp_ref ?? "—"} />
        <Row k="On-chain tx" v={tx.onchain_tx ? `${tx.onchain_tx.slice(0, 24)}…` : "—"} />
      </Card>

      <Card title="Timeline">
        {tx.timeline.map((e, i) => (
          <View key={i} style={s.timelineRow}>
            <View style={s.dot} />
            <View style={{ flex: 1 }}>
              <Text style={s.tlTo}>{e.to}</Text>
              <Text style={s.tlAt}>{new Date(e.at).toLocaleTimeString()}</Text>
            </View>
          </View>
        ))}
      </Card>

      <Button label="Back" onPress={() => nav.goBack()} variant="secondary" style={{ marginTop: theme.space.md }} />
    </ScrollView>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={s.card}>
      <Text style={s.cardTitle}>{title}</Text>
      {children}
    </View>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <View style={s.row}>
      <Text style={s.rowK}>{k}</Text>
      <Text style={s.rowV} numberOfLines={1}>{v}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: theme.color.bg },
  content: { padding: theme.space.lg, paddingBottom: theme.space.xxl },
  heroCard: { backgroundColor: theme.color.bgElev, borderRadius: theme.radius.xl, borderWidth: 1, borderColor: theme.color.border, padding: theme.space.xl, alignItems: "center", marginBottom: theme.space.md },
  amount: { color: theme.color.text, fontSize: 36, fontWeight: "700", marginTop: theme.space.md },
  payee: { color: theme.color.textDim, fontSize: theme.font.body, marginTop: theme.space.xs, fontFamily: theme.font.mono },
  when: { color: theme.color.textFaint, fontSize: theme.font.small, marginTop: theme.space.sm },
  card: { backgroundColor: theme.color.bgElev, borderRadius: theme.radius.lg, borderWidth: 1, borderColor: theme.color.border, padding: theme.space.lg, marginBottom: theme.space.md },
  cardTitle: { color: theme.color.textDim, fontSize: theme.font.tiny, textTransform: "uppercase", letterSpacing: 0.8, fontWeight: "700", marginBottom: theme.space.md },
  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: theme.space.sm },
  rowK: { color: theme.color.textDim, fontSize: theme.font.small },
  rowV: { color: theme.color.text, fontSize: theme.font.small, fontFamily: theme.font.mono, flexShrink: 1, marginLeft: theme.space.md, textAlign: "right" },
  timelineRow: { flexDirection: "row", alignItems: "flex-start", paddingVertical: theme.space.sm },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: theme.color.accent, marginTop: 6, marginRight: theme.space.md },
  tlTo: { color: theme.color.text, fontSize: theme.font.body, fontWeight: "600" },
  tlAt: { color: theme.color.textDim, fontSize: theme.font.small, fontFamily: theme.font.mono, marginTop: 2 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: theme.color.bg, padding: theme.space.xl },
  errTitle: { color: theme.color.err, fontSize: theme.font.h2, fontWeight: "700", marginBottom: theme.space.md },
  errMsg: { color: theme.color.textDim, fontSize: theme.font.body, textAlign: "center" },
});
