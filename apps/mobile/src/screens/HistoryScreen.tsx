import { useCallback, useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import * as Haptics from "expo-haptics";
import { Pill } from "../components/Pill";
import { useTransactions } from "../state";
import { theme } from "../theme";
import type { HistoryStackParamList } from "../navigation";

export function HistoryListScreen() {
  const nav = useNavigation<NativeStackNavigationProp<HistoryStackParamList>>();
  const { transactions, refresh } = useTransactions();
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));

  const onRefresh = async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  };

  return (
    <ScrollView
      style={s.scroll}
      contentContainerStyle={s.content}
      refreshControl={<RefreshControl tintColor={theme.color.textDim} refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <Text style={s.h1}>History</Text>
      <Text style={s.sub}>{transactions.length} payment{transactions.length === 1 ? "" : "s"}</Text>

      {transactions.length === 0 ? (
        <View style={s.empty}>
          <Text style={s.emptyTitle}>No payments yet</Text>
          <Text style={s.emptySub}>When you pay, it shows up here with full timeline.</Text>
        </View>
      ) : (
        transactions.map((t) => (
          <Pressable
            key={t.id}
            onPress={() => {
              Haptics.selectionAsync().catch(() => {});
              nav.navigate("TxDetail", { txId: t.id });
            }}
            style={({ pressed }) => [s.card, pressed && { opacity: 0.7 }]}
          >
            <View style={s.cardTop}>
              <View style={{ flex: 1 }}>
                <Text style={s.cardAmount}>−₹{t.amount_inr}</Text>
                <Text style={s.cardMeta}>{new Date(t.created_at).toLocaleString()}</Text>
              </View>
              <Pill
                label={t.status}
                tone={t.status === "SETTLED" ? "ok" : t.status.includes("REFUND") || t.status === "FAILED" ? "err" : "warn"}
              />
            </View>
            <View style={s.divider} />
            <Row k="Paid from" v={`${t.source_amount} ${t.source_asset}`} />
            <Row k="UTR" v={t.upi_utr ?? "—"} />
            <Text style={s.tapHint}>Tap for full timeline →</Text>
          </Pressable>
        ))
      )}
    </ScrollView>
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
  h1: { color: theme.color.text, fontSize: theme.font.h1, fontWeight: "700" },
  sub: { color: theme.color.textDim, fontSize: theme.font.small, marginBottom: theme.space.lg },
  empty: { padding: theme.space.xxl, alignItems: "center" },
  emptyTitle: { color: theme.color.text, fontSize: theme.font.h3, fontWeight: "600", marginBottom: theme.space.sm },
  emptySub: { color: theme.color.textDim, fontSize: theme.font.small, textAlign: "center" },
  card: { backgroundColor: theme.color.bgElev, borderRadius: theme.radius.lg, borderWidth: 1, borderColor: theme.color.border, padding: theme.space.lg, marginBottom: theme.space.md },
  cardTop: { flexDirection: "row", alignItems: "flex-start" },
  cardAmount: { color: theme.color.text, fontSize: theme.font.h2, fontWeight: "600" },
  cardMeta: { color: theme.color.textDim, fontSize: theme.font.small, marginTop: 4 },
  divider: { height: 1, backgroundColor: theme.color.border, marginVertical: theme.space.md },
  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4 },
  rowK: { color: theme.color.textDim, fontSize: theme.font.small },
  rowV: { color: theme.color.text, fontSize: theme.font.small, fontFamily: theme.font.mono, flexShrink: 1, marginLeft: theme.space.md, textAlign: "right" },
  tapHint: { color: theme.color.accent, fontSize: theme.font.tiny, fontWeight: "500", marginTop: theme.space.sm, textAlign: "right" },
});
