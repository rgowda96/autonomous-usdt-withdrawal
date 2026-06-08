import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import type { NativeStackNavigationProp, NativeStackScreenProps } from "@react-navigation/native-stack";
import * as Haptics from "expo-haptics";
import { Button } from "../components/Button";
import { baseUrl, DEMO_USER_ID } from "../api";
import { theme } from "../theme";
import type { PayFlowParamList, RootTabsParamList } from "../navigation";

type Props = NativeStackScreenProps<PayFlowParamList, "PaySuccess">;

export function PaySuccessScreen() {
  const route = useRoute<Props["route"]>();
  const nav = useNavigation<NativeStackNavigationProp<RootTabsParamList>>();
  const { vpa, amountInr, quote, tx } = route.params;
  const [utr, setUtr] = useState<string | null>(null);

  useEffect(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    // Poll briefly for the simulated webhook to land
    const start = Date.now();
    const i = setInterval(async () => {
      try {
        const r = await fetch(`${baseUrl}/v1/users/${DEMO_USER_ID}/transactions`);
        const j = await r.json();
        const found = j.transactions?.find((t: any) => t.id === tx.transaction_id);
        if (found?.upi_utr) {
          setUtr(found.upi_utr);
          clearInterval(i);
        }
      } catch {}
      if (Date.now() - start > 8000) clearInterval(i);
    }, 600);
    return () => clearInterval(i);
  }, [tx.transaction_id]);

  return (
    <View style={s.container}>
      <View style={s.flex} />
      <View style={s.checkmarkWrap}>
        <Text style={s.checkmark}>✓</Text>
      </View>
      <Text style={s.amount}>Paid ₹{amountInr.toLocaleString("en-IN")}</Text>
      <Text style={s.payee}>to {vpa}</Text>

      <View style={s.detailsCard}>
        <Row k="Status" v={utr ? "SETTLED" : "PROCESSING"} accent={!!utr} />
        <Row k="UTR" v={utr ?? "awaiting webhook…"} />
        <Row k="Fee" v={`${(quote.total_fee_bps / 100).toFixed(2)}%`} />
        <Row k="Paid from" v={`${quote.source_asset} on ${quote.source_chain}`} />
        <Row k="TDS" v={`₹${quote.tds_inr} (claimable in ITR)`} />
      </View>

      <View style={s.flex} />

      <Button label="Done" onPress={() => nav.navigate("Home")} />
    </View>
  );
}

function Row({ k, v, accent }: { k: string; v: string; accent?: boolean }) {
  return (
    <View style={s.row}>
      <Text style={s.rowK}>{k}</Text>
      <Text style={[s.rowV, accent && { color: theme.color.ok }]}>{v}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.color.bg, padding: theme.space.lg, alignItems: "center" },
  flex: { flex: 1 },
  checkmarkWrap: { width: 96, height: 96, borderRadius: 48, backgroundColor: "rgba(46,204,113,0.15)", alignItems: "center", justifyContent: "center", marginBottom: theme.space.lg },
  checkmark: { color: theme.color.ok, fontSize: 56, fontWeight: "300" },
  amount: { color: theme.color.text, fontSize: 32, fontWeight: "700" },
  payee: { color: theme.color.textDim, fontSize: theme.font.body, marginTop: theme.space.sm, fontFamily: theme.font.mono },
  detailsCard: { backgroundColor: theme.color.bgElev, borderRadius: theme.radius.lg, borderWidth: 1, borderColor: theme.color.border, padding: theme.space.lg, marginTop: theme.space.xl, alignSelf: "stretch" },
  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: theme.space.sm },
  rowK: { color: theme.color.textDim, fontSize: theme.font.small },
  rowV: { color: theme.color.text, fontSize: theme.font.small, fontFamily: theme.font.mono, flexShrink: 1, marginLeft: theme.space.md, textAlign: "right" },
});
