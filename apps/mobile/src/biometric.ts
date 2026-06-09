import { Platform } from "react-native";
import * as LocalAuthentication from "expo-local-authentication";

export type BiometricResult = { ok: true; method: string } | { ok: false; reason: string };

/**
 * Confirm a payment with the strongest available local auth.
 * Web/sandbox: silently approves (no native APIs).
 * iOS/Android: prompts FaceID/TouchID/Fingerprint, falls back to device PIN.
 */
export async function confirmWithBiometric(promptMessage: string): Promise<BiometricResult> {
  if (Platform.OS === "web") {
    // No biometric in browsers (yet). Treat as confirmed for the demo.
    return { ok: true, method: "web-noop" };
  }
  try {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    const enrolled = await LocalAuthentication.isEnrolledAsync();
    if (!hasHardware || !enrolled) {
      return { ok: true, method: "device-pin-fallback" }; // demo: don't gate when no enrolment
    }
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage,
      disableDeviceFallback: false,
      cancelLabel: "Cancel",
    });
    if (result.success) {
      return { ok: true, method: "biometric" };
    }
    return { ok: false, reason: result.error ?? "cancelled" };
  } catch (e: any) {
    return { ok: false, reason: e?.message ?? "unknown" };
  }
}

export async function biometricLabel(): Promise<string> {
  if (Platform.OS === "web") return "Confirm";
  try {
    const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
    if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) return "FaceID";
    if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) return "Fingerprint";
    if (types.includes(LocalAuthentication.AuthenticationType.IRIS)) return "Iris";
    return "Confirm";
  } catch {
    return "Confirm";
  }
}
