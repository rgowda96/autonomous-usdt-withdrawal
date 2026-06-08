import { ScrollView, StyleSheet, Text, View } from "react-native";
import Constants from "expo-constants";
import { theme } from "../theme";

export function SettingsScreen() {
  const apiUrl = Constants.expoConfig?.extra?.apiBaseUrl ?? "(unset)";
  return (
    <ScrollView style={s.scroll} contentContainerStyle={s.content}>
      <Text style={s.h1}>Settings</Text>

      <Section title="Connection">
        <Row k="Backend URL" v={String(apiUrl)} />
        <Note>Edit `apps/mobile/app.json` → `extra.apiBaseUrl` to change. Restart Expo Go after.</Note>
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
  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: theme.space.sm },
  rowK: { color: theme.color.textDim, fontSize: theme.font.small },
  rowV: { color: theme.color.text, fontSize: theme.font.small, fontFamily: theme.font.mono, flexShrink: 1, marginLeft: theme.space.md, textAlign: "right" },
  note: { color: theme.color.textDim, fontSize: theme.font.small, lineHeight: 18, marginTop: theme.space.sm },
});
