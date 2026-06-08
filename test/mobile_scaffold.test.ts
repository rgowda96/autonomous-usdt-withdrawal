import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const M = (p: string) => resolve(process.cwd(), "apps/mobile", p);

test("mobile app scaffold exists", () => {
  assert.ok(existsSync(M("package.json")));
  assert.ok(existsSync(M("app.json")));
  assert.ok(existsSync(M("App.tsx")));
  assert.ok(existsSync(M("src/api.ts")));
  assert.ok(existsSync(M("README.md")));
});

test("mobile package.json declares expo + react-native", () => {
  const pkg = JSON.parse(readFileSync(M("package.json"), "utf8"));
  assert.equal(pkg.name, "stablepay-mobile");
  assert.ok(pkg.dependencies.expo);
  assert.ok(pkg.dependencies["react-native"]);
  assert.ok(pkg.dependencies.react);
});

test("mobile api.ts references all core endpoints + auto_cheapest", () => {
  const api = readFileSync(M("src/api.ts"), "utf8");
  assert.ok(api.includes("/v1/quote"));
  assert.ok(api.includes("/v1/settle"));
  assert.ok(api.includes("/v1/webhooks/offramp"));
  assert.ok(api.includes("auto_cheapest"));
  assert.ok(api.includes("user_demo_1"));
});

test("backend has CORS registered for mobile clients", () => {
  const server = readFileSync(resolve(process.cwd(), "src/server.ts"), "utf8");
  assert.ok(server.includes("@fastify/cors") || server.includes("'@fastify/cors'"));
  assert.ok(server.includes("cors"));
});
