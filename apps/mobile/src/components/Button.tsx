import * as Haptics from "expo-haptics";
import { ActivityIndicator, Pressable, StyleSheet, Text, ViewStyle } from "react-native";
import { theme } from "../theme";

type Props = {
  label: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "ghost";
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle | ViewStyle[];
};

export function Button({ label, onPress, variant = "primary", loading, disabled, style }: Props) {
  const handle = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    onPress();
  };
  const styles = variantStyles[variant];
  return (
    <Pressable
      onPress={handle}
      disabled={disabled || loading}
      style={({ pressed }) => [styles.base, pressed && styles.pressed, (disabled || loading) && styles.disabled, style as ViewStyle]}
    >
      {loading ? <ActivityIndicator color={styles.text.color as string} /> : <Text style={styles.text}>{label}</Text>}
    </Pressable>
  );
}

const base = StyleSheet.create({
  shared: {
    borderRadius: theme.radius.lg,
    paddingVertical: 16,
    paddingHorizontal: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: { opacity: 0.7, transform: [{ scale: 0.98 }] },
  disabled: { opacity: 0.4 },
});

const variantStyles = {
  primary: StyleSheet.create({
    base: { ...base.shared, backgroundColor: theme.color.accent },
    text: { color: "#fff", fontSize: theme.font.h3, fontWeight: "600" },
    pressed: base.pressed,
    disabled: base.disabled,
  }),
  secondary: StyleSheet.create({
    base: { ...base.shared, backgroundColor: "transparent", borderWidth: 1, borderColor: theme.color.border },
    text: { color: theme.color.text, fontSize: theme.font.h3, fontWeight: "500" },
    pressed: base.pressed,
    disabled: base.disabled,
  }),
  ghost: StyleSheet.create({
    base: { ...base.shared, backgroundColor: "transparent", paddingVertical: 12 },
    text: { color: theme.color.accent, fontSize: theme.font.body, fontWeight: "500" },
    pressed: base.pressed,
    disabled: base.disabled,
  }),
};
