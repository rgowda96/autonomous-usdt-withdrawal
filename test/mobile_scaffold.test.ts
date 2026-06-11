import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const M = (p: string) => resolve(process.cwd(), "apps/mobile", p);

test("mobile app shell + screens exist", () => {
  assert.ok(existsSync(M("package.json")));
  assert.ok(existsSync(M("app.json")));
  assert.ok(existsSync(M("App.tsx")));
  assert.ok(existsSync(M("src/api.ts")));
  assert.ok(existsSync(M("src/theme.ts")));
  assert.ok(existsSync(M("src/state.ts")));
  assert.ok(existsSync(M("src/navigation.ts")));
  assert.ok(existsSync(M("src/screens/HomeScreen.tsx")));
  assert.ok(existsSync(M("src/screens/PayEnterScreen.tsx")));
  assert.ok(existsSync(M("src/screens/PayReviewScreen.tsx")));
  assert.ok(existsSync(M("src/screens/PaySuccessScreen.tsx")));
  assert.ok(existsSync(M("src/screens/HistoryScreen.tsx")));
  assert.ok(existsSync(M("src/screens/SettingsScreen.tsx")));
  assert.ok(existsSync(M("src/components/Button.tsx")));
  assert.ok(existsSync(M("src/components/Pill.tsx")));
});

test("mobile package.json declares navigation + haptics", () => {
  const pkg = JSON.parse(readFileSync(M("package.json"), "utf8"));
  assert.equal(pkg.name, "stablepay-mobile");
  assert.ok(pkg.dependencies["@react-navigation/native"]);
  assert.ok(pkg.dependencies["@react-navigation/bottom-tabs"]);
  assert.ok(pkg.dependencies["@react-navigation/native-stack"]);
  assert.ok(pkg.dependencies["expo-haptics"]);
  assert.ok(pkg.dependencies["expo-constants"]);
});

test("App.tsx wires bottom tabs with Home/Pay/History/Settings", () => {
  const app = readFileSync(M("App.tsx"), "utf8");
  assert.ok(app.includes("createBottomTabNavigator"));
  assert.ok(app.includes("HomeScreen"));
  assert.ok(app.includes("PayFlow"));
  assert.ok(app.includes("HistoryScreen"));
  assert.ok(app.includes("SettingsScreen"));
});

test("Pay flow is multi-step (Enter / Review / Success)", () => {
  const app = readFileSync(M("App.tsx"), "utf8");
  assert.ok(app.includes("PayEnter"));
  assert.ok(app.includes("PayReview"));
  assert.ok(app.includes("PaySuccess"));
});

test("backend exposes /v1/users/:id/balances (mobile Home depends on it)", () => {
  const api = readFileSync(M("src/api.ts"), "utf8");
  assert.ok(api.includes("/balances"));
  const walletRoute = readFileSync(resolve(process.cwd(), "src/routes/wallet.ts"), "utf8");
  assert.ok(walletRoute.includes("/balances"));
});

test("backend has CORS for mobile clients", () => {
  const server = readFileSync(resolve(process.cwd(), "src/server.ts"), "utf8");
  assert.ok(server.includes("@fastify/cors"));
});
