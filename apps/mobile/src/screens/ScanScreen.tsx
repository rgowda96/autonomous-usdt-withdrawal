import { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as Haptics from "expo-haptics";
import { Button } from "../components/Button";
import { theme } from "../theme";
import { parseUpiDeeplink } from "../upi";
import type { PayFlowParamList } from "../navigation";

export function ScanScreen() {
  const nav = useNavigation<NativeStackNavigationProp<PayFlowParamList>>();
  const [permission, requestPermission] = useCameraPermissions();
  const lastScannedRef = useRef<string>("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (permission && !permission.granted && permission.canAskAgain) {
      requestPermission();
    }
  }, [permission]);

  const onScan = ({ data }: { data: string }) => {
    if (!data || data === lastScannedRef.current) return;
    lastScannedRef.current = data;
    try {
      const upi = parseUpiDeeplink(data);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      if (upi.amount_inr) {
        nav.navigate("PayReview", { vpa: upi.vpa, amountInr: upi.amount_inr });
      } else {
        nav.navigate("PayEnter");
      }
    } catch (e: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      setError(e.message ?? "Not a UPI QR");
      setTimeout(() => { lastScannedRef.current = ""; setError(null); }, 2000);
    }
  };

  if (!permission) {
    return <View style={s.container}><Text style={s.hint}>Requesting camera…</Text></View>;
  }
  if (!permission.granted) {
    return (
      <View style={s.container}>
        <Text style={s.hint}>Camera access is required to scan UPI QRs.</Text>
        <Button label="Grant camera access" onPress={requestPermission} style={{ marginTop: theme.space.lg }} />
        <Button label="Enter VPA manually" variant="secondary" onPress={() => nav.navigate("PayEnter")} style={{ marginTop: theme.space.sm }} />
      </View>
    );
  }

  return (
    <View style={s.container}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
        onBarcodeScanned={onScan}
      />

      <View style={s.overlay}>
        <View style={s.viewfinder} />
        <Text style={s.title}>Scan a UPI QR</Text>
        {error ? (
          <View style={s.errBanner}>
            <Text style={s.errText}>{error}</Text>
          </View>
        ) : (
          <Text style={s.sub}>Point at a payment QR. We'll auto-detect amount and payee.</Text>
        )}

        <Pressable style={s.fallback} onPress={() => nav.navigate("PayEnter")}>
          <Text style={s.fallbackText}>Enter VPA manually instead</Text>
        </Pressable>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000", padding: theme.space.lg },
  hint: { color: theme.color.textDim, fontSize: theme.font.body, marginTop: theme.space.xl, textAlign: "center" },
  overlay: { flex: 1, justifyContent: "center", alignItems: "center" },
  viewfinder: {
    width: 240, height: 240, borderRadius: theme.radius.xl,
    borderWidth: 2, borderColor: "rgba(255,255,255,0.7)",
    backgroundColor: "transparent",
    shadowColor: "#000", shadowOpacity: 0.6, shadowRadius: 20,
  },
  title: { color: "#fff", fontSize: theme.font.h2, fontWeight: "700", marginTop: theme.space.xl },
  sub: { color: "rgba(255,255,255,0.8)", fontSize: theme.font.small, marginTop: theme.space.sm, textAlign: "center", paddingHorizontal: theme.space.xl },
  errBanner: { backgroundColor: "rgba(255,93,108,0.20)", borderRadius: theme.radius.md, padding: theme.space.md, marginTop: theme.space.md },
  errText: { color: theme.color.err, fontSize: theme.font.small, fontWeight: "600" },
  fallback: { marginTop: theme.space.xxl, paddingVertical: theme.space.md, paddingHorizontal: theme.space.lg, borderRadius: theme.radius.md, borderWidth: 1, borderColor: "rgba(255,255,255,0.3)" },
  fallbackText: { color: "#fff", fontSize: theme.font.small, fontWeight: "500" },
});
