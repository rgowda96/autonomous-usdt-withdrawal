import { useCallback, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Button } from "../components/Button";
import { Pill } from "../components/Pill";
import { balanceInr, totalInr, useBalances, useTransactions } from "../state";
import { theme } from "../theme";
import type { RootTabsParamList } from "../navigation";

export function HomeScreen() {
  const nav = useNavigation<NativeStackNavigationProp<RootTabsParamList>>();
  const { balances, refresh: refreshBalances } = useBalances();
  const { transactions, refresh: refreshTxs } = useTransactions();
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(useCallback(() => { refreshBalances(); refreshTxs(); }, [refreshBalances, refreshTxs]));

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refreshBalances(), refreshTxs()]);
    setRefreshing(false);
  };

  const total = totalInr(balances);
  const recent = transactions.slice(0, 3);

  return (
    <ScrollView
      style={s.scroll}
      contentContainerStyle={s.content}
      refreshControl={<RefreshControl tintColor={theme.color.textDim} refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <Text style={s.greeting}>Hi 👋</Text>
      <Text style={s.totalLabel}>Total balance</Text>
      <Text style={s.totalAmount}>₹{total.toLocaleString("en-IN")}</Text>

      <View style={s.payRow}>
        <Button label="Pay" onPress={() => nav.navigate("PayFlow", { screen: "PayEnter" })} style={s.payBtn} />
      </View>

      <Text style={s.section}>Your assets</Text>
      <View>
        {balances.length === 0 ? (
          <Text style={s.empty}>No balances yet — fund the demo user with `npm run seed` on the backend.</Text>
        ) : (
          balances.map((b) => (
            <View key={`${b.asset}-${b.chain}`} style={s.assetCard}>
              <View style={{ flex: 1 }}>
                <Text style={s.assetTicker}>{b.asset}</Text>
                <Text style={s.assetChain}>on {b.chain}</Text>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <Text style={s.assetInr}>₹{balanceInr(b).toLocaleString("en-IN")}</Text>
                <Text style={s.assetNative}>{Number(b.amount).toFixed(b.asset === "INR_CREDIT" ? 2 : 4)} {b.asset}</Text>
              </View>
            </View>
          ))
        )}
      </View>

      <View style={s.recentHeader}>
        <Text style={s.section}>Recent activity</Text>
        <Text style={s.seeAll} onPress={() => nav.navigate("History", { screen: "HistoryList" })}>See all</Text>
      </View>
      <View>
        {recent.length === 0 ? (
          <Text style={s.empty}>No payments yet. Tap Pay to make one.</Text>
        ) : (
          recent.map((t) => (
            <View key={t.id} style={s.txRow}>
              <View style={{ flex: 1 }}>
                <Text style={s.txAmount}>−₹{t.amount_inr}</Text>
                <Text style={s.txMeta}>via {t.source_asset} · {new Date(t.created_at).toLocaleTimeString()}</Text>
              </View>
              <Pill
                label={t.status}
                tone={t.status === "SETTLED" ? "ok" : t.status.includes("REFUND") || t.status === "FAILED" ? "err" : "warn"}
              />
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: theme.color.bg },
  content: { padding: theme.space.lg, paddingBottom: theme.space.xxl },
  greeting: { color: theme.color.textDim, fontSize: theme.font.body, marginBottom: theme.space.xs },
  totalLabel: { color: theme.color.textDim, fontSize: theme.font.small, marginTop: theme.space.lg },
  totalAmount: { color: theme.color.text, fontSize: 40, fontWeight: "700", marginBottom: theme.space.lg },
  payRow: { marginBottom: theme.space.xl },
  payBtn: { width: "100%" },
  section: { color: theme.color.textDim, fontSize: theme.font.tiny, textTransform: "uppercase", letterSpacing: 0.8, marginTop: theme.space.lg, marginBottom: theme.space.md, fontWeight: "700" },
  empty: { color: theme.color.textFaint, fontStyle: "italic", fontSize: theme.font.small },
  assetCard: { flexDirection: "row", alignItems: "center", backgroundColor: theme.color.bgElev, borderRadius: theme.radius.lg, borderWidth: 1, borderColor: theme.color.border, padding: theme.space.lg, marginBottom: theme.space.sm },
  assetTicker: { color: theme.color.text, fontSize: theme.font.h3, fontWeight: "600" },
  assetChain: { color: theme.color.textDim, fontSize: theme.font.small, marginTop: 2 },
  assetInr: { color: theme.color.text, fontSize: theme.font.h3, fontWeight: "600" },
  assetNative: { color: theme.color.textDim, fontSize: theme.font.small, fontFamily: theme.font.mono, marginTop: 2 },
  recentHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" },
  seeAll: { color: theme.color.accent, fontSize: theme.font.small, fontWeight: "500", marginTop: theme.space.lg },
  txRow: { flexDirection: "row", alignItems: "center", paddingVertical: theme.space.md, borderBottomWidth: 1, borderBottomColor: theme.color.border },
  txAmount: { color: theme.color.text, fontSize: theme.font.h3, fontWeight: "600" },
  txMeta: { color: theme.color.textDim, fontSize: theme.font.small, marginTop: 2 },
});
