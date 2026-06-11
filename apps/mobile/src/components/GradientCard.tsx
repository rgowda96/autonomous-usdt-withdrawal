import { LinearGradient } from "expo-linear-gradient";
import { StyleSheet, View, type ViewStyle } from "react-native";
import { theme } from "../theme";

type Props = {
  colors: readonly [string, string, ...string[]];
  children: React.ReactNode;
  style?: ViewStyle | ViewStyle[];
  borderColor?: string;
};

export function GradientCard({ colors, children, style, borderColor }: Props) {
  return (
    <LinearGradient
      colors={colors}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[s.card, borderColor ? { borderColor } : null, style as ViewStyle]}
    >
      {children}
    </LinearGradient>
  );
}

const s = StyleSheet.create({
  card: {
    borderRadius: theme.radius.xl,
    borderWidth: 1,
    borderColor: theme.color.border,
    padding: theme.space.lg,
    ...theme.shadow.card,
  },
});
