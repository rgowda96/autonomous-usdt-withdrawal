import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { api, type QuoteResponse, type SettleResponse, type Transaction } from "./src/api";

type Phase = "idle" | "quoting" | "quoted" | "settling" | "settled" | "error";

export default function App() {
  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.safe}>
        <Home />
        <StatusBar style="light" />
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

function Home() {
  const [vpa, setVpa] = useState("swiggy@hdfc");
  const [amount, setAmount] = useState("500");
  const [phase, setPhase] = useState<Phase>("idle");
  const [quote, setQuote] = useState<QuoteResponse | null>(null);
  const [tx, setTx] = useState<SettleResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [txs, setTxs] = useState<Transaction[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const refreshTxs = async () => {
    try {
      const r = await api.transactions();
      setTxs(r.transactions ?? []);
    } catch (e) {
      // surface in UI only on user action
    }
  };

  useEffect(() => {
    refreshTxs();
  }, []);

  const onGetQuote = async () => {
    const inr = parseInt(amount, 10);
    if (!vpa || !inr) return Alert.alert("Need VPA and amount");
    setError(null);
    setPhase("quoting");
    try {
      const q = await api.quote(vpa, inr);
      setQuote(q);
      setPhase("quoted");
    } catch (e: any) {
      setError(e.message);
      setPhase("error");
    }
  };

  const onConfirm = async () => {
    if (!quote) return;
    setPhase("settling");
    try {
      const s = await api.settle(quote.quote_id);
      setTx(s);
      setPhase("settled");
      // simulate off-ramp webhook for full lifecycle
      if (s.offramp_ref) {
        setTimeout(() => {
          api.simulateWebhook(quote.quote_id, s.offramp_ref!).then(() => refreshTxs());
        }, 1500);
      }
      refreshTxs();
    } catch (e: any) {
      setError(e.message);
      setPhase("error");
    }
  };

  const onReset = () => {
    setQuote(null);
    setTx(null);
    setError(null);
    setPhase("idle");
  };

  const onPullRefresh = async () => {
    setRefreshing(true);
    await refreshTxs();
    setRefreshing(false);
  };

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.scrollContent}
      refreshControl={<RefreshControl tintColor="#8a92a6" refreshing={refreshing} onRefresh={onPullRefresh} />}
    >
      <Text style={styles.h1}>StablePay</Text>
      <Text style={styles.sub}>Spend any stablecoin via UPI. v0 demo.</Text>

      <View style={styles.card}>
        <Text style={styles.cardLabel}>Pay to</Text>
        <TextInput
          style={styles.input}
          value={vpa}
          onChangeText={setVpa}
          placeholder="merchant@bank"
          placeholderTextColor="#5a627a"
          autoCapitalize="none"
          autoCorrect={false}
        />
        <Text style={[styles.cardLabel, { marginTop: 12 }]}>Amount (INR)</Text>
        <TextInput
          style={styles.input}
          value={amount}
          onChangeText={setAmount}
          placeholder="500"
          placeholderTextColor="#5a627a"
          keyboardType="number-pad"
        />
        <Pressable
          style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed, phase === "quoting" && styles.disabled]}
          onPress={onGetQuote}
          disabled={phase === "quoting"}
        >
          {phase === "quoting" ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>Get quote</Text>}
        </Pressable>
      </View>

      {phase === "quoted" && quote && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Quote</Text>
          <KV k="Payee" v={vpa} />
          <KV k="Amount" v={`Rs ${quote.amount_inr}`} />
          <KV k="Pay from" v={`${quote.source_asset} (${quote.source_chain})`} />
          <KV k="You will spend" v={`${quote.source_amount} ${quote.source_asset}`} />
          <KV k="Rate" v={`Rs ${parseFloat(quote.rate_inr_per_unit).toFixed(2)} / ${quote.source_asset}`} />
          <KV k="Fee" v={`${(quote.total_fee_bps / 100).toFixed(2)}%`} />
          <KV k="TDS (1%)" v={`Rs ${quote.tds_inr}`} />
          <View style={styles.row}>
            <Pressable style={[styles.secondaryBtn, { flex: 1, marginRight: 8 }]} onPress={onReset}>
              <Text style={styles.secondaryBtnText}>Cancel</Text>
            </Pressable>
            <Pressable style={[styles.primaryBtn, { flex: 2 }]} onPress={onConfirm}>
              <Text style={styles.primaryBtnText}>Confirm (mock FaceID)</Text>
            </Pressable>
          </View>
        </View>
      )}

      {(phase === "settling" || phase === "settled") && tx && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Receipt</Text>
          <View style={[styles.pill, tx.status === "SETTLED" ? styles.pillOk : styles.pillWarn]}>
            <Text style={[styles.pillText, tx.status === "SETTLED" ? styles.pillTextOk : styles.pillTextWarn]}>
              {tx.status}
            </Text>
          </View>
          <View style={{ height: 12 }} />
          <KV k="Transaction" v={tx.transaction_id} />
          <KV k="Off-ramp ref" v={tx.offramp_ref ?? "(pending)"} />
          <KV k="UTR" v={tx.utr ?? "(awaiting webhook)"} />
          <Pressable style={[styles.secondaryBtn, { marginTop: 12 }]} onPress={onReset}>
            <Text style={styles.secondaryBtnText}>New payment</Text>
          </Pressable>
        </View>
      )}

      {error && (
        <View style={[styles.card, { borderColor: "#ff5d6c" }]}>
          <Text style={styles.cardTitle}>Error</Text>
          <Text style={{ color: "#ff5d6c", fontFamily: "Menlo" }}>{error}</Text>
          <Pressable style={[styles.secondaryBtn, { marginTop: 12 }]} onPress={onReset}>
            <Text style={styles.secondaryBtnText}>Try again</Text>
          </Pressable>
        </View>
      )}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Recent transactions</Text>
        {txs.length === 0 ? (
          <Text style={{ color: "#5a627a", fontStyle: "italic" }}>No transactions yet.</Text>
        ) : (
          txs.slice(0, 10).map((t) => (
            <View key={t.id} style={styles.txRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.txAmount}>Rs {t.amount_inr}</Text>
                <Text style={styles.txMeta}>via {t.source_asset}</Text>
              </View>
              <View
                style={[
                  styles.pill,
                  t.status === "SETTLED" ? styles.pillOk : t.status.includes("REFUND") || t.status === "FAILED" ? styles.pillErr : styles.pillWarn,
                ]}
              >
                <Text
                  style={[
                    styles.pillText,
                    t.status === "SETTLED" ? styles.pillTextOk : t.status.includes("REFUND") || t.status === "FAILED" ? styles.pillTextErr : styles.pillTextWarn,
                  ]}
                >
                  {t.status}
                </Text>
              </View>
            </View>
          ))
        )}
      </View>

      <Text style={styles.footer}>API: {api.baseUrl}</Text>
    </ScrollView>
  );
}

function KV({ k, v }: { k: string; v: string }) {
  return (
    <View style={styles.kvRow}>
      <Text style={styles.kvKey}>{k}</Text>
      <Text style={styles.kvVal} numberOfLines={1}>
        {v}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#0b0d12" },
  scroll: { flex: 1, backgroundColor: "#0b0d12" },
  scrollContent: { padding: 16, paddingBottom: 48 },
  h1: { color: "#e6e8ee", fontSize: 24, fontWeight: "700", marginBottom: 4 },
  sub: { color: "#8a92a6", fontSize: 13, marginBottom: 16 },
  card: { backgroundColor: "#151922", borderRadius: 12, borderWidth: 1, borderColor: "#232838", padding: 16, marginBottom: 12 },
  cardTitle: { color: "#e6e8ee", fontSize: 14, fontWeight: "600", marginBottom: 12, textTransform: "uppercase", letterSpacing: 0.5 },
  cardLabel: { color: "#8a92a6", fontSize: 12, marginBottom: 6 },
  input: { backgroundColor: "#0b0d12", borderWidth: 1, borderColor: "#232838", borderRadius: 8, padding: 12, color: "#e6e8ee", fontSize: 16 },
  primaryBtn: { backgroundColor: "#4f8cff", borderRadius: 8, paddingVertical: 14, alignItems: "center", justifyContent: "center", marginTop: 16 },
  primaryBtnText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  secondaryBtn: { backgroundColor: "transparent", borderWidth: 1, borderColor: "#232838", borderRadius: 8, paddingVertical: 14, alignItems: "center" },
  secondaryBtnText: { color: "#e6e8ee", fontSize: 15, fontWeight: "500" },
  pressed: { opacity: 0.7 },
  disabled: { opacity: 0.5 },
  row: { flexDirection: "row", marginTop: 16 },
  kvRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  kvKey: { color: "#8a92a6", fontSize: 13, fontFamily: "Menlo" },
  kvVal: { color: "#e6e8ee", fontSize: 13, fontFamily: "Menlo", flexShrink: 1, marginLeft: 12 },
  pill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, alignSelf: "flex-start" },
  pillText: { fontSize: 11, fontWeight: "600", letterSpacing: 0.5 },
  pillOk: { backgroundColor: "rgba(46,204,113,0.15)" },
  pillTextOk: { color: "#2ecc71" },
  pillWarn: { backgroundColor: "rgba(232,181,0,0.15)" },
  pillTextWarn: { color: "#e8b500" },
  pillErr: { backgroundColor: "rgba(255,93,108,0.15)" },
  pillTextErr: { color: "#ff5d6c" },
  txRow: { flexDirection: "row", alignItems: "center", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "#232838" },
  txAmount: { color: "#e6e8ee", fontSize: 15, fontWeight: "500" },
  txMeta: { color: "#8a92a6", fontSize: 12, marginTop: 2 },
  footer: { color: "#5a627a", fontSize: 11, textAlign: "center", marginTop: 16, fontFamily: "Menlo" },
});
