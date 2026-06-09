import { useEffect, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import Constants from "expo-constants";
import { Button } from "../components/Button";
import { defaultBaseUrl, getBaseUrl, setBaseUrlOverride } from "../api";
import { clearStoredApiBaseUrl, getStoredApiBaseUrl, setStoredApiBaseUrl } from "../storage";
import { theme } from "../theme";

export function SettingsScreen() {
  const [draftUrl, setDraftUrl] = useState(getBaseUrl());
  const [override, setOverride] = useState<string | null>(null);
  const [health, setHealth] = useState<"checking" | "ok" | "down">("checking");

  useEffect(() => {
    getStoredApiBaseUrl().then((v) => setOverride(v));
    checkHealth();
  }, [draftUrl]);

  const checkHealth = async () => {
    setHealth("checking");
    try {
      const r = await fetch(`${getBaseUrl()}/healthz`);
      setHealth(r.ok ? "ok" : "down");
    } catch {
      setHealth("down");
    }
  };

  const onSave = async () => {
    const url = draftUrl.trim();
    if (!url.startsWith("http")) return Alert.alert("Invalid URL", "Must start with http:// or https://");
    setBaseUrlOverride(url);
    await setStoredApiBaseUrl(url);
    setOverride(url);
    await checkHealth();
    Alert.alert("Saved", `Backend URL set to ${url}`);
  };

  const onReset = async () => {
    setBaseUrlOverride(null);
    await clearStoredApiBaseUrl();
    setDraftUrl(defaultBaseUrl);
    setOverride(null);
    await checkHealth();
  };

  return (
    <ScrollView style={s.scroll} contentContainerStyle={s.content}>
      <Text style={s.h1}>Settings</Text>

      <Section title="Backend connection">
        <Text style={s.label}>API base URL</Text>
        <TextInput
          value={draftUrl}
          onChangeText={setDraftUrl}
          style={s.input}
          placeholder="http://192.168.1.42:3000"
          placeholderTextColor={theme.color.textFaint}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
        />
        <View style={s.statusRow}>
          <View style={[s.statusDot, health === "ok" ? s.dotOk : health === "down" ? s.dotErr : s.dotChecking]} />
          <Text style={s.statusText}>
            {health === "checking" ? "Checking…" : health === "ok" ? "Reachable" : "Unreachable"}
          </Text>
        </View>
        <View style={{ flexDirection: "row", gap: theme.space.sm, marginTop: theme.space.md }}>
          <Button label="Save" onPress={onSave} style={{ flex: 1 }} />
          {override && <Button label="Reset" onPress={onReset} variant="secondary" style={{ flex: 1 }} />}
        </View>
        <Note>Default from app.json: <Text style={s.mono}>{defaultBaseUrl}</Text>{override ? `\nOverride: ${override}` : ""}</Note>
      </Section>

      <Section title="Account">
        <Row k="Demo user" v="user_demo_1" />
        <Row k="KYC" v="approved (mocked)" />
      </Section>

      <Section title="India compliance">
        <Note>1% TDS (§194S) deducted at every off-ramp. 30% (§115BBH) on crypto gains tracked via FIFO cost-basis. Quarterly Form 26QE → Form 16E to user. Full ITR CSV export available on backend.</Note>
      </Section>

      <Section title="About">
        <Row k="Version" v={`${Constants.expoConfig?.version ?? "0.0.1"} (v0)`} />
        <Row k="Stage" v="MOCK · NO REAL MONEY" />
        <Row k="Mission" v="RedotPay competitor, India-legal, sub-1% fees" />
      </Section>
    </ScrollView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ marginBottom: theme.space.xl }}>
      <Text style={s.sectionTitle}>{title}</Text>
      <View style={s.card}>{children}</View>
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
function Note({ children }: { children: React.ReactNode }) {
  return <Text style={s.note}>{children}</Text>;
}

const s = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: theme.color.bg },
  content: { padding: theme.space.lg, paddingBottom: theme.space.xxl },
  h1: { color: theme.color.text, fontSize: theme.font.h1, fontWeight: "700", marginBottom: theme.space.xl },
  sectionTitle: { color: theme.color.textDim, fontSize: theme.font.tiny, textTransform: "uppercase", letterSpacing: 0.8, fontWeight: "700", marginBottom: theme.space.sm },
  card: { backgroundColor: theme.color.bgElev, borderRadius: theme.radius.lg, borderWidth: 1, borderColor: theme.color.border, padding: theme.space.lg },
  label: { color: theme.color.textDim, fontSize: theme.font.small, marginBottom: theme.space.sm },
  input: { backgroundColor: theme.color.bg, borderWidth: 1, borderColor: theme.color.border, borderRadius: theme.radius.md, padding: theme.space.md, color: theme.color.text, fontSize: theme.font.body, fontFamily: theme.font.mono },
  statusRow: { flexDirection: "row", alignItems: "center", marginTop: theme.space.md },
  statusDot: { width: 8, height: 8, borderRadius: 4, marginRight: theme.space.sm },
  dotOk: { backgroundColor: theme.color.ok },
  dotErr: { backgroundColor: theme.color.err },
  dotChecking: { backgroundColor: theme.color.warn },
  statusText: { color: theme.color.textDim, fontSize: theme.font.small },
  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: theme.space.sm },
  rowK: { color: theme.color.textDim, fontSize: theme.font.small },
  rowV: { color: theme.color.text, fontSize: theme.font.small, fontFamily: theme.font.mono, flexShrink: 1, marginLeft: theme.space.md, textAlign: "right" },
  note: { color: theme.color.textDim, fontSize: theme.font.small, lineHeight: 18, marginTop: theme.space.sm },
  mono: { fontFamily: theme.font.mono, color: theme.color.text },
});
