import { useRef, useState } from "react";
import { Dimensions, ScrollView, StyleSheet, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import * as Haptics from "expo-haptics";
import { Button } from "../components/Button";
import { theme } from "../theme";
import type { RootTabsParamList } from "../navigation";

const { width } = Dimensions.get("window");

type Slide = { emoji: string; title: string; body: string };

const SLIDES: Slide[] = [
  {
    emoji: "💸",
    title: "Spend stablecoins via UPI",
    body: "Pay any UPI QR or VPA in India directly from your USDC / USDT — no card, no Visa.",
  },
  {
    emoji: "🇮🇳",
    title: "Built India-legal",
    body: "1% TDS deducted at source (§194S). 30% capital gains tracked via FIFO cost basis. All Form 26QE / 16E ready.",
  },
  {
    emoji: "🤖",
    title: "Agent-ready",
    body: "Let an LLM agent (Claude, Cursor) transact on your behalf — bounded by per-txn caps, daily caps, and VPA allowlists.",
  },
  {
    emoji: "🌱",
    title: "Earn while idle",
    body: "Park USDC in Aave; the routing engine unwinds JIT when you spend. For big balances, yield can exceed fees.",
  },
];

export function OnboardScreen({ onDone }: { onDone: () => void }) {
  const scrollRef = useRef<ScrollView>(null);
  const [index, setIndex] = useState(0);
  const nav = useNavigation<NativeStackNavigationProp<RootTabsParamList>>();

  const goNext = () => {
    Haptics.selectionAsync().catch(() => {});
    if (index < SLIDES.length - 1) {
      const next = index + 1;
      setIndex(next);
      scrollRef.current?.scrollTo({ x: width * next, animated: true });
    } else {
      onDone();
    }
  };

  return (
    <View style={s.container}>
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / width))}
      >
        {SLIDES.map((slide, i) => (
          <View key={i} style={[s.slide, { width }]}>
            <Text style={s.emoji}>{slide.emoji}</Text>
            <Text style={s.title}>{slide.title}</Text>
            <Text style={s.body}>{slide.body}</Text>
          </View>
        ))}
      </ScrollView>

      <View style={s.dots}>
        {SLIDES.map((_, i) => (
          <View key={i} style={[s.dot, i === index && s.dotActive]} />
        ))}
      </View>

      <View style={s.cta}>
        <Button label={index === SLIDES.length - 1 ? "Get started" : "Next"} onPress={goNext} />
        {index < SLIDES.length - 1 && (
          <Button label="Skip" variant="ghost" onPress={onDone} style={{ marginTop: theme.space.sm }} />
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.color.bg, justifyContent: "space-between" },
  slide: { alignItems: "center", justifyContent: "center", padding: theme.space.xl },
  emoji: { fontSize: 72, marginBottom: theme.space.xl },
  title: { color: theme.color.text, fontSize: theme.font.h1, fontWeight: "700", textAlign: "center", marginBottom: theme.space.md },
  body: { color: theme.color.textDim, fontSize: theme.font.body, textAlign: "center", lineHeight: 22, paddingHorizontal: theme.space.lg },
  dots: { flexDirection: "row", justifyContent: "center", paddingVertical: theme.space.lg, gap: theme.space.sm },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: theme.color.border },
  dotActive: { backgroundColor: theme.color.accent, width: 24 },
  cta: { padding: theme.space.lg, paddingBottom: theme.space.xxl },
});
