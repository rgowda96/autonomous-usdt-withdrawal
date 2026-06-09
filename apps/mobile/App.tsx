import { NavigationContainer, DefaultTheme } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { StatusBar } from "expo-status-bar";
import { Text, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { ConnectionBanner } from "./src/components/ConnectionBanner";
import { HomeScreen } from "./src/screens/HomeScreen";
import { PayEnterScreen } from "./src/screens/PayEnterScreen";
import { PayReviewScreen } from "./src/screens/PayReviewScreen";
import { PaySuccessScreen } from "./src/screens/PaySuccessScreen";
import { HistoryListScreen } from "./src/screens/HistoryScreen";
import { TxDetailScreen } from "./src/screens/TxDetailScreen";
import { SettingsScreen } from "./src/screens/SettingsScreen";
import { theme } from "./src/theme";
import type { HistoryStackParamList, PayFlowParamList, RootTabsParamList } from "./src/navigation";

const Tabs = createBottomTabNavigator<RootTabsParamList>();
const PayStack = createNativeStackNavigator<PayFlowParamList>();
const HistoryStack = createNativeStackNavigator<HistoryStackParamList>();

function PayFlowNavigator() {
  return (
    <PayStack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.color.bg } }}>
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
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <NavigationContainer theme={navTheme}>
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
