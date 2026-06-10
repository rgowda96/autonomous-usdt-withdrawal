import { NavigationContainer, DefaultTheme } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { StatusBar } from "expo-status-bar";
import { useEffect, useRef, useState } from "react";
import { Linking, Text, View } from "react-native";
import { initBaseUrl } from "./src/api";
import { isOnboardDone, markOnboardDone } from "./src/storage";
import { OnboardScreen } from "./src/screens/OnboardScreen";
import { isUpiDeeplink, parseUpiDeeplink } from "./src/upi";
import type { NavigationContainerRef } from "@react-navigation/native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { ConnectionBanner } from "./src/components/ConnectionBanner";
import { HomeScreen } from "./src/screens/HomeScreen";
import { PayEnterScreen } from "./src/screens/PayEnterScreen";
import { PayReviewScreen } from "./src/screens/PayReviewScreen";
import { PaySuccessScreen } from "./src/screens/PaySuccessScreen";
import { ScanScreen } from "./src/screens/ScanScreen";
import { HistoryListScreen } from "./src/screens/HistoryScreen";
import { TxDetailScreen } from "./src/screens/TxDetailScreen";
import { SettingsScreen } from "./src/screens/SettingsScreen";
import { AgentsScreen } from "./src/screens/AgentsScreen";
import { theme } from "./src/theme";
import type { HistoryStackParamList, PayFlowParamList, RootTabsParamList } from "./src/navigation";

const Tabs = createBottomTabNavigator<RootTabsParamList>();
const PayStack = createNativeStackNavigator<PayFlowParamList>();
const HistoryStack = createNativeStackNavigator<HistoryStackParamList>();

function PayFlowNavigator() {
  return (
    <PayStack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.color.bg } }}>
      <PayStack.Screen name="Scan" component={ScanScreen} />
      <PayStack.Screen name="PayEnter" component={PayEnterScreen} />
      <PayStack.Screen name="PayReview" component={PayReviewScreen} />
      <PayStack.Screen name="PaySuccess" component={PaySuccessScreen} />
    </PayStack.Navigator>
  );
}

function HistoryNavigator() {
  return (
    <HistoryStack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.color.bg } }}>
      <HistoryStack.Screen name="HistoryList" component={HistoryListScreen} />
      <HistoryStack.Screen name="TxDetail" component={TxDetailScreen} />
    </HistoryStack.Navigator>
  );
}

const navTheme = {
  ...DefaultTheme,
  dark: true,
  colors: {
    ...DefaultTheme.colors,
    background: theme.color.bg,
    card: theme.color.bg,
    text: theme.color.text,
    primary: theme.color.accent,
    border: theme.color.border,
  },
};

function TabIcon({ label, focused }: { label: string; focused: boolean }) {
  return (
    <View style={{ alignItems: "center", justifyContent: "center" }}>
      <Text style={{ fontSize: 22, opacity: focused ? 1 : 0.45 }}>{label}</Text>
    </View>
  );
}

export default function App() {
  const [ready, setReady] = useState(false);
  const [needsOnboard, setNeedsOnboard] = useState(false);
  const navRef = useRef<NavigationContainerRef<RootTabsParamList>>(null);

  useEffect(() => {
    Promise.all([initBaseUrl(), isOnboardDone()]).then(([_, done]) => {
      setNeedsOnboard(!done);
      setReady(true);
    });
  }, []);

  // UPI deeplink handler: when the OS hands us a upi:// URL, jump into the
  // Pay flow at the Review step (if amount included) or Enter step otherwise.
  useEffect(() => {
    const handle = (url: string | null) => {
      if (!url || !isUpiDeeplink(url)) return;
      try {
        const upi = parseUpiDeeplink(url);
        if (!navRef.current) return;
        if (upi.amount_inr) {
          navRef.current.navigate("PayFlow", { screen: "PayReview", params: { vpa: upi.vpa, amountInr: upi.amount_inr } });
        } else {
          navRef.current.navigate("PayFlow", { screen: "PayEnter" });
        }
        // Note: launched-from-camera deeplinks bypass the Scan screen; the
        // user can still reach it via Home -> Pay.
      } catch {
        // Bad deeplink; ignore.
      }
    };
    Linking.getInitialURL().then(handle).catch(() => {});
    const sub = Linking.addEventListener("url", (e) => handle(e.url));
    return () => sub.remove();
  }, []);

  const finishOnboard = () => { markOnboardDone(); setNeedsOnboard(false); };
  if (!ready) return null;
  if (needsOnboard) {
    return (
      <SafeAreaProvider>
        <OnboardScreen onDone={finishOnboard} />
      </SafeAreaProvider>
    );
  }
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <NavigationContainer ref={navRef} theme={navTheme}>
          <ConnectionBanner />
          <Tabs.Navigator
            screenOptions={{
              headerShown: false,
              tabBarShowLabel: true,
              tabBarStyle: {
                backgroundColor: theme.color.bgElev,
                borderTopColor: theme.color.border,
                height: 64,
                paddingTop: 6,
                paddingBottom: 8,
              },
              tabBarActiveTintColor: theme.color.accent,
              tabBarInactiveTintColor: theme.color.textDim,
              tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
            }}
          >
            <Tabs.Screen
              name="Home"
              component={HomeScreen}
              options={{ tabBarIcon: ({ focused }) => <TabIcon label="🏠" focused={focused} /> }}
            />
            <Tabs.Screen
              name="PayFlow"
              component={PayFlowNavigator}
              options={{ title: "Pay", tabBarIcon: ({ focused }) => <TabIcon label="💸" focused={focused} /> }}
            />
            <Tabs.Screen
              name="History"
              component={HistoryNavigator}
              options={{ tabBarIcon: ({ focused }) => <TabIcon label="📜" focused={focused} /> }}
            />
            <Tabs.Screen
              name="Agents"
              component={AgentsScreen}
              options={{ tabBarIcon: ({ focused }) => <TabIcon label="🤖" focused={focused} /> }}
            />
            <Tabs.Screen
              name="Settings"
              component={SettingsScreen}
              options={{ tabBarIcon: ({ focused }) => <TabIcon label="⚙️" focused={focused} /> }}
            />
          </Tabs.Navigator>
        </NavigationContainer>
        <StatusBar style="light" />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
