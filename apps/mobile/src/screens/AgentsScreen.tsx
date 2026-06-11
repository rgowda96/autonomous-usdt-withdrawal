import { useCallback, useState } from "react";
import {
  Alert, KeyboardAvoidingView, Platform, Pressable, RefreshControl, ScrollView,
  StyleSheet, Text, TextInput, View,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import * as Haptics from "expo-haptics";
import { Button } from "../components/Button";
import { Pill } from "../components/Pill";
import { api, type SessionKey } from "../api";
import { theme } from "../theme";

export function AgentsScreen() {
  const [keys, setKeys] = useState<SessionKey[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [label, setLabel] = useState("Claude Desktop");
  const [perTxnCap, setPerTxnCap] = useState("500");
  const [dailyCap, setDailyCap] = useState("2000");
  const [allowlist, setAllowlist] = useState("");
  const [justMinted, setJustMinted] = useState<string | null>(null);

  const refresh = async () => {
    try {
      const r = await api.sessionKeys();
      setKeys(r.session_keys ?? []);
    } catch { /* ignore */ }
  };

  useFocusEffect(useCallback(() => { refresh(); }, []));

  const onPullRefresh = async () => {
    setRefreshing(true); await refresh(); setRefreshing(false);
  };

  const onCreate = async () => {
    const ptc = parseInt(perTxnCap, 10);
    const dc = parseInt(dailyCap, 10);
    if (!ptc || !dc) return Alert.alert("Invalid caps");
    if (ptc > dc) return Alert.alert("Per-txn cap can't exceed daily cap");
    try {
      const vpa_allowlist = allowlist.split(",").map((s) => s.trim()).filter(Boolean);
      const sk = await api.createSessionKey({
        label, daily_cap_inr: dc, per_txn_cap_inr: ptc,
        vpa_allowlist: vpa_allowlist.length ? vpa_allowlist : undefined,
        ttl_days: 30,
      });
      setJustMinted(sk.token);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      await refresh();
      setShowCreate(false);
    } catch (e: any) {
      Alert.alert("Couldn't create key", e.message);
    }
  };

  const onRevoke = async (id: string, lbl: string) => {
    Alert.alert(
      "Revoke session key?",
      `${lbl} won't be able to transact again. This can't be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Revoke", style: "destructive", onPress: async () => {
            try {
              await api.revokeSessionKey(id);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
              refresh();
            } catch (e: any) { Alert.alert("Revoke failed", e.message); }
          },
        },
      ]
    );
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={s.flex}>
      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.content}
        refreshControl={<RefreshControl tintColor={theme.color.textDim} refreshing={refreshing} onRefresh={onPullRefresh} />}
      >
        <Text style={s.h1}>Agents</Text>
        <Text style={s.sub}>Let an LLM (Claude, Cursor) transact within bounds you set.</Text>

        {justMinted && (
          <View style={s.tokenBox}>
            <Text style={s.tokenLabel}>New token — copy now, shown once:</Text>
            <Text selectable style={s.tokenValue}>{justMinted}</Text>
            <Button label="Dismiss" variant="ghost" onPress={() => setJustMinted(null)} />
          </View>
        )}

        {!showCreate && (
          <Button label="New session key" onPress={() => setShowCreate(true)} style={{ marginBottom: theme.space.lg }} />
        )}

        {showCreate && (
          <View style={s.card}>
            <Text style={s.cardTitle}>New session key</Text>
            <Text style={s.label}>Label</Text>
            <TextInput style={s.input} value={label} onChangeText={setLabel} placeholderTextColor={theme.color.textFaint} />
            <Text style={s.label}>Per-transaction cap (INR)</Text>
            <TextInput style={s.input} value={perTxnCap} onChangeText={setPerTxnCap} keyboardType="number-pad" />
            <Text style={s.label}>Daily cap (INR)</Text>
            <TextInput style={s.input} value={dailyCap} onChangeText={setDailyCap} keyboardType="number-pad" />
            <Text style={s.label}>VPA allowlist (comma-separated, blank = any)</Text>
            <TextInput
              style={s.input} value={allowlist} onChangeText={setAllowlist}
              placeholder="swiggy@hdfc, zomato@hdfc"
              placeholderTextColor={theme.color.textFaint}
              autoCapitalize="none" autoCorrect={false}
            />
            <View style={{ flexDirection: "row", gap: theme.space.sm, marginTop: theme.space.md }}>
              <Button label="Cancel" variant="secondary" onPress={() => setShowCreate(false)} style={{ flex: 1 }} />
              <Button label="Mint" onPress={onCreate} style={{ flex: 1 }} />
            </View>
          </View>
        )}

        <Text style={s.sectionTitle}>Active keys</Text>
        {keys.length === 0 ? (
          <Text style={s.empty}>No agents yet. Tap "New session key" to invite one.</Text>
        ) : (
          keys.map((k) => {
            const revoked = !!k.revoked_at;
            return (
              <View key={k.id} style={s.card}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.keyLabel}>{k.label}</Text>
                    <Text style={s.keyMeta}>Created {new Date(k.created_at).toLocaleDateString()}</Text>
                  </View>
                  <Pill label={revoked ? "REVOKED" : "ACTIVE"} tone={revoked ? "err" : "ok"} />
                </View>
                <View style={s.kvBox}>
                  <KV k="Per-txn cap" v={`₹${k.per_txn_cap_inr.toLocaleString("en-IN")}`} />
                  <KV k="Daily cap" v={`₹${k.daily_cap_inr.toLocaleString("en-IN")}`} />
                  <KV k="Allowlist" v={k.vpa_allowlist?.length ? k.vpa_allowlist.join(", ") : "any"} />
                  <KV k="Expires" v={new Date(k.expires_at).toLocaleDateString()} />
                </View>
                {!revoked && (
                  <Pressable onPress={() => onRevoke(k.id, k.label)}>
                    <Text style={s.revoke}>Revoke</Text>
                  </Pressable>
                )}
              </View>
            );
          })
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function KV({ k, v }: { k: string; v: string }) {
  return (
    <View style={s.kvRow}>
      <Text style={s.kvK}>{k}</Text>
      <Text style={s.kvV} numberOfLines={2}>{v}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { flex: 1, backgroundColor: theme.color.bg },
  content: { padding: theme.space.lg, paddingBottom: theme.space.xxl },
  h1: { color: theme.color.text, fontSize: theme.font.h1, fontWeight: "700" },
  sub: { color: theme.color.textDim, fontSize: theme.font.small, marginBottom: theme.space.xl },
  sectionTitle: { color: theme.color.textDim, fontSize: theme.font.tiny, textTransform: "uppercase", letterSpacing: 0.8, fontWeight: "700", marginTop: theme.space.lg, marginBottom: theme.space.md },
  empty: { color: theme.color.textFaint, fontStyle: "italic", fontSize: theme.font.small },
  card: { backgroundColor: theme.color.bgElev, borderRadius: theme.radius.lg, borderWidth: 1, borderColor: theme.color.border, padding: theme.space.lg, marginBottom: theme.space.md },
  cardTitle: { color: theme.color.textDim, fontSize: theme.font.tiny, textTransform: "uppercase", letterSpacing: 0.8, fontWeight: "700", marginBottom: theme.space.md },
  label: { color: theme.color.textDim, fontSize: theme.font.small, marginTop: theme.space.md, marginBottom: theme.space.sm },
  input: { backgroundColor: theme.color.bg, borderWidth: 1, borderColor: theme.color.border, borderRadius: theme.radius.md, padding: theme.space.md, color: theme.color.text, fontSize: theme.font.body },
  keyLabel: { color: theme.color.text, fontSize: theme.font.h3, fontWeight: "600" },
  keyMeta: { color: theme.color.textDim, fontSize: theme.font.small, marginTop: 2 },
  kvBox: { marginTop: theme.space.md },
  kvRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4 },
  kvK: { color: theme.color.textDim, fontSize: theme.font.small },
  kvV: { color: theme.color.text, fontSize: theme.font.small, fontFamily: theme.font.mono, flexShrink: 1, marginLeft: theme.space.md, textAlign: "right" },
  revoke: { color: theme.color.err, fontSize: theme.font.small, fontWeight: "600", textAlign: "right", marginTop: theme.space.md },
  tokenBox: { backgroundColor: "rgba(46,204,113,0.08)", borderWidth: 1, borderColor: theme.color.ok, borderRadius: theme.radius.lg, padding: theme.space.lg, marginBottom: theme.space.lg },
  tokenLabel: { color: theme.color.ok, fontSize: theme.font.small, fontWeight: "700", marginBottom: theme.space.sm },
  tokenValue: { color: theme.color.text, fontFamily: theme.font.mono, fontSize: theme.font.small, marginBottom: theme.space.md },
});
