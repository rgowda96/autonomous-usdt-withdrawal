import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

process.env.DATABASE_URL = `./data/test-demo-${process.pid}.db`;

const Fastify = (await import("fastify")).default;

test("/ serves the demo HTML and references core endpoints", async () => {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const html = await readFile(resolve(__dirname, "..", "src/public/index.html"), "utf8");

  const app = Fastify();
  app.get("/", async (_req, reply) => reply.type("text/html").send(html));

  const res = await app.inject({ method: "GET", url: "/" });
  assert.equal(res.statusCode, 200);
  assert.match(res.headers["content-type"] as string, /text\/html/);
  assert.ok(res.payload.includes("<title>StablePay backend debug</title>"));
  assert.ok(res.payload.includes("/v1/quote"));
  assert.ok(res.payload.includes("/v1/settle"));
  assert.ok(res.payload.includes("/v1/webhooks/offramp"));
  assert.ok(res.payload.includes("user_demo_1"));
});

test("demo HTML uses crypto.randomUUID (not hand-rolled uuid hack)", async () => {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const html = await readFile(resolve(__dirname, "..", "src/public/index.html"), "utf8");
  assert.ok(html.includes("crypto.randomUUID"));
  // Make sure the broken hand-rolled hack is gone
  assert.ok(!html.includes(".replace(/[xy]/g"));
});

test("demo HTML uses replaceChildren/textContent rather than innerHTML for dynamic rows", async () => {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const html = await readFile(resolve(__dirname, "..", "src/public/index.html"), "utf8");
  // The tx-list and breakdown render paths should not use innerHTML for tx-supplied strings
  const trustless = html.indexOf("for (const tx of list");
  const sectionEnd = html.indexOf("refreshTxList();", trustless);
  const txSection = html.slice(trustless, sectionEnd);
  assert.ok(!txSection.includes("innerHTML"));
});
