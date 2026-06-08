import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { api } from "../api";
import { theme } from "../theme";

type Status = "checking" | "ok" | "down";

export function ConnectionBanner() {
  const [status, setStatus] = useState<Status>("checking");

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      try {
        await api.health();
        if (!cancelled) setStatus("ok");
      } catch {
        if (!cancelled) setStatus("down");
      }
    };
    check();
    const i = setInterval(check, 15000);
    return () => {
      cancelled = true;
      clearInterval(i);
    };
  }, []);

  if (status === "ok") return null;

  return (
    <View style={[s.bar, status === "down" ? s.barDown : s.barChecking]}>
      <Text style={s.text}>
        {status === "checking"
          ? `Connecting to backend… (${api.baseUrl})`
          : `Can't reach backend at ${api.baseUrl} — check Wi-Fi or update app.json → extra.apiBaseUrl`}
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  bar: { paddingHorizontal: theme.space.lg, paddingVertical: theme.space.sm },
  barChecking: { backgroundColor: "rgba(79,140,255,0.15)" },
  barDown: { backgroundColor: "rgba(255,93,108,0.20)" },
  text: { color: theme.color.text, fontSize: theme.font.tiny, textAlign: "center", fontWeight: "500" },
});
